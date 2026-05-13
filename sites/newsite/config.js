(function initNewSiteConfig(globalScope) {
  const NewSiteAutomation = globalScope.NewSiteAutomation = globalScope.NewSiteAutomation || {};

  NewSiteAutomation.NEWSITE_CONFIG = {
    siteId: "newsite",
    displayName: "New Website Automation",
    baseUrl: "https://example.com",
    urlPattern: "https://example.com/*",
    storageKeySiteProfile: "newsite_site_profile",
    supportedCapabilities: [
      "open_site",
      "detect_page_state",
      "test_selectors",
      "run_main_automation"
    ]
  };
})(globalThis);
