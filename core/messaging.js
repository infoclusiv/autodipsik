(function initMessaging(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  function sendRuntimeMessage(message) {
    return chrome.runtime.sendMessage(message);
  }

  function sendTabMessage(tabId, message) {
    return chrome.tabs.sendMessage(tabId, message);
  }

  NewSiteCore.Messaging = {
    sendRuntimeMessage: sendRuntimeMessage,
    sendTabMessage: sendTabMessage
  };
})(globalThis);
