(function initActiveTabForwarder(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const NewSiteAutomation = globalScope.NewSiteAutomation = globalScope.NewSiteAutomation || {};
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};

  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Telemetry = NewSiteCore.Telemetry;
  const Errors = NewSiteCore.Errors;
  const TabManager = NewSiteCore.TabManager;
  const siteConfig = NewSiteAutomation.NEWSITE_CONFIG;
  const deepSeekConfig = DeepSeekAutomation.DEEPSEEK_CONFIG;

  async function forwardToActiveTab(message) {
    const activeTab = await TabManager.getActiveTab();
    if (!activeTab || !activeTab.id) {
      throw Errors.createError("NO_ACTIVE_TAB", "No active tab available.", {
        expected: "A website tab should be active.",
        actual: "No active tab was found.",
        nextChecks: [
          "Open the target website in the active tab.",
          "Make sure the tab is in the current browser window."
        ]
      });
    }

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.EXTENSION_MESSAGE_FORWARDED,
      traceId: message.traceId,
      siteId: siteConfig.siteId,
      component: "background",
      level: "info",
      message: "Forwarding message to active tab",
      data: { tabId: activeTab.id, type: message.type }
    });

    try {
      return await chrome.tabs.sendMessage(activeTab.id, message);
    } catch (error) {
      throw Errors.createError("CONTENT_SCRIPT_UNAVAILABLE", "Content script unavailable for active tab.", {
        expected: "The content script should be running on the target website.",
        actual: error.message,
        url: activeTab.url || "",
        nextChecks: [
          "Check whether the active tab URL matches the manifest host permissions.",
          "Reload the extension and the target website tab."
        ]
      });
    }
  }

  async function forwardToDeepSeekTab(message) {
    return NewSiteBackground.DeepSeekTabService.forward(message);
  }

  async function forwardToSiteAwareTab(message) {
    const activeTab = await TabManager.getActiveTab();
    const activeUrl = activeTab && activeTab.url ? activeTab.url : "";

    if (deepSeekConfig.isDeepSeekUrl(activeUrl)) {
      return forwardToDeepSeekTab(message);
    }

    return forwardToActiveTab(message);
  }

  NewSiteBackground.ActiveTabForwarder = {
    forwardToActiveTab: forwardToActiveTab,
    forwardToDeepSeekTab: forwardToDeepSeekTab,
    forwardToSiteAwareTab: forwardToSiteAwareTab
  };
})(globalThis);
