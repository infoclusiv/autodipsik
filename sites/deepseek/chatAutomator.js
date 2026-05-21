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
  const ResponseCapture = DeepSeekAutomation.DeepSeekResponseCapture;

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

  function isAttachmentReadinessSatisfied(snapshot) {
    return Boolean(
      snapshot
      && snapshot.attachmentVisible
      && snapshot.matchedByFileName
      && snapshot.matchedByExtension
      && snapshot.nearComposer
      && !snapshot.uploadProgressVisible
    );
  }

  function listAttachmentReadinessFailures(snapshot) {
    const failures = [];
    if (!snapshot) {
      return ["Attachment readiness snapshot was not available."];
    }
    if (!snapshot.attachmentVisible) {
      failures.push("Attachment card was not visible near the composer.");
    }
    if (!snapshot.matchedByFileName) {
      failures.push("Attachment text did not contain the selected file name or a reliable unique part of it.");
    }
    if (!snapshot.matchedByExtension) {
      failures.push("Attachment text did not show a .xls or .xlsx indicator.");
    }
    if (!snapshot.nearComposer) {
      failures.push("The matched attachment signal was not near the composer.");
    }
    if (snapshot.uploadProgressVisible) {
      failures.push("An upload or progress indicator was still visible near the composer.");
    }
    if (Array.isArray(snapshot.missingSignals)) {
      snapshot.missingSignals.forEach(function appendFailure(message) {
        if (message && failures.indexOf(message) === -1) {
          failures.push(message);
        }
      });
    }
    return failures;
  }

  function appendAttachmentStabilityFailures(snapshot, failures) {
    const nextFailures = Array.isArray(failures) ? failures.slice() : [];
    if (!snapshot) {
      return nextFailures;
    }
    if (typeof snapshot.stableDetections === "number" && typeof snapshot.requiredStablePollCount === "number"
      && snapshot.stableDetections < snapshot.requiredStablePollCount) {
      nextFailures.push("Attachment readiness did not remain stable for the required number of consecutive polls.");
    }
    if (typeof snapshot.stableDurationMs === "number" && typeof snapshot.requiredStableMinDurationMs === "number"
      && snapshot.stableDurationMs < snapshot.requiredStableMinDurationMs) {
      nextFailures.push("Attachment readiness did not remain stable for the required minimum duration.");
    }
    return nextFailures;
  }

  function normalizePromptText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getComposerValue(element) {
    if (!element) {
      return "";
    }
    if (typeof element.value === "string") {
      return element.value;
    }
    return String(element.innerText || element.textContent || "");
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

  function getSendButtonDisabledReasons(element, profile, uploadProgressVisible) {
    const reasons = [];
    if (!element) {
      reasons.push("No send button candidate was found near the composer.");
      return reasons;
    }

    const className = String(element.className || "").toLowerCase();
    const ariaDisabled = String(element.getAttribute("aria-disabled") || "").toLowerCase();
    const ariaBusy = String(element.getAttribute("aria-busy") || "").toLowerCase();
    const title = String(element.getAttribute("title") || "").toLowerCase();
    const text = String(element.innerText || element.textContent || "").toLowerCase();

    if (element.disabled) {
      reasons.push("The send button has the disabled property.");
    }
    if (ariaDisabled === "true") {
      reasons.push("The send button has aria-disabled=\"true\".");
    }
    if (className.includes("disabled")) {
      reasons.push("The send button class name indicates a disabled state.");
    }
    if (className.includes("loading") || className.includes("progress") || className.includes("pending") || ariaBusy === "true") {
      reasons.push("The send button appears to be in a loading or progress state.");
    }
    if (uploadProgressVisible) {
      reasons.push("An upload or progress indicator is still visible near the composer.");
    }

    try {
      if (profile.selectors.sendButtonDisabledIndicator && element.matches(profile.selectors.sendButtonDisabledIndicator)) {
        reasons.push("The send button matches the disabled-indicator selector.");
      }
    } catch (error) {
      reasons.push("The disabled-indicator selector could not be evaluated.");
    }

    if (title.includes("loading") || text.includes("loading")) {
      reasons.push("The send button text indicates a loading state.");
    }

    return reasons;
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
      const readinessSatisfied = isAttachmentReadinessSatisfied(baseSnapshot);

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
      snapshot.readinessFailures = appendAttachmentStabilityFailures(snapshot, listAttachmentReadinessFailures(baseSnapshot));
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
    finalSnapshot.readinessFailures = appendAttachmentStabilityFailures(
      finalSnapshot,
      listAttachmentReadinessFailures(lastSnapshot || buildAttachmentReadinessSnapshot(profile, workflowInput, context))
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
        stage: "validate_input",
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
