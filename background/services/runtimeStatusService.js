(function initRuntimeStatusService(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const NewSiteAutomation = globalScope.NewSiteAutomation = globalScope.NewSiteAutomation || {};

  const TabManager = NewSiteCore.TabManager;
  const Storage = NewSiteCore.Storage;
  const STORAGE_KEYS = NewSiteCore.STORAGE_KEYS;
  const siteConfig = NewSiteAutomation.NEWSITE_CONFIG;

  async function update(extra) {
    const activeTab = await TabManager.getActiveTab();
    const status = Object.assign({
      extension: siteConfig.displayName,
      activeTabId: activeTab ? activeTab.id : null,
      activeTabUrl: activeTab ? activeTab.url || "" : "",
      updatedAt: new Date().toISOString()
    }, extra || {});
    await Storage.setValue(STORAGE_KEYS.RUNTIME_STATUS, status);
    return status;
  }

  async function getCurrent() {
    return Storage.getValue(STORAGE_KEYS.RUNTIME_STATUS, null);
  }

  NewSiteBackground.RuntimeStatusService = {
    update: update,
    getCurrent: getCurrent
  };
})(globalThis);
