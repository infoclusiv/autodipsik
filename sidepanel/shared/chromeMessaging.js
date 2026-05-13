(function initChromeMessaging(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};

  async function sendMessage(message) {
    return chrome.runtime.sendMessage(message);
  }

  NewSiteSidepanel.ChromeMessaging = {
    sendMessage: sendMessage
  };
})(globalThis);
