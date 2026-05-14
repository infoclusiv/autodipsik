(function initDeepSeekChatAutomator(globalScope) {
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const siteConfig = DeepSeekAutomation.DEEPSEEK_CONFIG;
  const Selectors = DeepSeekAutomation.DeepSeekSelectors;
  const DomHelpers = DeepSeekAutomation.DeepSeekDomHelpers;
  const PageState = DeepSeekAutomation.DeepSeekPageState;
  const WorkflowRunner = NewSiteCore.WorkflowRunner;
  const Errors = NewSiteCore.Errors;
  const Telemetry = NewSiteCore.Telemetry;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;

  const requiredSelectorsForMainWorkflow = [
    "fileInput",
    "chatInput",
    "sendButton"
  ];

  function delay(ms) {
    return new Promise(function wait(resolve) {
      setTimeout(resolve, ms);
    });
  }

  function getFileExtension(filePath, fallbackName) {
    const source = String(filePath || fallbackName || "").toLowerCase();
    const match = source.match(/(\.[a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function base64ToFile(filePayload) {
    return new File([base64ToUint8Array(filePayload.contentBase64)], filePayload.name, {
      type: filePayload.mimeType || "application/octet-stream",
      lastModified: Date.now()
    });
  }

  function isEnabled(element) {
    return Boolean(element) && Selectors.isElementClickable(element);
  }

  function queryVisibleElement(selector) {
    const elements = Selectors.queryAllSafe(selector);
    return elements.find(Selectors.isElementVisible) || elements[0] || null;
  }

  function getTextareaForHeuristic(profile) {
    return queryVisibleElement(profile.selectors.chatInput)
      || queryVisibleElement(profile.selectors.chatInputFallback)
      || queryVisibleElement("textarea[placeholder='Message DeepSeek'], textarea[name='search'], textarea");
  }

  function findSendButtonByHeuristic(profile) {
    const textarea = getTextareaForHeuristic(profile);
    if (!textarea) {
      return null;
    }

    const textareaRect = textarea.getBoundingClientRect();

    return Array.from(document.querySelectorAll("[role='button'], button"))
      .filter(function filterCandidate(element) {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const visible = rect.width > 0
          && rect.height > 0
          && style.display !== "none"
          && style.visibility !== "hidden";
        const enabled = element.getAttribute("aria-disabled") !== "true"
          && !String(element.className || "").toLowerCase().includes("disabled")
          && !element.disabled;
        const nearComposer = rect.y >= textareaRect.y + 40
          && rect.y <= textareaRect.y + 140
          && rect.x > textareaRect.x + textareaRect.width - 140;

        return visible && enabled && nearComposer;
      })[0] || null;
  }

  function findAttachedExcelCardByHeuristic() {
    return Array.from(document.querySelectorAll("body *"))
      .find(function findCandidate(element) {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const text = (element.innerText || element.textContent || "").toLowerCase();
        const visible = rect.width >= 80
          && rect.height >= 20
          && style.display !== "none"
          && style.visibility !== "hidden";
        const looksLikeExcel = text.includes(".xlsx")
          || text.includes(".xls")
          || text.includes("xlsx")
          || text.includes("xls");
        const nearComposer = rect.x >= 0
          && rect.x <= window.innerWidth
          && rect.y >= 150
          && rect.y <= window.innerHeight;

        return visible && looksLikeExcel && nearComposer;
      }) || null;
  }

  function getVisibleButtonsNearComposer(profile) {
    const textarea = getTextareaForHeuristic(profile);
    const textareaRect = textarea ? textarea.getBoundingClientRect() : null;

    return Array.from(document.querySelectorAll("[role='button'], button"))
      .filter(function filterButton(element) {
        if (!Selectors.isElementVisible(element)) {
          return false;
        }
        if (!textareaRect) {
          return true;
        }
        const rect = element.getBoundingClientRect();
        return rect.y >= textareaRect.y - 40 && rect.y <= textareaRect.y + 180;
      })
      .slice(0, 10)
      .map(DomHelpers.getElementSummary);
  }

  async function emitWorkflowEvent(context, eventName, level, message, data) {
    await Telemetry.emit({
      eventName: eventName,
      traceId: context.traceId,
      workflowId: context.workflowId,
      siteId: "deepseek",
      component: "automator",
      level: level,
      message: message,
      data: Object.assign({
        step: context.currentStep || "",
        promptLength: context.promptLength || 0,
        fileExtension: context.fileExtension || ""
      }, data || {})
    });
  }

  function buildComposerDiagnosticSnapshot(profile) {
    const textarea = getTextareaForHeuristic(profile);
    const fileInput = queryVisibleElement(profile.selectors.fileInput);
    return {
      url: location.href,
      title: document.title,
      selectorHealthWarnings: Object.keys(profile.selectors || {}).filter(function onlyWarnings(key) {
        return Boolean(Selectors.getSelectorStabilityWarning(profile.selectors[key]));
      }).map(function mapWarning(key) {
        return {
          selectorName: key,
          selectorValue: profile.selectors[key],
          warning: Selectors.getSelectorStabilityWarning(profile.selectors[key])
        };
      }),
      visibleButtonsNearComposer: getVisibleButtonsNearComposer(profile),
      visibleInputs: DomHelpers.getVisibleInputsSummary(),
      composerDomSummary: textarea ? DomHelpers.getElementSummary(textarea) : null,
      textareaState: textarea ? {
        valueLength: String(textarea.value || "").length,
        placeholder: textarea.getAttribute("placeholder") || "",
        ariaDisabled: textarea.getAttribute("aria-disabled") || ""
      } : null,
      fileInputState: fileInput ? {
        multiple: Boolean(fileInput.multiple),
        accept: fileInput.getAttribute("accept") || "",
        filesCount: fileInput.files ? fileInput.files.length : 0
      } : null
    };
  }

  async function collectSelectorHealth(profile) {
    const keys = [
      "fileInput",
      "attachButton",
      "fileAttachedIndicator",
      "chatInput",
      "chatInputFallback",
      "sendButton",
      "sendButtonDisabledIndicator",
      "errorBanner",
      "generatingIndicator"
    ];
    const results = [];
    for (const key of keys) {
      results.push(await Selectors.testSelector({
        selectorName: key,
        selector: profile.selectors[key]
      }));
    }
    return results;
  }

  function buildWorkflowError(code, message, details) {
    return Errors.createError(code, message, Object.assign({
      url: location.href,
      pageState: PageState.detectPageState(details.profile),
      pageSummary: DomHelpers.getPageSummary()
    }, details || {}));
  }

  async function waitForElement(options) {
    const startedAt = Date.now();
    const selectorsToTry = [];
    if (options.selector) {
      selectorsToTry.push({
        selectorName: options.selectorName || "",
        selectorValue: options.selector,
        foundBy: "profile-selector"
      });
    }
    if (options.fallbackSelector) {
      selectorsToTry.push({
        selectorName: options.fallbackSelectorName || options.selectorName || "",
        selectorValue: options.fallbackSelector,
        foundBy: "fallback-selector"
      });
    }

    while (Date.now() - startedAt < options.timeoutMs) {
      for (const candidate of selectorsToTry) {
        const element = queryVisibleElement(candidate.selectorValue);
        if (element) {
          return {
            element: element,
            foundBy: candidate.foundBy,
            selectorName: candidate.selectorName,
            selectorValue: candidate.selectorValue
          };
        }
      }
      await delay(options.pollIntervalMs);
    }

    return null;
  }

  async function waitForAttachedIndicator(profile, context) {
    const selector = profile.selectors.fileAttachedIndicator;
    const startedAt = Date.now();

    while (Date.now() - startedAt < profile.timing.fileAttachTimeoutMs) {
      const selectorElement = queryVisibleElement(selector);
      if (selectorElement) {
        return {
          element: selectorElement,
          foundBy: "profile-selector",
          selectorName: "fileAttachedIndicator",
          selectorValue: selector
        };
      }

      if (profile.behavior.enableHeuristicFallbacks) {
        const heuristicElement = findAttachedExcelCardByHeuristic();
        if (heuristicElement) {
          return {
            element: heuristicElement,
            foundBy: "heuristic",
            selectorName: "fileAttachedIndicator",
            selectorValue: selector
          };
        }
      }

      await delay(profile.timing.pollIntervalMs);
    }

    await emitWorkflowEvent(context, TELEMETRY_EVENTS.DEEPSEEK_FILE_ATTACH_CONFIRMATION_SKIPPED, "warn", "File attachment confirmation skipped", {
      selectorName: "fileAttachedIndicator",
      selectorValue: selector,
      foundBy: "none",
      expected: "A visible attachment indicator or Excel card near the composer.",
      actual: "No attachment confirmation was detected before timeout."
    });

    return null;
  }

  function attachFileThroughInput(fileInput, filePayload) {
    const file = base64ToFile(filePayload);
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event("input", { bubbles: true }));
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    return file;
  }

  async function testAllSelectors(options) {
    const profile = options.profile;
    const traceId = options.traceId;
    const results = [];
    const keys = Object.keys(profile.selectors || {});

    for (const key of keys) {
      results.push(await Selectors.testSelector({
        selectorName: key,
        selector: profile.selectors[key]
      }));
    }

    return {
      status: "completed",
      traceId: traceId,
      selectorHealth: results
    };
  }

  async function runMainAutomation(options) {
    const profile = options.profile;
    const input = options.input || {};
    const traceId = options.traceId;
    const workflowInput = {
      dryRun: Boolean(input.dryRun),
      filePath: input.filePath || "",
      promptText: input.promptText || "",
      waitForResponse: Boolean(input.waitForResponse),
      filePayload: input.filePayload || null,
      selectedFile: input.selectedFile || null
    };

    const steps = [
      {
        name: "validate_input",
        description: "Validate selectors and workflow inputs for the DeepSeek workflow",
        expected: "Required selectors, file payload, and prompt text should be present.",
        run: async function runStep(context) {
          context.fileExtension = getFileExtension(
            workflowInput.filePath,
            workflowInput.filePayload && workflowInput.filePayload.name
          );
          context.promptLength = workflowInput.promptText.length;
          const missingSelectors = requiredSelectorsForMainWorkflow.filter(function missingRequired(key) {
            return !profile.selectors[key];
          });
          if (missingSelectors.length) {
            throw buildWorkflowError("PROFILE_INVALID", "Required selectors are missing.", {
              profile: profile,
              expected: "The site profile must define the selectors required by the DeepSeek workflow.",
              actual: "Missing selector keys: " + missingSelectors.join(", "),
              nextChecks: [
                "Open the Site Profile tab and configure the missing selectors.",
                "Run Test All before trying the workflow again."
              ]
            });
          }
          if (!workflowInput.promptText) {
            throw buildWorkflowError("PROMPT_REQUIRED", "Prompt text is required.", {
              profile: profile,
              expected: "A non-empty prompt text should be provided.",
              actual: "No prompt text was supplied."
            });
          }
          if (!workflowInput.dryRun && !workflowInput.filePayload) {
            throw buildWorkflowError("FILE_PAYLOAD_REQUIRED", "File payload is required for upload.", {
              profile: profile,
              expected: "A serialized file payload from the Python gateway should be available.",
              actual: "No file payload was supplied to the content workflow."
            });
          }

          const expectedExtensions = profile.behavior.expectedFileExtensions || [];
          if (context.fileExtension && expectedExtensions.length && expectedExtensions.indexOf(context.fileExtension) === -1) {
            throw buildWorkflowError("FILE_EXTENSION_NOT_ALLOWED", "The selected file extension is not allowed by the profile.", {
              profile: profile,
              expected: "One of: " + expectedExtensions.join(", "),
              actual: context.fileExtension
            });
          }

          await emitWorkflowEvent(context, TELEMETRY_EVENTS.DEEPSEEK_WORKFLOW_STARTED, "info", "DeepSeek workflow started", {
            expected: "The DeepSeek workflow should attach a file, insert the prompt, and click send."
          });
          return {
            dryRun: workflowInput.dryRun,
            promptLength: context.promptLength,
            fileExtension: context.fileExtension
          };
        }
      },
      {
        name: "wait_for_page_ready",
        description: "Wait for the DeepSeek composer to become available",
        expected: "A visible chat input should appear on the page.",
        run: async function runStep(context) {
          await delay(profile.timing.afterPageLoadDelayMs);
          const chatInputMatch = await waitForElement({
            selectorName: "chatInput",
            selector: profile.selectors.chatInput,
            fallbackSelectorName: "chatInputFallback",
            fallbackSelector: profile.selectors.chatInputFallback,
            timeoutMs: profile.timing.chatInputReadyTimeoutMs,
            pollIntervalMs: profile.timing.pollIntervalMs
          });

          if (!chatInputMatch) {
            throw buildWorkflowError("CHAT_INPUT_NOT_FOUND", "The DeepSeek chat input could not be found.", {
              profile: profile,
              expected: "A visible chat input should be available on the page.",
              actual: "Neither the primary nor fallback chat input selector matched before timeout.",
              selectorName: "chatInput",
              selector: profile.selectors.chatInput
            });
          }

          context.chatInput = chatInputMatch.element;
          await emitWorkflowEvent(context, TELEMETRY_EVENTS.DEEPSEEK_PAGE_READY, "info", "DeepSeek page is ready", {
            selectorName: chatInputMatch.selectorName,
            selectorValue: chatInputMatch.selectorValue,
            foundBy: chatInputMatch.foundBy
          });
          await emitWorkflowEvent(context, TELEMETRY_EVENTS.DEEPSEEK_CHAT_INPUT_FOUND, "info", "Chat input found", {
            selectorName: chatInputMatch.selectorName,
            selectorValue: chatInputMatch.selectorValue,
            foundBy: chatInputMatch.foundBy
          });

          return {
            foundBy: chatInputMatch.foundBy,
            selectorName: chatInputMatch.selectorName
          };
        }
      },
      {
        name: "attach_file",
        description: "Attach the Excel file through the DeepSeek file input",
        expected: "The file input should accept the Excel file and expose it to the page.",
        run: async function runStep(context) {
          const fileInputMatch = await waitForElement({
            selectorName: "fileInput",
            selector: profile.selectors.fileInput,
            timeoutMs: profile.timing.fileAttachTimeoutMs,
            pollIntervalMs: profile.timing.pollIntervalMs
          });

          if (!fileInputMatch) {
            throw buildWorkflowError("FILE_INPUT_NOT_FOUND", "The DeepSeek file input could not be found.", {
              profile: profile,
              expected: "A file input should be available for the attachment step.",
              actual: "No visible file input matched before timeout.",
              selectorName: "fileInput",
              selector: profile.selectors.fileInput
            });
          }

          context.fileInput = fileInputMatch.element;
          await emitWorkflowEvent(context, TELEMETRY_EVENTS.DEEPSEEK_FILE_INPUT_FOUND, "info", "File input found", {
            selectorName: fileInputMatch.selectorName,
            selectorValue: fileInputMatch.selectorValue,
            foundBy: fileInputMatch.foundBy
          });

          if (workflowInput.dryRun) {
            return {
              skipped: true,
              reason: "dry_run"
            };
          }

          await emitWorkflowEvent(context, TELEMETRY_EVENTS.DEEPSEEK_FILE_ATTACH_STARTED, "info", "File attachment started", {
            selectorName: fileInputMatch.selectorName,
            selectorValue: fileInputMatch.selectorValue,
            foundBy: fileInputMatch.foundBy
          });

          const attachedFile = attachFileThroughInput(fileInputMatch.element, workflowInput.filePayload);
          await delay(profile.timing.afterFileAttachDelayMs);

          context.attachedFile = attachedFile;
          return {
            attached: true,
            fileName: attachedFile.name,
            sizeBytes: attachedFile.size
          };
        }
      },
      {
        name: "confirm_attachment",
        description: "Confirm that the attached file is visible or accept a timed fallback",
        expected: "DeepSeek should expose an attachment signal after file upload.",
        run: async function runStep(context) {
          if (workflowInput.dryRun) {
            return {
              skipped: true,
              reason: "dry_run"
            };
          }

          const attachmentMatch = await waitForAttachedIndicator(profile, context);
          if (attachmentMatch) {
            await emitWorkflowEvent(context, TELEMETRY_EVENTS.DEEPSEEK_FILE_ATTACHED_CONFIRMED, "info", "File attachment confirmed", {
              selectorName: attachmentMatch.selectorName,
              selectorValue: attachmentMatch.selectorValue,
              foundBy: attachmentMatch.foundBy
            });
            return {
              confirmed: true,
              foundBy: attachmentMatch.foundBy
            };
          }

          if (profile.behavior.requireFileAttachedIndicator) {
            throw buildWorkflowError("FILE_ATTACHMENT_NOT_CONFIRMED", "The attachment could not be confirmed.", {
              profile: profile,
              expected: "A visible attachment indicator should appear after the file upload.",
              actual: "No selector or heuristic confirmation was found before timeout.",
              selectorName: "fileAttachedIndicator",
              selector: profile.selectors.fileAttachedIndicator
            });
          }

          return {
            confirmed: false,
            continuedWithWarning: true
          };
        }
      },
      {
        name: "insert_prompt",
        description: "Insert the prompt into the DeepSeek chat input",
        expected: "The chat input should receive the prompt text and reflect it in the composer.",
        run: async function runStep(context) {
          await emitWorkflowEvent(context, TELEMETRY_EVENTS.DEEPSEEK_PROMPT_INSERT_STARTED, "info", "Prompt insertion started", {
            selectorName: "chatInput",
            selectorValue: profile.selectors.chatInput
          });

          DomHelpers.setNativeValue(context.chatInput, workflowInput.promptText);
          await delay(profile.timing.afterPromptInsertDelayMs);

          if (!String(context.chatInput.value || "").length) {
            throw buildWorkflowError("PROMPT_INSERT_FAILED", "The prompt did not appear in the chat input.", {
              profile: profile,
              expected: "The chat input should contain the provided prompt text.",
              actual: "The chat input value is still empty after insertion."
            });
          }

          await emitWorkflowEvent(context, TELEMETRY_EVENTS.DEEPSEEK_PROMPT_INSERT_COMPLETED, "info", "Prompt insertion completed", {
            selectorName: "chatInput",
            selectorValue: profile.selectors.chatInput
          });

          return {
            inserted: true,
            promptLength: workflowInput.promptText.length
          };
        }
      },
      {
        name: "find_send_button",
        description: "Locate an enabled send button near the composer",
        expected: "A clickable send button should be found before submit.",
        run: async function runStep(context) {
          const startedAt = Date.now();
          let sendMatch = null;

          while (Date.now() - startedAt < profile.timing.sendButtonReadyTimeoutMs) {
            const selectorButton = queryVisibleElement(profile.selectors.sendButton);
            if (isEnabled(selectorButton)) {
              sendMatch = {
                element: selectorButton,
                foundBy: "profile-selector",
                selectorName: "sendButton",
                selectorValue: profile.selectors.sendButton
              };
              break;
            }

            if (profile.behavior.enableHeuristicFallbacks) {
              const heuristicButton = findSendButtonByHeuristic(profile);
              if (isEnabled(heuristicButton)) {
                sendMatch = {
                  element: heuristicButton,
                  foundBy: "heuristic",
                  selectorName: "sendButton",
                  selectorValue: profile.selectors.sendButton
                };
                break;
              }
            }

            await delay(profile.timing.pollIntervalMs);
          }

          if (!sendMatch) {
            throw buildWorkflowError("SEND_BUTTON_NOT_FOUND", "The send button could not be found or was disabled.", {
              profile: profile,
              expected: "A visible and enabled send button should be available near the composer.",
              actual: "No enabled send button was found before timeout.",
              selectorName: "sendButton",
              selector: profile.selectors.sendButton
            });
          }

          context.sendButton = sendMatch.element;
          await emitWorkflowEvent(
            context,
            sendMatch.foundBy === "heuristic" ? TELEMETRY_EVENTS.DEEPSEEK_SEND_BUTTON_HEURISTIC_USED : TELEMETRY_EVENTS.DEEPSEEK_SEND_BUTTON_FOUND,
            sendMatch.foundBy === "heuristic" ? "warn" : "info",
            sendMatch.foundBy === "heuristic" ? "Send button located by heuristic" : "Send button found",
            {
              selectorName: sendMatch.selectorName,
              selectorValue: sendMatch.selectorValue,
              foundBy: sendMatch.foundBy
            }
          );

          return {
            foundBy: sendMatch.foundBy
          };
        }
      },
      {
        name: "click_send",
        description: "Click the send button to submit the message",
        expected: "The send button click should dispatch the DeepSeek prompt with attachment.",
        run: async function runStep(context) {
          if (workflowInput.dryRun) {
            return {
              skipped: true,
              reason: "dry_run"
            };
          }

          const clicked = DomHelpers.clickElement(context.sendButton);
          if (!clicked) {
            throw buildWorkflowError("SEND_CLICK_FAILED", "The send button could not be clicked.", {
              profile: profile,
              expected: "The send button should be clickable.",
              actual: "clickElement returned false."
            });
          }

          await delay(profile.timing.afterSendClickDelayMs);
          await emitWorkflowEvent(context, TELEMETRY_EVENTS.DEEPSEEK_SEND_CLICKED, "info", "Send button clicked", {
            selectorName: "sendButton",
            selectorValue: profile.selectors.sendButton
          });

          return {
            clicked: true
          };
        }
      },
      {
        name: "finalize",
        description: "Return a compact workflow summary for diagnostics",
        expected: "The workflow should finish with an explainable summary.",
        run: async function runStep(context) {
          await emitWorkflowEvent(context, TELEMETRY_EVENTS.DEEPSEEK_WORKFLOW_COMPLETED, "info", "DeepSeek workflow completed", {
            step: "finalize"
          });
          return {
            dryRun: workflowInput.dryRun,
            finalPageState: PageState.detectPageState(profile),
            pageSummary: DomHelpers.getPageSummary()
          };
        }
      }
    ];

    const result = await WorkflowRunner.runWorkflow({
      siteId: "deepseek",
      workflowName: workflowInput.dryRun ? "deepseek_dry_run" : "deepseek_excel_chat",
      traceId: traceId,
      input: {
        dryRun: workflowInput.dryRun,
        filePath: workflowInput.filePath,
        promptLength: workflowInput.promptText.length,
        waitForResponse: workflowInput.waitForResponse
      },
      steps: steps
    });

    if (result.status === "failed") {
      const diagnosticPackage = {
        traceId: traceId,
        workflowId: result.workflowId,
        url: location.href,
        title: document.title,
        failedStep: result.failedStep,
        expected: result.error ? result.error.expected : "",
        actual: result.error ? result.error.actual : "",
        profileSnapshot: profile,
        selectorHealth: await collectSelectorHealth(profile),
        error: result.error || null,
        selectedFile: workflowInput.selectedFile || null
      };
      Object.assign(diagnosticPackage, buildComposerDiagnosticSnapshot(profile));

      await emitWorkflowEvent({
        traceId: traceId,
        workflowId: result.workflowId,
        currentStep: result.failedStep,
        fileExtension: getFileExtension(workflowInput.filePath, workflowInput.filePayload && workflowInput.filePayload.name),
        promptLength: workflowInput.promptText.length
      }, TELEMETRY_EVENTS.DEEPSEEK_DIAGNOSTIC_PACKAGE_CREATED, "warn", "DeepSeek diagnostic package created", {
        expected: diagnosticPackage.expected,
        actual: diagnosticPackage.actual
      });

      await emitWorkflowEvent({
        traceId: traceId,
        workflowId: result.workflowId,
        currentStep: result.failedStep,
        fileExtension: getFileExtension(workflowInput.filePath, workflowInput.filePayload && workflowInput.filePayload.name),
        promptLength: workflowInput.promptText.length
      }, TELEMETRY_EVENTS.DEEPSEEK_WORKFLOW_FAILED, "error", "DeepSeek workflow failed", {
        expected: diagnosticPackage.expected,
        actual: diagnosticPackage.actual
      });

      result.diagnosticPackage = diagnosticPackage;
      return result;
    }

    result.diagnosticPackage = null;
    return result;
  }

  DeepSeekAutomation.ChatAutomator = {
    runMainAutomation: runMainAutomation,
    testAllSelectors: testAllSelectors
  };
})(globalThis);
