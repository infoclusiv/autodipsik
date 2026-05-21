(function initDeepSeekResponseCapture(globalScope) {
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  const Selectors = DeepSeekAutomation.DeepSeekSelectors;
  const ComposerProbe = DeepSeekAutomation.DeepSeekComposerProbe;
  const DomHelpers = DeepSeekAutomation.DeepSeekDomHelpers;
  const Errors = NewSiteCore.Errors;
  const Telemetry = NewSiteCore.Telemetry;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const DiagnosticStore = NewSiteCore.DiagnosticStore;
  const WorkflowStateTracker = NewSiteCore.WorkflowStateTracker;

  function delay(ms) {
    return new Promise(function wait(resolve) {
      setTimeout(resolve, ms);
    });
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getVisibleAssistantMessages(selector) {
    return Selectors.queryAllSafe(selector).filter(Selectors.isElementVisible);
  }

  function getLatestAssistantMessage(selector) {
    const visibleMessages = getVisibleAssistantMessages(selector);
    return {
      messages: visibleMessages,
      element: visibleMessages.length ? visibleMessages[visibleMessages.length - 1] : null,
      index: visibleMessages.length ? visibleMessages.length - 1 : -1
    };
  }

  function getComposerDisabledObserved(profile) {
    const selectorsToTry = [
      profile && profile.selectors ? profile.selectors.chatInput : "",
      profile && profile.selectors ? profile.selectors.chatInputFallback : "",
      "textarea[placeholder='Message DeepSeek'], textarea, div[contenteditable='true']"
    ].filter(Boolean);

    for (const selector of selectorsToTry) {
      const composer = Selectors.queryAllSafe(selector).find(Selectors.isElementVisible);
      if (!composer) {
        continue;
      }
      const contentEditable = String(composer.getAttribute("contenteditable") || "").toLowerCase();
      if (composer.disabled === true || composer.readOnly === true || composer.getAttribute("aria-disabled") === "true" || contentEditable === "false") {
        return true;
      }
    }

    return false;
  }

  function getSupportingCompletionSignals(profile, workflowInput, context) {
    const sendButtonState = ComposerProbe.probeSendButtonState(profile, workflowInput, context);
    const sendButtonDisabledObserved = Boolean(
      sendButtonState
      && sendButtonState.sendButtonCandidateFound
      && (!sendButtonState.sendButtonReady || (Array.isArray(sendButtonState.disabledSignals) && sendButtonState.disabledSignals.length > 0))
    );

    return {
      composerDisabledObserved: getComposerDisabledObserved(profile),
      sendButtonDisabledObserved: profile && profile.completionSignals && profile.completionSignals.useSendButtonDisabledAsSupportingSignal !== false
        ? sendButtonDisabledObserved
        : false,
      sendButtonEvidence: sendButtonState ? Object.assign({}, sendButtonState, { element: undefined }) : null
    };
  }

  function createSnapshot(input) {
    return {
      assistantMessageCount: input.assistantMessageCount,
      assistantMessageFound: input.assistantMessageCount > 0,
      selectedMessageIndex: input.selectedMessageIndex,
      selectorUsed: input.selectorUsed,
      textLength: input.textLength,
      lastTextChangedAgoMs: input.lastTextChangedAgoMs,
      stableDurationMs: input.stableDurationMs,
      requiredStableDurationMs: input.requiredStableDurationMs,
      elapsedMs: input.elapsedMs,
      url: location.href,
      title: document.title,
      completionSignals: {
        assistantMessageFound: input.assistantMessageCount > 0,
        textStable: input.textStable,
        composerDisabledObserved: input.composerDisabledObserved,
        sendButtonDisabledObserved: input.sendButtonDisabledObserved
      },
      selectedMessageSummary: input.selectedMessageSummary,
      sendButtonEvidence: input.sendButtonEvidence
    };
  }

  function createFailure(code, message, details) {
    return Errors.createError(code, message, details);
  }

  async function recordProgressSnapshot(context, snapshot, status, blockingCondition) {
    await DiagnosticStore.recordGateSnapshot({
      traceId: context.traceId,
      workflowId: context.workflowId,
      workflowName: context.workflowName,
      runKind: WorkflowStateTracker.inferRunKind(context.workflowName),
      gateName: "wait_for_deepseek_response_complete",
      stepName: "wait_for_deepseek_response_complete",
      stage: "response_capture",
      status: status,
      attempt: snapshot.pollCount,
      elapsedMs: snapshot.elapsedMs,
      blockingCondition: blockingCondition || "",
      snapshot: snapshot
    });
  }

  async function emitCaptureEvent(context, eventName, level, message, data) {
    await Telemetry.emit({
      eventName: eventName,
      traceId: context.traceId,
      workflowId: context.workflowId,
      siteId: "deepseek",
      component: "responseCapture",
      level: level,
      message: message,
      stage: "response_capture",
      stepName: "wait_for_deepseek_response_complete",
      expected: data && data.expected ? data.expected : "",
      actual: data && data.actual ? data.actual : "",
      selectorName: "assistantMessageSelector",
      selectorValue: data && data.selectorValue ? data.selectorValue : "",
      data: data || {}
    });
  }

  async function waitForFinalResponse(profile, workflowInput, context) {
    const captureConfig = profile.responseCapture || {};
    const selector = captureConfig.assistantMessageSelector || ".ds-markdown.ds-assistant-message-main-content";
    const stableTextMinDurationMs = Math.max(0, Number(captureConfig.stableTextMinDurationMs) || 3000);
    const timeoutMs = Math.max(1, Number(captureConfig.timeoutMs) || 120000);
    const pollIntervalMs = Math.max(1, Number(captureConfig.pollIntervalMs) || 250);
    const minTextLength = Math.max(1, Number(captureConfig.minTextLength) || 1);
    const startedAt = Date.now();
    const progressEmitIntervalMs = 2000;
    let lastText = "";
    let lastTextChangedAt = startedAt;
    let lastProgressAt = 0;
    let pollCount = 0;
    let lastSnapshot = null;

    await emitCaptureEvent(context, TELEMETRY_EVENTS.DEEPSEEK_RESPONSE_CAPTURE_STARTED, "info", "DeepSeek response capture started", {
      selectorValue: selector,
      expected: "A final assistant response should appear and remain text-stable before capture completes.",
      actual: "Response capture polling started."
    });

    while (Date.now() - startedAt < timeoutMs) {
      pollCount += 1;
      const selected = getLatestAssistantMessage(selector);
      const element = selected.element;
      const text = normalizeText(element ? element.innerText || element.textContent || "" : "");
      const elapsedMs = Date.now() - startedAt;

      if (text !== lastText) {
        lastText = text;
        lastTextChangedAt = Date.now();
      }

      const stableDurationMs = text ? Math.max(0, Date.now() - lastTextChangedAt) : 0;
      const textStable = text.length >= minTextLength && stableDurationMs >= stableTextMinDurationMs;
      const supportingSignals = getSupportingCompletionSignals(profile, workflowInput, context);
      const snapshot = createSnapshot({
        assistantMessageCount: selected.messages.length,
        selectedMessageIndex: selected.index,
        selectorUsed: selector,
        textLength: text.length,
        lastTextChangedAgoMs: text ? Math.max(0, Date.now() - lastTextChangedAt) : 0,
        stableDurationMs: stableDurationMs,
        requiredStableDurationMs: stableTextMinDurationMs,
        elapsedMs: elapsedMs,
        textStable: textStable,
        composerDisabledObserved: supportingSignals.composerDisabledObserved,
        sendButtonDisabledObserved: supportingSignals.sendButtonDisabledObserved,
        selectedMessageSummary: element ? DomHelpers.getElementSummary(element) : null,
        sendButtonEvidence: supportingSignals.sendButtonEvidence,
        pollCount: pollCount
      });
      lastSnapshot = snapshot;

      const shouldRecordProgress = pollCount === 1 || (Date.now() - lastProgressAt) >= progressEmitIntervalMs || textStable;
      if (shouldRecordProgress) {
        lastProgressAt = Date.now();
        await recordProgressSnapshot(context, snapshot, textStable ? "passed" : "observed", textStable ? "" : (selected.messages.length ? "textNotStableYet" : "assistantMessageMissing"));
        await emitCaptureEvent(context, TELEMETRY_EVENTS.DEEPSEEK_RESPONSE_CAPTURE_PROGRESS, "info", "DeepSeek response capture progress recorded", {
          selectorValue: selector,
          actual: selected.messages.length
            ? "Observed assistant response text length " + String(text.length) + " with stability " + String(stableDurationMs) + " ms."
            : "No visible assistant response element matched the capture selector yet.",
          textLength: text.length,
          stableDurationMs: stableDurationMs,
          assistantMessageCount: selected.messages.length,
          completionSignals: snapshot.completionSignals
        });
      }

      if (textStable) {
        const capturedAt = new Date().toISOString();
        const result = {
          source: "deepseek",
          capturedAt: capturedAt,
          url: location.href,
          title: document.title,
          selectorUsed: selector,
          selectedMessageIndex: selected.index,
          text: text,
          textLength: text.length,
          stabilityMs: stableDurationMs,
          pollIntervalMs: pollIntervalMs,
          elapsedMs: elapsedMs,
          completionSignals: snapshot.completionSignals
        };

        await emitCaptureEvent(context, TELEMETRY_EVENTS.DEEPSEEK_RESPONSE_CAPTURE_COMPLETED, "info", "DeepSeek response capture completed", {
          selectorValue: selector,
          actual: "The DeepSeek assistant response became stable and was captured.",
          textLength: result.textLength,
          elapsedMs: elapsedMs,
          stabilityMs: stableDurationMs,
          completionSignals: result.completionSignals
        });

        return result;
      }

      await delay(pollIntervalMs);
    }

    if (lastSnapshot) {
      await recordProgressSnapshot(context, lastSnapshot, "failed", lastSnapshot.assistantMessageFound ? "textNotStableBeforeTimeout" : "assistantMessageMissing");
    }

    if (!lastSnapshot || !lastSnapshot.assistantMessageFound) {
      const missingError = createFailure("DEEPSEEK_RESPONSE_NOT_FOUND", "No visible DeepSeek assistant response was found before timeout.", {
        expected: "At least one visible DeepSeek assistant message matching the response selector.",
        actual: "No visible " + selector + " element was found before timeout.",
        failedStage: "response_capture",
        selectorName: "assistantMessageSelector",
        selector: selector,
        snapshot: lastSnapshot,
        pageSummary: DomHelpers.getPageSummary()
      });
      await emitCaptureEvent(context, TELEMETRY_EVENTS.DEEPSEEK_RESPONSE_CAPTURE_FAILED, "error", missingError.message, {
        selectorValue: selector,
        expected: missingError.expected,
        actual: missingError.actual,
        snapshot: lastSnapshot
      });
      throw missingError;
    }

    const timeoutError = createFailure("DEEPSEEK_RESPONSE_CAPTURE_TIMEOUT", "DeepSeek response text did not stabilize before timeout.", {
      expected: "A final assistant response should appear and remain text-stable for the configured duration.",
      actual: "Last response text length was " + String(lastSnapshot.textLength) + " and stable duration was " + String(lastSnapshot.stableDurationMs) + " ms before timeout.",
      failedStage: "response_capture",
      selectorName: "assistantMessageSelector",
      selector: selector,
      snapshot: lastSnapshot,
      pageSummary: DomHelpers.getPageSummary()
    });
    await emitCaptureEvent(context, TELEMETRY_EVENTS.DEEPSEEK_RESPONSE_CAPTURE_FAILED, "error", timeoutError.message, {
      selectorValue: selector,
      expected: timeoutError.expected,
      actual: timeoutError.actual,
      snapshot: lastSnapshot
    });
    throw timeoutError;
  }

  DeepSeekAutomation.DeepSeekResponseCapture = {
    waitForFinalResponse: waitForFinalResponse
  };
})(globalThis);
