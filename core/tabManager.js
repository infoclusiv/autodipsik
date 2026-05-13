(function initTabManager(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  async function getActiveTab() {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    return tabs[0] || null;
  }

  async function openTab(url) {
    return chrome.tabs.create({ url: url });
  }

  NewSiteCore.TabManager = {
    getActiveTab: getActiveTab,
    openTab: openTab
  };
})(globalThis);
