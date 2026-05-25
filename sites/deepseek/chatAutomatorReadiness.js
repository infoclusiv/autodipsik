(function initDeepSeekChatAutomatorReadiness(globalScope) {
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};

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

  DeepSeekAutomation.ChatAutomatorReadiness = {
    appendAttachmentStabilityFailures: appendAttachmentStabilityFailures,
    getComposerValue: getComposerValue,
    getSendButtonDisabledReasons: getSendButtonDisabledReasons,
    isAttachmentReadinessSatisfied: isAttachmentReadinessSatisfied,
    listAttachmentReadinessFailures: listAttachmentReadinessFailures,
    normalizePromptText: normalizePromptText
  };
})(globalThis);
