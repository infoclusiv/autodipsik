(function initBackgroundBootstrap(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const NewSiteAutomation = globalScope.NewSiteAutomation = globalScope.NewSiteAutomation || {};

  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Telemetry = NewSiteCore.Telemetry;
  const RuntimeStatusService = NewSiteBackground.RuntimeStatusService;
  const siteConfig = NewSiteAutomation.NEWSITE_CONFIG;

  let started = false;

  async function initializeBackground() {
    await Telemetry.hydrateFromStorage();
    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.EXTENSION_BOOTSTRAP_STARTED,
      traceId: Telemetry.createTraceId("bootstrap"),
      siteId: siteConfig.siteId,
      component: "background",
      level: "info",
      message: "Extension bootstrap started"
    });

    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }

    await RuntimeStatusService.update({ initialized: true });

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.EXTENSION_BOOTSTRAP_COMPLETED,
      traceId: Telemetry.createTraceId("bootstrap"),
      siteId: siteConfig.siteId,
      component: "background",
      level: "info",
      message: "Extension bootstrap completed"
    });
  }

  function registerListeners() {
    chrome.runtime.onInstalled.addListener(async function onInstalled() {
      await initializeBackground();
      await RuntimeStatusService.update({ installed: true });
    });

    chrome.runtime.onStartup.addListener(async function onStartup() {
      await RuntimeStatusService.update({ started: true });
    });

    chrome.tabs.onActivated.addListener(function onTabActivated() {
      RuntimeStatusService.update().catch(function noop() {});
    });

    chrome.tabs.onUpdated.addListener(function onTabUpdated(tabId, changeInfo) {
      if (changeInfo.status === "complete") {
        RuntimeStatusService.update().catch(function noop() {});
      }
    });

    chrome.runtime.onMessage.addListener(NewSiteBackground.MessageRouter.handleRuntimeMessage);
  }

  function start() {
    if (started) {
      return;
    }
    started = true;
    registerListeners();
    initializeBackground().catch(function logBootstrapError(error) {
      console.error("Background initialization failed", error);
    });
  }

  NewSiteBackground.BackgroundBootstrap = {
    start: start,
    initializeBackground: initializeBackground
  };
})(globalThis);
