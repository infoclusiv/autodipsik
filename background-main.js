importScripts(
  "core/config.js",
  "core/constants.js",
  "core/errors.js",
  "core/storage.js",
  "core/telemetry.js",
  "core/gatewayProtocol.js",
  "core/gatewayClient.js",
  "core/messaging.js",
  "core/tabManager.js",
  "core/workflowRunner.js",
  "core/diagnosticStore.js",
  "sites/newsite/config.js",
  "sites/newsite/contracts.js",
  "sites/newsite/siteProfile.js",
  "sites/deepseek/config.js",
  "sites/deepseek/siteProfile.js"
);

(function initBackground(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore;
  const NewSiteAutomation = globalScope.NewSiteAutomation;
  const MESSAGE_TYPES = NewSiteCore.MESSAGE_TYPES;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Telemetry = NewSiteCore.Telemetry;
  const Errors = NewSiteCore.Errors;
  const TabManager = NewSiteCore.TabManager;
  const DiagnosticStore = NewSiteCore.DiagnosticStore;
  const Storage = NewSiteCore.Storage;
  const GatewayClient = NewSiteCore.GatewayClient;
  const GatewayProtocol = NewSiteCore.GatewayProtocol;
  const siteConfig = NewSiteAutomation.NEWSITE_CONFIG;
  const SiteProfile = NewSiteAutomation.SiteProfile;
  const DeepSeekAutomation = globalScope.DeepSeekAutomation;
  const deepSeekConfig = DeepSeekAutomation.DEEPSEEK_CONFIG;
  const DeepSeekSiteProfile = DeepSeekAutomation.DeepSeekSiteProfile;

  async function updateRuntimeStatus(extra) {
    const activeTab = await TabManager.getActiveTab();
    const status = Object.assign({
      extension: siteConfig.displayName,
      activeTabId: activeTab ? activeTab.id : null,
      activeTabUrl: activeTab ? activeTab.url || "" : "",
      updatedAt: new Date().toISOString()
    }, extra || {});
    await Storage.setValue(NewSiteCore.STORAGE_KEYS.RUNTIME_STATUS, status);
    return status;
  }

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
    const activeTab = await TabManager.getActiveTab();
    if (!activeTab || !activeTab.id) {
      throw Errors.createError("ACTIVE_TAB_NOT_FOUND", "No active tab available.", {
        expected: "An active DeepSeek tab should be open in the current window.",
        actual: "No active tab was found.",
        suggestedFix: "Open DeepSeek and keep its tab active before retrying."
      });
    }

    if (!deepSeekConfig.isDeepSeekUrl(activeTab.url || "")) {
      throw Errors.createError("ACTIVE_TAB_NOT_DEEPSEEK", "The active tab is not DeepSeek.", {
        expected: "The active tab URL should match https://chat.deepseek.com/*.",
        actual: activeTab.url || "Unknown URL",
        suggestedFix: "Switch to a DeepSeek tab and retry the upload."
      });
    }

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
      return await chrome.tabs.sendMessage(activeTab.id, message);
    } catch (error) {
      throw Errors.createError("CONTENT_SCRIPT_NOT_AVAILABLE", "DeepSeek content script is unavailable.", {
        expected: "The DeepSeek content script should be active on the current tab.",
        actual: error.message,
        suggestedFix: "Reload the DeepSeek tab and the extension, then retry."
      });
    }
  }

  async function ensureGatewayConnection() {
    try {
      return await GatewayClient.connect();
    } catch (error) {
      throw Errors.toStructuredError(error);
    }
  }

  async function handleGatewaySelectFile(traceId) {
    const response = await GatewayClient.request(
      GatewayProtocol.GATEWAY_MESSAGE_TYPES.FILE_PICKER_OPEN_REQUEST,
      {
        allowedExtensions: [".xlsx", ".xls", ".csv"],
        dialogTitle: "Select Excel file to attach"
      }
    );
    return {
      status: "completed",
      traceId: traceId,
      gatewayStatus: await GatewayClient.getStatus(),
      file: response.payload || null
    };
  }

  async function handleGatewayExecuteUpload(traceId) {
    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.DEEPSEEK_EXECUTE_CLICKED,
      traceId: traceId,
      siteId: "deepseek",
      component: "background",
      level: "info",
      message: "DeepSeek upload execution requested"
    });

    const gatewayStatus = await GatewayClient.getStatus();
    const selectedFile = gatewayStatus.selectedFile;
    if (!selectedFile || !selectedFile.fileId) {
      throw Errors.createError("FILE_NOT_SELECTED", "No file has been selected in the Python gateway.", {
        expected: "A file should be selected before executing the upload.",
        actual: "The gateway has no selected file metadata.",
        suggestedFix: "Use the Select Excel File button before clicking Execute."
      });
    }

    const fileResponse = await GatewayClient.request(
      GatewayProtocol.GATEWAY_MESSAGE_TYPES.FILE_CONTENT_REQUEST,
      {
        fileId: selectedFile.fileId,
        encoding: "base64"
      }
    );

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.DEEPSEEK_ATTACH_STARTED,
      traceId: traceId,
      siteId: "deepseek",
      component: "background",
      level: "info",
      message: "Sending file to DeepSeek content script",
      data: { fileName: selectedFile.name, sizeBytes: selectedFile.sizeBytes }
    });

    const attachResult = await forwardToDeepSeekTab({
      type: MESSAGE_TYPES.DEEPSEEK_ATTACH_FILE,
      traceId: traceId,
      file: fileResponse.payload
    });

    await Telemetry.emit({
      eventName: attachResult && attachResult.status === "completed"
        ? TELEMETRY_EVENTS.DEEPSEEK_ATTACH_COMPLETED
        : TELEMETRY_EVENTS.DEEPSEEK_ATTACH_FAILED,
      traceId: traceId,
      siteId: "deepseek",
      component: "background",
      level: attachResult && attachResult.status === "completed" ? "info" : "error",
      message: attachResult && attachResult.status === "completed"
        ? "DeepSeek file attached"
        : "DeepSeek file attach failed",
      data: attachResult || {}
    });

    return {
      status: "completed",
      traceId: traceId,
      gatewayStatus: await GatewayClient.getStatus(),
      attachResult: attachResult
    };
  }

  async function handleMessage(message) {
    const traceId = message.traceId || Telemetry.createTraceId("bg");
    message.traceId = traceId;

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.EXTENSION_MESSAGE_RECEIVED,
      traceId: traceId,
      siteId: siteConfig.siteId,
      component: "background",
      level: "info",
      message: "Background received a message",
      data: { type: message.type }
    });

    switch (message.type) {
      case MESSAGE_TYPES.PROFILE_GET:
        return {
          status: "completed",
          traceId: traceId,
          profile: await SiteProfile.loadSiteProfile()
        };
      case MESSAGE_TYPES.PROFILE_SAVE: {
        const saveResult = await SiteProfile.saveSiteProfile(message.profile);
        return {
          status: saveResult.valid ? "completed" : "failed",
          traceId: traceId,
          validation: saveResult
        };
      }
      case MESSAGE_TYPES.PROFILE_RESET: {
        const profile = SiteProfile.cloneDefaultProfile();
        await Storage.setValue(siteConfig.storageKeySiteProfile, profile);
        return {
          status: "completed",
          traceId: traceId,
          profile: profile
        };
      }
      case MESSAGE_TYPES.RUNTIME_STATUS_GET:
        return {
          status: "completed",
          traceId: traceId,
          runtimeStatus: await updateRuntimeStatus()
        };
      case MESSAGE_TYPES.DIAGNOSTICS_GET: {
        const profile = await SiteProfile.loadSiteProfile();
        const contentContext = await forwardToActiveTab(message).catch(function swallowContentError() {
          return { status: "failed", pageSummary: null };
        });
        const diagnostics = await DiagnosticStore.exportDiagnostics(profile, siteConfig);
        diagnostics.liveContext = contentContext;
        return {
          status: "completed",
          traceId: traceId,
          diagnostics: diagnostics
        };
      }
      case MESSAGE_TYPES.EXPORT_DIAGNOSTICS: {
        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.DIAGNOSTIC_EXPORT_STARTED,
          traceId: traceId,
          siteId: siteConfig.siteId,
          component: "background",
          level: "info",
          message: "Diagnostic export started"
        });

        const profile = await SiteProfile.loadSiteProfile();
        const diagnostics = await DiagnosticStore.exportDiagnostics(profile, siteConfig, {
          deepseekProfile: DeepSeekSiteProfile.cloneDefaultProfile(),
          gatewayStatus: await GatewayClient.getStatus()
        });

        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.DIAGNOSTIC_EXPORT_COMPLETED,
          traceId: traceId,
          siteId: siteConfig.siteId,
          component: "background",
          level: "info",
          message: "Diagnostic export completed"
        });

        return {
          status: "completed",
          traceId: traceId,
          diagnostics: diagnostics
        };
      }
      case MESSAGE_TYPES.SELECTOR_TEST:
      case MESSAGE_TYPES.SELECTOR_TEST_ALL:
      case MESSAGE_TYPES.PAGE_STATE_DETECT:
      case MESSAGE_TYPES.RUN_AUTOMATION:
        return forwardToActiveTab(message);
      case MESSAGE_TYPES.GATEWAY_STATUS_GET:
        return {
          status: "completed",
          traceId: traceId,
          gatewayStatus: await GatewayClient.getStatus()
        };
      case MESSAGE_TYPES.GATEWAY_CONNECT:
        return {
          status: "completed",
          traceId: traceId,
          gatewayStatus: await ensureGatewayConnection()
        };
      case MESSAGE_TYPES.GATEWAY_DISCONNECT:
        return {
          status: "completed",
          traceId: traceId,
          gatewayStatus: await GatewayClient.disconnect()
        };
      case MESSAGE_TYPES.GATEWAY_SELECT_FILE:
        await ensureGatewayConnection();
        return handleGatewaySelectFile(traceId);
      case MESSAGE_TYPES.GATEWAY_EXECUTE_UPLOAD:
        await ensureGatewayConnection();
        return handleGatewayExecuteUpload(traceId);
      case MESSAGE_TYPES.GATEWAY_EXPORT_DIAGNOSTICS: {
        const diagnostics = await DiagnosticStore.exportDiagnostics(
          await SiteProfile.loadSiteProfile(),
          siteConfig,
          {
            deepseekProfile: DeepSeekSiteProfile.cloneDefaultProfile(),
            gatewayStatus: await GatewayClient.getStatus()
          }
        );
        return {
          status: "completed",
          traceId: traceId,
          diagnostics: diagnostics
        };
      }
      default:
        throw Errors.createError("UNSUPPORTED_MESSAGE", "Unsupported background message type.", {
          actual: message.type
        });
    }
  }

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

    await updateRuntimeStatus({ initialized: true });

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.EXTENSION_BOOTSTRAP_COMPLETED,
      traceId: Telemetry.createTraceId("bootstrap"),
      siteId: siteConfig.siteId,
      component: "background",
      level: "info",
      message: "Extension bootstrap completed"
    });
  }

  chrome.runtime.onInstalled.addListener(async function onInstalled() {
    await initializeBackground();
    await updateRuntimeStatus({ installed: true });
  });

  chrome.runtime.onStartup.addListener(async function onStartup() {
    await updateRuntimeStatus({ started: true });
  });

  chrome.tabs.onActivated.addListener(function onTabActivated() {
    updateRuntimeStatus().catch(function noop() {});
  });

  chrome.tabs.onUpdated.addListener(function onTabUpdated(tabId, changeInfo) {
    if (changeInfo.status === "complete") {
      updateRuntimeStatus().catch(function noop() {});
    }
  });

  chrome.runtime.onMessage.addListener(function onMessage(message, sender, sendResponse) {
    handleMessage(message)
      .then(sendResponse)
      .catch(async function handleError(error) {
        const structuredError = Errors.toStructuredError(error);
        await DiagnosticStore.recordError(structuredError);
        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.EXTENSION_MESSAGE_FAILED,
          traceId: message && message.traceId ? message.traceId : Telemetry.createTraceId("error"),
          siteId: siteConfig.siteId,
          component: "background",
          level: "error",
          message: structuredError.message,
          data: structuredError
        });
        sendResponse({
          status: "failed",
          error: structuredError
        });
    });
    return true;
  });

  initializeBackground().catch(function logBootstrapError(error) {
    console.error("Background initialization failed", error);
  });
})(globalThis);
