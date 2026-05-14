(function initNewSiteConfig(globalScope) {
  const NewSiteAutomation = globalScope.NewSiteAutomation = globalScope.NewSiteAutomation || {};

  NewSiteAutomation.NEWSITE_CONFIG = {
    siteId: "newsite",
    displayName: "DeepSeek Excel Chat Automation",
    baseUrl: "https://chat.deepseek.com/",
    urlPattern: "https://chat.deepseek.com/*",
    storageKeySiteProfile: "newsite_site_profile",
    supportedCapabilities: [
      "open_site",
      "detect_page_state",
      "test_selectors",
      "run_main_automation"
    ]
  };
})(globalThis);
