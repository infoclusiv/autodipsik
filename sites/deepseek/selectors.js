(function initDeepSeekSelectors(globalScope) {
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};

  function querySelectorSafe(selector) {
    try {
      return selector ? document.querySelector(selector) : null;
    } catch (error) {
      return null;
    }
  }

  async function waitForElement(selector, timeoutMs, pollIntervalMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const element = querySelectorSafe(selector);
      if (element) {
        return element;
      }
      await new Promise(function sleep(resolve) {
        setTimeout(resolve, pollIntervalMs);
      });
    }
    return null;
  }

  DeepSeekAutomation.DeepSeekSelectors = {
    querySelectorSafe: querySelectorSafe,
    waitForElement: waitForElement
  };
})(globalThis);
