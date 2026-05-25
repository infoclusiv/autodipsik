(function initDeepSeekContent(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};

  if (DeepSeekAutomation.__contentScriptInitialized) {
    return;
  }

  DeepSeekAutomation.__contentScriptInitialized = true;
  DeepSeekAutomation.__contentScriptLoadedAt = new Date().toISOString();

  const Errors = NewSiteCore.Errors;
  const DomHelpers = DeepSeekAutomation.DeepSeekDomHelpers;
  const contentHandlers = DeepSeekAutomation.DeepSeekContentHandlers;

  console.debug("[Autodipsik][DeepSeek] content script loaded", {
    url: location.href,
    loadedAt: DeepSeekAutomation.__contentScriptLoadedAt
  });

  chrome.runtime.onMessage.addListener(function onMessage(message, sender, sendResponse) {
    if (!message || !message.type) {
      return;
    }

    contentHandlers.handleMessage(message)
      .then(sendResponse)
      .catch(function handleError(error) {
        sendResponse({
          status: "failed",
          error: Errors.toStructuredError({
            message: error.message,
            actual: "DeepSeek content script message handling failed.",
            url: location.href,
            pageSummary: DomHelpers.getPageSummary()
          })
        });
      });

    return true;
  });
})(globalThis);
