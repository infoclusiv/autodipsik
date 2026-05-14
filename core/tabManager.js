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

  async function findTabByUrlPattern(urlPattern) {
    const tabs = await chrome.tabs.query({ url: urlPattern });
    return tabs[0] || null;
  }

  async function ensureTab(url, urlPattern) {
    const existing = urlPattern ? await findTabByUrlPattern(urlPattern) : null;
    if (existing) {
      await chrome.tabs.update(existing.id, { active: true });
      if (existing.windowId) {
        await chrome.windows.update(existing.windowId, { focused: true });
      }
      return existing;
    }
    return chrome.tabs.create({ url: url, active: true });
  }

  async function waitForTabComplete(tabId, timeoutMs) {
    const timeout = typeof timeoutMs === "number" ? timeoutMs : 15000;
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.status === "complete") {
        return tab;
      }
      await new Promise(function sleep(resolve) {
        setTimeout(resolve, 200);
      });
    }
    throw new Error("Timed out waiting for tab " + tabId + " to complete loading.");
  }

  async function sendMessageWithContentScriptCheck(tabId, message) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      throw error;
    }
  }

  NewSiteCore.TabManager = {
    getActiveTab: getActiveTab,
    openTab: openTab,
    findTabByUrlPattern: findTabByUrlPattern,
    ensureTab: ensureTab,
    waitForTabComplete: waitForTabComplete,
    sendMessageWithContentScriptCheck: sendMessageWithContentScriptCheck
  };
})(globalThis);
