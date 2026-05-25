(function initDeepSeekChatAutomatorSteps(globalScope) {
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};

  function buildSteps(options) {
    const profile = options.profile;
    const workflowInput = options.workflowInput;
    const helpers = options.helpers || {};
    const buildWorkflowError = helpers.buildWorkflowError;
    const buildComposerDiagnosticSnapshot = helpers.buildComposerDiagnosticSnapshot;
    const buildSendButtonReadyEvidence = helpers.buildSendButtonReadyEvidence;
    const waitForAttachmentReady = helpers.waitForAttachmentReady;
    const waitForComposerReadyToSend = helpers.waitForComposerReadyToSend;
    const waitForElement = helpers.waitForElement;
    const attachFileThroughInput = helpers.attachFileThroughInput;
    const emitWorkflowEvent = helpers.emitWorkflowEvent;
    const getFileExtension = helpers.getFileExtension;
    const requiredSelectorsForMainWorkflow = helpers.requiredSelectorsForMainWorkflow || [];
    const delay = helpers.delay;
    const DomHelpers = helpers.DomHelpers;
    const PageState = helpers.PageState;
    const ComposerProbe = helpers.ComposerProbe;
    const ResponseCapture = helpers.ResponseCapture;
    const DiagnosticStore = helpers.DiagnosticStore;
    const WorkflowStateTracker = helpers.WorkflowStateTracker;
    const TELEMETRY_EVENTS = helpers.TELEMETRY_EVENTS;

    return [
      {
        name: "validate_input",
        stage: "validate_input",
        description: "Validate selectors and workflow inputs for the DeepSeek workflow",
        expected: "Required selectors, file payload, and prompt text should be present.",
        run: async function runStep(context) {
          context.fileExtension = getFileExtension(
            workflowInput.filePath,
            workflowInput.filePayload && workflowInput.filePayload.name
          );
          context.promptLength = workflowInput.promptText.length;
          const requiredSelectors = requiredSelectorsForMainWorkflow.filter(function onlyRequired(key) {
            return workflowInput.attachFile || key !== "fileInput";
          });
          const missingSelectors = requiredSelectors.filter(function missingRequired(key) {
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
          if (!workflowInput.dryRun && workflowInput.attachFile && !workflowInput.filePayload) {
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
        stage: "page_ready",
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
          await DiagnosticStore.recordRuntimeSnapshot(buildComposerDiagnosticSnapshot(profile));

          return {
            foundBy: chatInputMatch.foundBy,
            selectorName: chatInputMatch.selectorName,
            selectorValue: chatInputMatch.selectorValue,
            actual: "A visible chat input was found and is ready."
          };
        }
      },
      {
        name: "attach_file",
        stage: "file_attachment",
        description: "Attach the Excel file through the DeepSeek file input",
        expected: "The file input should accept the Excel file and expose it to the page.",
        run: async function runStep(context) {
          if (workflowInput.dryRun) {
            return {
              skipped: true,
              reason: "dry_run"
            };
          }

          if (!workflowInput.attachFile) {
            return {
              skipped: true,
              reason: "attach_file_disabled",
              actual: "The workflow explicitly skipped file attachment for this prompt turn."
            };
          }

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
            sizeBytes: attachedFile.size,
            selectorName: fileInputMatch.selectorName,
            selectorValue: fileInputMatch.selectorValue,
            foundBy: fileInputMatch.foundBy,
            actual: "The file input accepted the selected file."
          };
        }
      },
      {
        name: "wait_for_attachment_ready",
        stage: "file_attachment",
        description: "Wait until the selected Excel attachment is visibly ready near the composer",
        expected: "The attachment should match the selected file name, include an Excel indicator, show no upload progress, and remain stable before prompt insertion.",
        run: async function runStep(context) {
          if (workflowInput.dryRun) {
            return {
              skipped: true,
              reason: "dry_run"
            };
          }

          if (!workflowInput.attachFile) {
            return {
              skipped: true,
              reason: "attach_file_disabled",
              actual: "Attachment readiness was skipped because this prompt turn does not require a file."
            };
          }

          let readiness;
          try {
            readiness = await waitForAttachmentReady(profile, workflowInput, context);
          } catch (error) {
            if (!(profile.behavior && profile.behavior.requireAttachmentReadyBeforePrompt === false)
              || !error
              || error.code !== "FILE_ATTACHMENT_NOT_READY") {
              throw error;
            }
            return {
              attachmentReady: false,
              continuedWithWarning: true,
              selectorName: error.selectorName || "fileAttachedIndicator",
              selectorValue: error.selector || profile.selectors.fileAttachedIndicator,
              snapshot: error.snapshot || error.pageSummary || null,
              actual: "The attachment was not fully ready, but the profile allowed the workflow to continue."
            };
          }

          await emitWorkflowEvent(context, TELEMETRY_EVENTS.DEEPSEEK_FILE_ATTACHED_CONFIRMED, "info", "Attachment readiness confirmed", {
            selectorName: readiness.selectorName,
            selectorValue: readiness.selectorValue,
            foundBy: readiness.foundBy,
            actual: readiness.actual
          });
          return {
            attachmentReady: true,
            foundBy: readiness.foundBy,
            selectorName: readiness.selectorName,
            selectorValue: readiness.selectorValue,
            snapshot: readiness.snapshot,
            actual: readiness.actual
          };
        }
      },
      {
        name: "insert_prompt",
        stage: "prompt_insert",
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
            promptLength: workflowInput.promptText.length,
            selectorName: "chatInput",
            selectorValue: profile.selectors.chatInput,
            actual: "The prompt text is visible in the composer."
          };
        }
      },
      {
        name: "wait_for_composer_ready_to_send",
        stage: "submit",
        description: "Wait until attachment, prompt, and send button are all ready in the same polling cycle",
        expected: "Attachment readiness, prompt readiness, and send button readiness should all be true before clicking send.",
        run: async function runStep(context) {
          if (workflowInput.dryRun) {
            return {
              skipped: true,
              reason: "dry_run"
            };
          }

          await emitWorkflowEvent(context, TELEMETRY_EVENTS.DEEPSEEK_SEND_BUTTON_SEARCH_STARTED, "info", "Composer ready-to-send search started", {
            selectorName: "sendButton",
            selectorValue: profile.selectors.sendButton,
            expected: "Attachment, prompt, and send button should all be ready before clicking send."
          });

          let readiness;
          try {
            readiness = await waitForComposerReadyToSend(profile, workflowInput, context);
          } catch (error) {
            if (!(profile.behavior && profile.behavior.requireComposerReadyBeforeSend === false)
              || !error
              || error.code !== "COMPOSER_NOT_READY_TO_SEND") {
              throw error;
            }
            return {
              ready: false,
              continuedWithWarning: true,
              selectorName: error.selectorName || "sendButton",
              selectorValue: error.selector || profile.selectors.sendButton,
              snapshot: error.snapshot || error.pageSummary || null,
              actual: "The composer was not fully ready, but the profile allowed the workflow to continue."
            };
          }

          await DiagnosticStore.recordSendButtonEvidence(Object.assign({
            traceId: context.traceId,
            workflowId: context.workflowId,
            selectorName: "sendButton",
            selectorValue: profile.selectors.sendButton,
            foundBy: readiness.foundBy
          }, readiness.snapshot.sendButtonEvidence || {}));
          await emitWorkflowEvent(
            context,
            readiness.foundBy === "heuristic" ? TELEMETRY_EVENTS.DEEPSEEK_SEND_BUTTON_HEURISTIC_USED : TELEMETRY_EVENTS.DEEPSEEK_SEND_BUTTON_FOUND,
            readiness.foundBy === "heuristic" ? "warn" : "info",
            readiness.foundBy === "heuristic" ? "Send button readiness confirmed by heuristic" : "Send button readiness confirmed",
            {
              selectorName: readiness.selectorName,
              selectorValue: readiness.selectorValue,
              foundBy: readiness.foundBy,
              actual: readiness.actual
            }
          );

          return {
            ready: true,
            foundBy: readiness.foundBy,
            selectorName: readiness.selectorName,
            selectorValue: readiness.selectorValue,
            snapshot: readiness.snapshot,
            actual: readiness.actual
          };
        }
      },
      {
        name: "click_send",
        stage: "submit",
        description: "Click the send button to submit the message",
        expected: "The send button click should dispatch the DeepSeek prompt with attachment.",
        run: async function runStep(context) {
          if (workflowInput.dryRun) {
            return {
              skipped: true,
              reason: "dry_run"
            };
          }

          const liveSendButtonEvidence = buildSendButtonReadyEvidence(profile, workflowInput, context);
          const liveCandidateIdentity = liveSendButtonEvidence.selectedCandidate
            ? liveSendButtonEvidence.selectedCandidate.candidateIdentity || ""
            : "";
          const storedCandidateIdentity = context.sendButtonCandidateIdentity || "";

          if (!liveSendButtonEvidence.sendButtonCandidateFound || !liveSendButtonEvidence.sendButtonReady || !liveSendButtonEvidence.element) {
            throw buildWorkflowError("SEND_BUTTON_NOT_READY_AT_CLICK", "The selected send button was no longer ready at click time.", {
              profile: profile,
              failedStage: "submit",
              expected: "The same send button selected by the ready gate should still be present and enabled before click.",
              actual: liveSendButtonEvidence.sendButtonCandidateFound
                ? "A send-button candidate still exists, but it is no longer ready."
                : "No valid send-button candidate could be re-resolved before click.",
              selectorName: "sendButton",
              selector: profile.selectors.sendButton,
              snapshot: Object.assign({}, liveSendButtonEvidence, { element: undefined })
            });
          }

          if (storedCandidateIdentity && liveCandidateIdentity && storedCandidateIdentity !== liveCandidateIdentity) {
            throw buildWorkflowError("SEND_BUTTON_CANDIDATE_CHANGED", "The send-button candidate changed after the ready gate passed.", {
              profile: profile,
              failedStage: "submit",
              expected: "The click step should target the same logical send-button candidate selected by the ready gate.",
              actual: "The re-resolved send-button candidate no longer matched the candidate identity captured at readiness time.",
              selectorName: "sendButton",
              selector: profile.selectors.sendButton,
              snapshot: {
                expectedCandidateIdentity: storedCandidateIdentity,
                actualCandidateIdentity: liveCandidateIdentity,
                liveSendButtonEvidence: Object.assign({}, liveSendButtonEvidence, { element: undefined })
              }
            });
          }

          context.sendButton = liveSendButtonEvidence.element;
          context.sendButtonEvidence = Object.assign({}, liveSendButtonEvidence, { element: undefined });
          const beforeClickSnapshot = DomHelpers.getElementSummary(context.sendButton);
          const preClickProbe = ComposerProbe.probeComposerReadyToSend(profile, workflowInput, context);
          await DiagnosticStore.recordGateSnapshot({
            traceId: context.traceId,
            workflowId: context.workflowId,
            workflowName: context.workflowName,
            runKind: WorkflowStateTracker.inferRunKind(context.workflowName),
            gateName: "click_send",
            stepName: "click_send",
            stage: "submit",
            status: "observed",
            attempt: 1,
            elapsedMs: 0,
            blockingCondition: preClickProbe.blockingCondition || "",
            snapshot: {
              clickSendExecuted: false,
              selectedCandidate: context.sendButtonEvidence && context.sendButtonEvidence.selectedCandidate ? context.sendButtonEvidence.selectedCandidate : null,
              selectedCandidateReason: context.sendButtonEvidence && context.sendButtonEvidence.selectedCandidateReason ? context.sendButtonEvidence.selectedCandidateReason : "",
              preClickComposerProbe: preClickProbe
            }
          });
          const clicked = DomHelpers.clickElement(context.sendButton);
          if (!clicked) {
            await emitWorkflowEvent(context, TELEMETRY_EVENTS.DEEPSEEK_SEND_FAILED, "error", "Send button click failed", {
              selectorName: "sendButton",
              selectorValue: profile.selectors.sendButton,
              actual: "clickElement returned false."
            });
            throw buildWorkflowError("SEND_CLICK_FAILED", "The send button could not be clicked.", {
              profile: profile,
              failedStage: "submit",
              expected: "The send button should be clickable.",
              actual: "clickElement returned false."
            });
          }

          await delay(profile.timing.afterSendClickDelayMs);
          await emitWorkflowEvent(context, TELEMETRY_EVENTS.DEEPSEEK_SEND_CLICKED, "info", "Send button clicked", {
            selectorName: "sendButton",
            selectorValue: profile.selectors.sendButton
          });
          await DiagnosticStore.recordGateSnapshot({
            traceId: context.traceId,
            workflowId: context.workflowId,
            workflowName: context.workflowName,
            runKind: WorkflowStateTracker.inferRunKind(context.workflowName),
            gateName: "click_send",
            stepName: "click_send",
            stage: "submit",
            status: "passed",
            attempt: 1,
            elapsedMs: 0,
            blockingCondition: "",
            snapshot: {
              clickSendExecuted: true,
              clickedCandidate: context.sendButtonEvidence && context.sendButtonEvidence.selectedCandidate ? context.sendButtonEvidence.selectedCandidate : beforeClickSnapshot,
              beforeClick: beforeClickSnapshot,
              afterClick: DomHelpers.getElementSummary(context.sendButton)
            }
          });

          return {
            clicked: true,
            selectorName: "sendButton",
            selectorValue: profile.selectors.sendButton,
            snapshot: {
              clickedCandidate: context.sendButtonEvidence && context.sendButtonEvidence.selectedCandidate ? context.sendButtonEvidence.selectedCandidate : beforeClickSnapshot,
              beforeClick: beforeClickSnapshot,
              afterClick: DomHelpers.getElementSummary(context.sendButton)
            },
            actual: "The send button click was dispatched."
          };
        }
      },
      {
        name: "verify_submit_effect",
        stage: "submit",
        description: "Observe whether the send click produced a submit effect",
        expected: "A post-click submit effect should be visible or the composer state should change after send.",
        run: async function runStep(context) {
          if (workflowInput.dryRun) {
            return {
              skipped: true,
              reason: "dry_run"
            };
          }

          const submitEffectSnapshot = ComposerProbe.probeSubmitEffect(profile, workflowInput, context);
          await DiagnosticStore.recordGateSnapshot({
            traceId: context.traceId,
            workflowId: context.workflowId,
            workflowName: context.workflowName,
            runKind: WorkflowStateTracker.inferRunKind(context.workflowName),
            gateName: "verify_submit_effect",
            stepName: "verify_submit_effect",
            stage: "submit",
            status: submitEffectSnapshot.submitEffectObserved ? "passed" : "failed",
            attempt: 1,
            elapsedMs: 0,
            blockingCondition: submitEffectSnapshot.blockingCondition || "",
            snapshot: submitEffectSnapshot
          });
          await DiagnosticStore.recordCausalEvidence({
            traceId: context.traceId,
            workflowId: context.workflowId,
            workflowName: context.workflowName,
            runKind: WorkflowStateTracker.inferRunKind(context.workflowName),
            gateName: "verify_submit_effect",
            stepName: "verify_submit_effect",
            stage: "submit",
            status: submitEffectSnapshot.submitEffectObserved ? "passed" : "failed",
            attempt: 1,
            elapsedMs: 0,
            blockingCondition: submitEffectSnapshot.blockingCondition || "",
            snapshot: submitEffectSnapshot
          });
          return {
            submitEffectObserved: submitEffectSnapshot.submitEffectObserved,
            snapshot: submitEffectSnapshot,
            actual: submitEffectSnapshot.submitEffectObserved
              ? "A post-click submit effect was observed."
              : "No post-click submit effect was observed."
          };
        }
      },
      {
        name: "wait_for_deepseek_response_complete",
        stage: "response_capture",
        description: "Wait for the DeepSeek assistant response to finish and become text-stable",
        expected: "The latest visible DeepSeek assistant response should appear and remain stable before capture completes.",
        run: async function runStep(context) {
          if (workflowInput.dryRun) {
            return {
              skipped: true,
              reason: "dry_run",
              actual: "Response capture was skipped during dry run."
            };
          }

          if (!workflowInput.waitForResponse) {
            return {
              skipped: true,
              reason: "wait_for_response_disabled",
              actual: "Response capture was skipped because waitForResponse was disabled."
            };
          }

          const capturedResponse = await ResponseCapture.waitForFinalResponse(profile, workflowInput, context);
          context.capturedResponse = capturedResponse;

          return {
            responseCaptured: true,
            capturedResponse: capturedResponse,
            selectorName: "assistantMessageSelector",
            selectorValue: capturedResponse.selectorUsed,
            snapshot: {
              selectorUsed: capturedResponse.selectorUsed,
              selectedMessageIndex: capturedResponse.selectedMessageIndex,
              textLength: capturedResponse.textLength,
              stabilityMs: capturedResponse.stabilityMs,
              elapsedMs: capturedResponse.elapsedMs,
              completionSignals: capturedResponse.completionSignals
            },
            actual: "The DeepSeek assistant response became stable and was captured."
          };
        }
      },
      {
        name: "finalize",
        stage: "finalize",
        description: "Return a compact workflow summary for diagnostics",
        expected: "The workflow should finish with an explainable summary.",
        run: async function runStep(context) {
          await emitWorkflowEvent(context, TELEMETRY_EVENTS.DEEPSEEK_WORKFLOW_COMPLETED, "info", "DeepSeek workflow completed", {
            step: "finalize"
          });
          return {
            dryRun: workflowInput.dryRun,
            responseCapture: context.capturedResponse ? {
              captured: true,
              textLength: context.capturedResponse.textLength,
              selectorUsed: context.capturedResponse.selectorUsed,
              completionSignals: context.capturedResponse.completionSignals
            } : {
              captured: false,
              waitForResponse: workflowInput.waitForResponse
            },
            finalPageState: PageState.detectPageState(profile),
            pageSummary: DomHelpers.getPageSummary(),
            actual: "The workflow finished and returned a final page summary."
          };
        }
      }
    ];
  }

  DeepSeekAutomation.ChatAutomatorSteps = {
    buildSteps: buildSteps
  };
})(globalThis);
