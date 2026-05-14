(function initDeepSeekPageState(globalScope) {
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};
  const Selectors = DeepSeekAutomation.DeepSeekSelectors;

  function detectPageState(profile) {
    const evidence = [];

    function addEvidence(selectorName, matched, state, confidence) {
      evidence.push({
        type: "selector",
        selectorName: selectorName,
        matched: matched
      });
      return {
        state: state,
        confidence: confidence,
        evidence: evidence.slice()
      };
    }

    const errorBanner = Selectors.querySelectorSafe(Selectors.getSelector(profile, "errorBanner"));
    if (errorBanner) {
      return addEvidence("errorBanner", true, "error", 0.95);
    }

    const chatInput = Selectors.querySelectorSafe(Selectors.getSelector(profile, "chatInput"))
      || Selectors.querySelectorSafe(Selectors.getSelector(profile, "chatInputFallback"));
    if (chatInput) {
      return addEvidence("chatInput", true, "chat_ready", 0.9);
    }

    const generatingIndicator = Selectors.querySelectorSafe(Selectors.getSelector(profile, "generatingIndicator"));
    if (generatingIndicator) {
      return addEvidence("generatingIndicator", true, "responding", 0.88);
    }

    const progressIndicator = Selectors.querySelectorSafe(Selectors.getSelector(profile, "progressIndicator"));
    if (progressIndicator) {
      return addEvidence("progressIndicator", true, "processing", 0.85);
    }

    const fileInput = Selectors.querySelectorSafe(Selectors.getSelector(profile, "fileInput"));
    if (fileInput) {
      return addEvidence("fileInput", true, "ready_for_input", 0.8);
    }

    const primaryAction = Selectors.querySelectorSafe(Selectors.getSelector(profile, "primaryActionButton"));
    if (primaryAction) {
      return addEvidence("primaryActionButton", true, "landing", 0.7);
    }

    evidence.push({
      type: "heuristic",
      selectorName: "",
      matched: false
    });

    return {
      state: "unknown",
      confidence: 0.2,
      evidence: evidence
    };
  }

  DeepSeekAutomation.DeepSeekPageState = {
    detectPageState: detectPageState
  };
})(globalThis);
