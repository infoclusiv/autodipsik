(function initDeepSeekChatAutomator(globalScope) {
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const siteConfig = DeepSeekAutomation.DEEPSEEK_CONFIG;
  const Selectors = DeepSeekAutomation.DeepSeekSelectors;
  const DomHelpers = DeepSeekAutomation.DeepSeekDomHelpers;
  const PageState = DeepSeekAutomation.DeepSeekPageState;
  const FilePayloadHelpers = DeepSeekAutomation.FilePayloadHelpers;
  const WorkflowRunner = NewSiteCore.WorkflowRunner;
  const Errors = NewSiteCore.Errors;
  const Telemetry = NewSiteCore.Telemetry;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const DiagnosticStore = NewSiteCore.DiagnosticStore;
  const WorkflowStateTracker = NewSiteCore.WorkflowStateTracker;
  const ComposerProbe = DeepSeekAutomation.DeepSeekComposerProbe;
  const Readiness = DeepSeekAutomation.ChatAutomatorReadiness;
  const ResponseCapture = DeepSeekAutomation.DeepSeekResponseCapture;
  const ChatAutomatorSteps = DeepSeekAutomation.ChatAutomatorSteps;

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

  function getSelectedFileName(input, context) {
    if (context && context.attachedFile && context.attachedFile.name) {
      return context.attachedFile.name;
    }
    if (input && input.selectedFile && input.selectedFile.name) {
      return input.selectedFile.name;
    }
    if (input && input.filePayload && input.filePayload.name) {
      return input.filePayload.name;
    }
    const filePath = input && input.filePath ? String(input.filePath) : "";
    if (!filePath) {
      return "";
    }
    const segments = filePath.split(/[\\/]/);
    return segments[segments.length - 1] || "";
  }

  function normalizeFileNameForMatch(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function getComposerRect(profile) {
    const textarea = getTextareaForHeuristic(profile);
    return textarea ? textarea.getBoundingClientRect() : null;
  }

  function isElementNearComposerRect(rect, composerRect) {
    if (!rect) {
      return false;
    }
    if (!composerRect) {
      return rect.x >= 0 && rect.x <= window.innerWidth && rect.y >= 150 && rect.y <= window.innerHeight;
    }

    const horizontallyAligned = rect.right >= composerRect.left - 120
      && rect.left <= composerRect.right + 120;
    const verticallyNear = rect.bottom >= composerRect.top - 220
      && rect.top <= composerRect.bottom + 220;
    return horizontallyAligned && verticallyNear;
  }

  function getAttachmentCandidateText(element) {
    return String(element && (element.innerText || element.textContent || "") || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function findAttachmentCandidatesNearComposer(profile) {
    const composerRect = getComposerRect(profile);
    const seen = new Set();
    const selectorElements = Selectors.queryAllSafe(profile.selectors.fileAttachedIndicator || "");
    const bodyElements = Array.from(document.querySelectorAll("body *"));

    return selectorElements.concat(bodyElements)
      .filter(function keepCandidate(element) {
        if (!element || seen.has(element)) {
          return false;
        }
        seen.add(element);
        if (!Selectors.isElementVisible(element)) {
          return false;
        }
        const rect = element.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 16) {
          return false;
        }
        if (!isElementNearComposerRect(rect, composerRect)) {
          return false;
        }

        const text = getAttachmentCandidateText(element).toLowerCase();
        const className = String(element.className || "").toLowerCase();
        const ariaLabel = String(element.getAttribute("aria-label") || "").toLowerCase();
        const title = String(element.getAttribute("title") || "").toLowerCase();
        const haystack = [text, className, ariaLabel, title].join(" ");
        return haystack.includes(".xlsx")
          || haystack.includes(".xls")
          || haystack.includes("xlsx")
          || haystack.includes("xls")
          || haystack.includes("attach")
          || haystack.includes("upload")
          || haystack.includes("file");
      })
      .map(function mapCandidate(element) {
        const rect = element.getBoundingClientRect();
        const text = getAttachmentCandidateText(element);
        return {
          element: element,
          rect: rect,
          text: text,
          nearComposer: isElementNearComposerRect(rect, composerRect)
        };
      });
  }

  function isUploadProgressVisibleNearComposer(profile) {
    const composerRect = getComposerRect(profile);
    const progressCandidates = [];
    const selectorElement = queryVisibleElement(profile.selectors.progressIndicator);
    if (selectorElement) {
      progressCandidates.push(selectorElement);
    }

    Array.from(document.querySelectorAll("[role='progressbar'], [aria-busy='true'], [class*='progress' i], [class*='upload' i], [class*='loading' i]"))
      .forEach(function addCandidate(element) {
        progressCandidates.push(element);
      });

    return progressCandidates.some(function matches(element) {
      if (!element || !Selectors.isElementVisible(element)) {
        return false;
      }
      return isElementNearComposerRect(element.getBoundingClientRect(), composerRect);
    });
  }

  function buildAttachmentReadinessSnapshot(profile, workflowInput, context) {
    return ComposerProbe.probeAttachmentState(profile, workflowInput, context);
  }

  function getPromptReadinessEvidence(profile, workflowInput, context) {
    return ComposerProbe.probePromptState(profile, workflowInput, context);
  }

  function getCandidateSendButtonScore(element, profile, composerRect) {
    const text = String(element.innerText || element.textContent || "").toLowerCase();
    const ariaLabel = String(element.getAttribute("aria-label") || "").toLowerCase();
    const title = String(element.getAttribute("title") || "").toLowerCase();
    const type = String(element.getAttribute("type") || "").toLowerCase();
    const role = String(element.getAttribute("role") || "").toLowerCase();
    let score = 0;

    try {
      if (profile.selectors.sendButton && element.matches(profile.selectors.sendButton)) {
        score += 100;
      }
    } catch (error) {
      score += 0;
    }

    if (type === "submit") {
      score += 40;
    }
    if (text.includes("send") || ariaLabel.includes("send") || title.includes("send")) {
      score += 35;
    }
    if (element.tagName === "BUTTON") {
      score += 10;
    }
    if (role === "button") {
      score += 5;
    }
    if (composerRect) {
      const rect = element.getBoundingClientRect();
      if (rect.x > composerRect.x + Math.max(0, composerRect.width - 180)) {
        score += 10;
      }
    }
    return score;
  }

  function buildSendButtonReadyEvidence(profile, workflowInput, context) {
    return ComposerProbe.probeSendButtonState(profile, workflowInput, context);
  }

  function buildComposerReadyToSendSnapshot(profile, workflowInput, context) {
    return ComposerProbe.probeComposerReadyToSend(profile, workflowInput, context);
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

  function getVisibleButtonsNearComposer(profile) {
    return ComposerProbe.getVisibleButtonsNearComposer(profile, {});
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
      stage: context.currentStage || "",
      expected: data && data.expected ? data.expected : "",
      actual: data && data.actual ? data.actual : "",
      selectorName: data && data.selectorName ? data.selectorName : "",
      selectorValue: data && data.selectorValue ? data.selectorValue : "",
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
      pageSummary: DomHelpers.getPageSummary(),
      failedStage: details.failedStage || "deepseek_workflow"
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

  async function waitForAttachmentReady(profile, workflowInput, context) {
    const selector = profile.selectors.fileAttachedIndicator;
    const requiredStablePolls = Math.max(1, Number(profile.timing.attachmentStablePollCount) || 1);
    const requiredStableDurationMs = Math.max(0, Number(profile.timing.attachmentStableMinDurationMs) || 0);
    const timeoutMs = Math.max(0, Number(profile.timing.attachmentReadyTimeoutMs) || profile.timing.fileAttachTimeoutMs || 0);
    const pollIntervalMs = Math.max(1, Number(profile.timing.pollIntervalMs) || 200);
    const startedAt = Date.now();
    let stableDetections = 0;
    let stableSince = 0;
    let lastReadySnapshot = null;
    let lastSnapshot = null;

    context.attachmentConfirmStartedAt = startedAt;
    context.attachmentConfirmAttempts = 0;

    while (Date.now() - startedAt < timeoutMs) {
      context.attachmentConfirmAttempts += 1;
      const baseSnapshot = buildAttachmentReadinessSnapshot(profile, workflowInput, context);
      const readinessSatisfied = Readiness.isAttachmentReadinessSatisfied(baseSnapshot);

      if (readinessSatisfied) {
        stableDetections += 1;
        if (!stableSince) {
          stableSince = Date.now();
        }
      } else {
        stableDetections = 0;
        stableSince = 0;
      }

      const stableDurationMs = stableSince ? Date.now() - stableSince : 0;
      const selectorElement = queryVisibleElement(selector);
      const foundBy = selectorElement
        ? "profile-selector"
        : (readinessSatisfied ? "heuristic" : "none");

      const snapshot = Object.assign({}, baseSnapshot, {
        attachmentReady: readinessSatisfied
          && stableDetections >= requiredStablePolls
          && stableDurationMs >= requiredStableDurationMs,
        stableDetections: stableDetections,
        stableDurationMs: stableDurationMs,
        requiredStablePollCount: requiredStablePolls,
        requiredStableMinDurationMs: requiredStableDurationMs,
        selectorName: "fileAttachedIndicator",
        selectorValue: selector,
        foundBy: foundBy,
        attachmentElementSummary: baseSnapshot.attachmentElementSummary || (selectorElement ? DomHelpers.getElementSummary(selectorElement) : null),
        matchedText: baseSnapshot.matchedText || (selectorElement ? getAttachmentCandidateText(selectorElement) : ""),
        readinessFailures: []
      });
      snapshot.readinessFailures = Readiness.appendAttachmentStabilityFailures(
        snapshot,
        Readiness.listAttachmentReadinessFailures(baseSnapshot)
      );
      snapshot.blockingCondition = snapshot.attachmentReady
        ? ""
        : (baseSnapshot.blockingCondition || (snapshot.uploadProgressVisible ? "uploadProgressVisible" : "attachmentReady"));

      lastSnapshot = snapshot;
      await DiagnosticStore.recordGateSnapshot({
        traceId: context.traceId,
        workflowId: context.workflowId,
        workflowName: context.workflowName,
        runKind: WorkflowStateTracker.inferRunKind(context.workflowName),
        gateName: "wait_for_attachment_ready",
        stepName: "wait_for_attachment_ready",
        stage: "file_attachment",
        status: snapshot.attachmentReady ? "passed" : "blocked",
        attempt: context.attachmentConfirmAttempts,
        elapsedMs: snapshot.elapsedMs,
        blockingCondition: snapshot.blockingCondition,
        snapshot: snapshot
      });
      if (snapshot.attachmentReady) {
        lastReadySnapshot = snapshot;
        return {
          ready: true,
          foundBy: foundBy,
          selectorName: "fileAttachedIndicator",
          selectorValue: selector,
          snapshot: snapshot,
          actual: "The attachment stayed visibly ready near the composer long enough to continue."
        };
      }

      await delay(pollIntervalMs);
    }

    const finalSnapshot = Object.assign({}, lastSnapshot || buildAttachmentReadinessSnapshot(profile, workflowInput, context), {
      attachmentReady: false,
      stableDetections: lastSnapshot && typeof lastSnapshot.stableDetections === "number" ? lastSnapshot.stableDetections : 0,
      stableDurationMs: lastSnapshot && typeof lastSnapshot.stableDurationMs === "number" ? lastSnapshot.stableDurationMs : 0,
      requiredStablePollCount: requiredStablePolls,
      requiredStableMinDurationMs: requiredStableDurationMs,
      selectorName: "fileAttachedIndicator",
      selectorValue: selector,
      foundBy: lastReadySnapshot ? lastReadySnapshot.foundBy : ((lastSnapshot && lastSnapshot.foundBy) || "none"),
      readinessFailures: []
    });
    finalSnapshot.readinessFailures = Readiness.appendAttachmentStabilityFailures(
      finalSnapshot,
      Readiness.listAttachmentReadinessFailures(lastSnapshot || buildAttachmentReadinessSnapshot(profile, workflowInput, context))
    );
    finalSnapshot.blockingCondition = finalSnapshot.blockingCondition || "attachmentReady";

    throw buildWorkflowError("FILE_ATTACHMENT_NOT_READY", "The attachment did not become ready before prompt insertion.", {
      profile: profile,
      failedStage: "file_attachment",
      expected: "A visible Excel attachment near the composer should match the selected file name, include .xls or .xlsx, show no upload progress, and remain stable for the configured poll count and duration.",
      actual: finalSnapshot.readinessFailures.join(" "),
      selectorName: "fileAttachedIndicator",
      selector: selector,
      snapshot: finalSnapshot,
      pageSummary: finalSnapshot,
      nextChecks: [
        "Verify the attachment card appears near the composer with the selected file name.",
        "Check whether an upload or processing indicator remains visible near the composer.",
        "Retest the attachment selectors in Site Profile Editor if the card never becomes visible."
      ]
    });
  }

  async function waitForComposerReadyToSend(profile, workflowInput, context) {
    const timeoutMs = Math.max(0, Number(profile.timing.composerReadyTimeoutMs) || profile.timing.sendButtonReadyTimeoutMs || 0);
    const pollIntervalMs = Math.max(1, Number(profile.timing.pollIntervalMs) || 200);
    const startedAt = Date.now();
    let lastSnapshot = null;

    context.composerReadyStartedAt = startedAt;
    context.composerReadyAttempts = 0;

    while (Date.now() - startedAt < timeoutMs) {
      context.composerReadyAttempts += 1;
      const snapshot = buildComposerReadyToSendSnapshot(profile, workflowInput, context);
      lastSnapshot = snapshot;
      await DiagnosticStore.recordGateSnapshot({
        traceId: context.traceId,
        workflowId: context.workflowId,
        workflowName: context.workflowName,
        runKind: WorkflowStateTracker.inferRunKind(context.workflowName),
        gateName: "wait_for_composer_ready_to_send",
        stepName: "wait_for_composer_ready_to_send",
        stage: "submit",
        status: snapshot.ready ? "passed" : "blocked",
        attempt: context.composerReadyAttempts,
        elapsedMs: snapshot.elapsedMs,
        blockingCondition: snapshot.blockingCondition,
        snapshot: snapshot
      });

      if (snapshot.ready) {
        const liveSendButtonEvidence = buildSendButtonReadyEvidence(profile, workflowInput, context);
        context.sendButton = liveSendButtonEvidence.element;
        context.sendButtonEvidence = Object.assign({}, liveSendButtonEvidence, { element: undefined });
        context.sendButtonCandidateIdentity = liveSendButtonEvidence.selectedCandidate
          ? liveSendButtonEvidence.selectedCandidate.candidateIdentity || ""
          : "";
        return {
          ready: true,
          foundBy: liveSendButtonEvidence.foundBy,
          selectorName: "sendButton",
          selectorValue: profile.selectors.sendButton,
          snapshot: snapshot,
          actual: "Attachment, prompt, and send button were all ready in the same polling cycle."
        };
      }

      await delay(pollIntervalMs);
    }

    const finalSnapshot = Object.assign({}, lastSnapshot || buildComposerReadyToSendSnapshot(profile, workflowInput, context), {
      ready: false
    });
    throw buildWorkflowError("COMPOSER_NOT_READY_TO_SEND", "The composer did not become ready to send before timeout.", {
      profile: profile,
      failedStage: "submit",
      expected: "Attachment readiness, prompt readiness, and send button readiness should all be true in the same polling cycle before clicking send.",
      actual: finalSnapshot.readinessFailures.join(" "),
      selectorName: "sendButton",
      selector: profile.selectors.sendButton,
      snapshot: finalSnapshot,
      pageSummary: finalSnapshot,
      nextChecks: [
        "Verify the attachment is still visible and ready near the composer.",
        "Confirm the prompt text is still present in the composer input.",
        "Inspect the send button state for disabled, aria-disabled, loading, or progress indicators."
      ]
    });
  }

  function attachFileThroughInput(fileInput, filePayload) {
    const file = FilePayloadHelpers.base64ToFile(filePayload.contentBase64, filePayload.name, filePayload.mimeType);
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
    const attachFile = input.attachFile !== false;
    const workflowInput = {
      dryRun: Boolean(input.dryRun),
      attachFile: attachFile,
      requireAttachmentReady: attachFile,
      filePath: input.filePath || "",
      promptText: input.promptText || "",
      waitForResponse: Boolean(input.waitForResponse),
      filePayload: input.filePayload || null,
      selectedFile: input.selectedFile || null
    };

    const steps = ChatAutomatorSteps.buildSteps({
      profile: profile,
      workflowInput: workflowInput,
      helpers: {
        attachFileThroughInput: attachFileThroughInput,
        buildComposerDiagnosticSnapshot: buildComposerDiagnosticSnapshot,
        buildSendButtonReadyEvidence: buildSendButtonReadyEvidence,
        buildWorkflowError: buildWorkflowError,
        ComposerProbe: ComposerProbe,
        delay: delay,
        DiagnosticStore: DiagnosticStore,
        DomHelpers: DomHelpers,
        emitWorkflowEvent: emitWorkflowEvent,
        getFileExtension: getFileExtension,
        PageState: PageState,
        requiredSelectorsForMainWorkflow: requiredSelectorsForMainWorkflow,
        ResponseCapture: ResponseCapture,
        TELEMETRY_EVENTS: TELEMETRY_EVENTS,
        waitForAttachmentReady: waitForAttachmentReady,
        waitForComposerReadyToSend: waitForComposerReadyToSend,
        waitForElement: waitForElement,
        WorkflowStateTracker: WorkflowStateTracker
      }
    });

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
        selectedFile: workflowInput.selectedFile || null,
        responseCapture: result.results && result.results.wait_for_deepseek_response_complete
          ? {
            responseCaptured: Boolean(result.results.wait_for_deepseek_response_complete.responseCaptured),
            selectorUsed: result.results.wait_for_deepseek_response_complete.selectorValue || "",
            textLength: result.results.wait_for_deepseek_response_complete.snapshot
              ? result.results.wait_for_deepseek_response_complete.snapshot.textLength || 0
              : 0,
            stabilityMs: result.results.wait_for_deepseek_response_complete.snapshot
              ? result.results.wait_for_deepseek_response_complete.snapshot.stabilityMs || 0
              : 0,
            completionSignals: result.results.wait_for_deepseek_response_complete.snapshot
              ? result.results.wait_for_deepseek_response_complete.snapshot.completionSignals || {}
              : {}
          }
          : null
      };
      if (result.failedStep === "wait_for_deepseek_response_complete" && result.error && result.error.snapshot) {
        diagnosticPackage.selectorUsed = result.error.selector || profile.responseCapture && profile.responseCapture.assistantMessageSelector || "";
        diagnosticPackage.assistantMessageCount = typeof result.error.snapshot.assistantMessageCount === "number" ? result.error.snapshot.assistantMessageCount : 0;
        diagnosticPackage.lastTextLength = typeof result.error.snapshot.textLength === "number" ? result.error.snapshot.textLength : 0;
        diagnosticPackage.stableDurationMs = typeof result.error.snapshot.stableDurationMs === "number" ? result.error.snapshot.stableDurationMs : 0;
        diagnosticPackage.timeoutMs = profile.responseCapture && profile.responseCapture.timeoutMs ? profile.responseCapture.timeoutMs : 0;
        diagnosticPackage.completionSignals = result.error.snapshot.completionSignals || {};
      }
      Object.assign(diagnosticPackage, buildComposerDiagnosticSnapshot(profile));
      diagnosticPackage.sendButtonEvidence = result.results && result.results.wait_for_composer_ready_to_send
        ? Object.assign({}, (result.results.wait_for_composer_ready_to_send.snapshot && result.results.wait_for_composer_ready_to_send.snapshot.sendButtonEvidence) || {}, {
          selectorName: result.results.wait_for_composer_ready_to_send.selectorName || "sendButton",
          selectorValue: result.results.wait_for_composer_ready_to_send.selectorValue || profile.selectors.sendButton,
          foundBy: result.results.wait_for_composer_ready_to_send.foundBy || ""
        })
        : null;

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

    result.workflowName = workflowInput.dryRun ? "deepseek_dry_run" : "deepseek_excel_chat";
    result.diagnosticPackage = null;
    return result;
  }

  DeepSeekAutomation.ChatAutomator = {
    runMainAutomation: runMainAutomation,
    testAllSelectors: testAllSelectors
  };
})(globalThis);
