(function initDeepSeekTabService(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};

  const MESSAGE_TYPES = NewSiteCore.MESSAGE_TYPES;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Telemetry = NewSiteCore.Telemetry;
  const Errors = NewSiteCore.Errors;
  const TabManager = NewSiteCore.TabManager;
  const DiagnosticStore = NewSiteCore.DiagnosticStore;
  const deepSeekConfig = DeepSeekAutomation.DEEPSEEK_CONFIG;

  async function ensureReady(traceId) {
    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.DEEPSEEK_TAB_ENSURE_STARTED,
      traceId: traceId,
      siteId: "deepseek",
      component: "background",
      level: "info",
      message: "Ensuring DeepSeek tab"
    });

    try {
      const tab = await TabManager.ensureTab(deepSeekConfig.baseUrl, deepSeekConfig.urlPattern);
      const readyTab = await TabManager.waitForTabComplete(tab.id, 20000);
      await DiagnosticStore.recordRuntimeSnapshot({
        traceId: traceId,
        stage: "ensure_deepseek_tab",
        url: readyTab.url || deepSeekConfig.baseUrl,
        tabId: readyTab.id,
        title: readyTab.title || ""
      });

      const healthCheck = await TabManager.sendMessageWithContentScriptCheck(
        readyTab.id,
        {
          type: MESSAGE_TYPES.DEEPSEEK_CONTENT_SCRIPT_PING,
          traceId: traceId,
          targetSiteId: "deepseek"
        },
        {
          targetSiteId: "deepseek"
        }
      );

      await DiagnosticStore.recordContentScriptHealth({
        traceId: traceId,
        available: Boolean(healthCheck && healthCheck.available),
        activeTabUrl: readyTab.url || deepSeekConfig.baseUrl,
        checkedAt: new Date().toISOString(),
        response: healthCheck || null
      });
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.DEEPSEEK_TAB_ENSURE_COMPLETED,
        traceId: traceId,
        siteId: "deepseek",
        component: "background",
        level: "info",
        message: "DeepSeek tab is ready",
        data: { tabId: readyTab.id, url: readyTab.url || deepSeekConfig.baseUrl }
      });
      return readyTab;
    } catch (error) {
      const structured = Errors.toStructuredError(error);
      structured.failedStage = "ensure_deepseek_tab";
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.DEEPSEEK_TAB_ENSURE_FAILED,
        traceId: traceId,
        siteId: "deepseek",
        component: "background",
        level: "error",
        message: structured.message,
        actual: structured.actual,
        data: structured
      });
      throw Errors.createError("DEEPSEEK_TAB_NOT_READY", "The DeepSeek tab could not be prepared.", {
        traceId: traceId,
        failedStage: "ensure_deepseek_tab",
        expected: "A DeepSeek tab should be opened and fully loaded.",
        actual: structured.actual || structured.message,
        nextChecks: [
          "Confirm https://chat.deepseek.com/ is reachable in the browser.",
          "Reload the extension if the content script does not attach."
        ]
      });
    }
  }

  async function forward(message) {
    const activeTab = await ensureReady(message.traceId);
    const failedStage = message.type === MESSAGE_TYPES.PAGE_STATE_DETECT
      ? "detect_page_state"
      : message.type === MESSAGE_TYPES.RUN_AUTOMATION
        ? "run_actual_automation"
        : "deepseek_message_forward";

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.DEEPSEEK_TAB_DETECTED,
      traceId: message.traceId,
      siteId: "deepseek",
      component: "background",
      level: "info",
      message: "DeepSeek tab detected",
      data: { tabId: activeTab.id, url: activeTab.url || "" }
    });

    try {
      return await TabManager.sendMessageWithContentScriptCheck(activeTab.id, message, {
        targetSiteId: "deepseek"
      });
    } catch (error) {
      await DiagnosticStore.recordContentScriptHealth({
        traceId: message.traceId,
        available: false,
        activeTabUrl: activeTab.url || "",
        checkedAt: new Date().toISOString(),
        reason: error.message,
        messageType: message.type,
        failedStage: failedStage,
        injectionAttempted: Boolean(error.injectionAttempted),
        injectedFiles: error.injectedFiles || [],
        originalError: error.originalError || "",
        retryError: error.retryError || ""
      });
      throw Errors.createError("CONTENT_SCRIPT_UNAVAILABLE", "DeepSeek content script is unavailable.", {
        failedStage: failedStage,
        expected: "The DeepSeek content script should respond to the requested message.",
        actual: error.message,
        activeTabUrl: activeTab.url || "",
        messageType: message.type,
        manifestMatchExpectation: deepSeekConfig.urlPattern,
        contentScriptHandler: "sites/deepseek/content.js",
        injectionAttempted: error.injectionAttempted || false,
        injectedFiles: error.injectedFiles || [],
        originalError: error.originalError || "",
        retryError: error.retryError || "",
        suggestedFix: [
          "Confirm Chrome is loading the updated unpacked extension folder.",
          "Open chrome://extensions and reload the extension.",
          "Close and reopen the DeepSeek tab.",
          "Inspect the DeepSeek tab console for content script initialization errors.",
          "Verify the manifest content_scripts chain remains in the correct order."
        ]
      });
    }
  }

  NewSiteBackground.DeepSeekTabService = {
    ensureReady: ensureReady,
    forward: forward
  };
})(globalThis);
