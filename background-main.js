importScripts(
  "core/config.js",
  "core/constants.js",
  "core/errors.js",
  "core/storage.js",
  "core/telemetry.js",
  "core/observabilityContracts.js",
  "core/gatewayProtocol.js",
  "core/gatewayClient.js",
  "core/messaging.js",
  "core/tabManager.js",
  "core/workflowRunner.js",
  "core/diagnosticRedactor.js",
  "core/diagnosticExporter.js",
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
  const AUTOMATION_STAGE_MODULES = {
    ensure_gateway_connected: "background-main.js",
    ensure_file_selected: "background-main.js",
    ensure_deepseek_tab: "background-main.js",
    detect_page_state: "sites/deepseek/content.js",
    run_preflight: "sites/deepseek/chatAutomator.js",
    run_actual_automation: "sites/deepseek/chatAutomator.js"
  };

  function resolveSiteProfileService(targetSiteId) {
    if (targetSiteId === "deepseek") {
      return {
        config: deepSeekConfig,
        profileService: DeepSeekSiteProfile,
        storageKey: NewSiteCore.STORAGE_KEYS.DEEPSEEK_SITE_PROFILE
      };
    }

    return {
      config: siteConfig,
      profileService: SiteProfile,
      storageKey: NewSiteCore.STORAGE_KEYS.SITE_PROFILE
    };
  }

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
    const activeTab = await ensureDeepSeekTab(message.traceId);

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
      return await TabManager.sendMessageWithContentScriptCheck(activeTab.id, message);
    } catch (error) {
      await DiagnosticStore.recordContentScriptHealth({
        traceId: message.traceId,
        available: false,
        activeTabUrl: activeTab.url || "",
        checkedAt: new Date().toISOString(),
        reason: error.message
      });
      throw Errors.createError("CONTENT_SCRIPT_UNAVAILABLE", "DeepSeek content script is unavailable.", {
        expected: "The DeepSeek content script should be active on the current tab.",
        actual: error.message,
        activeTabUrl: activeTab.url || "",
        messageType: message.type,
        manifestMatchExpectation: deepSeekConfig.urlPattern,
        contentScriptHandler: "sites/deepseek/content.js",
        suggestedFix: [
          "Reload the DeepSeek tab.",
          "Reload the extension.",
          "Verify manifest content_scripts for https://chat.deepseek.com/*.",
          "Verify sites/deepseek/content.js supports the message type."
        ]
      });
    }
  }

  async function forwardToSiteAwareTab(message) {
    const activeTab = await TabManager.getActiveTab();
    const activeUrl = activeTab && activeTab.url ? activeTab.url : "";

    if (deepSeekConfig.isDeepSeekUrl(activeUrl)) {
      return forwardToDeepSeekTab(message);
    }

    return forwardToActiveTab(message);
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
    const result = {
      status: "completed",
      traceId: traceId,
      gatewayStatus: await GatewayClient.getStatus(),
      file: response.payload || null
    };
    await DiagnosticStore.recordGatewaySnapshot({
      traceId: traceId,
      stage: "ensure_file_selected",
      gatewayStatus: result.gatewayStatus
    });
    return result;
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

  async function resolveAutomationFilePayload(input) {
    if (!input || input.dryRun) {
      return null;
    }

    await ensureGatewayConnection();

    const gatewayStatus = await GatewayClient.getStatus();
    let selectedFile = null;

    if (input.fileId) {
      selectedFile = {
        fileId: input.fileId,
        name: input.fileName || "",
        extension: input.fileExtension || ""
      };
    } else if (gatewayStatus && gatewayStatus.selectedFile) {
      selectedFile = gatewayStatus.selectedFile;
    }

    if (!selectedFile && input.filePath) {
      const fileByPathResponse = await GatewayClient.request(
        GatewayProtocol.GATEWAY_MESSAGE_TYPES.FILE_CONTENT_BY_PATH_REQUEST,
        {
          path: input.filePath
        }
      );
      return fileByPathResponse.payload || null;
    }

    if (!selectedFile || !selectedFile.fileId) {
      throw Errors.createError("GATEWAY_FILE_NOT_SELECTED", "No Excel file has been selected through the gateway.", {
        expected: "Automation Tester should select an Excel file through the gateway before running automation.",
        actual: "No gateway selectedFile or input.fileId is available.",
        gatewayStatus: gatewayStatus,
        suggestedFix: "Click Select Excel File in Automation Tester before running the workflow."
      });
    }

    const allowedExtensions = [".xls", ".xlsx"];
    if (
      selectedFile.extension
      && allowedExtensions.indexOf(String(selectedFile.extension).toLowerCase()) === -1
    ) {
      throw Errors.createError("FILE_EXTENSION_NOT_ALLOWED", "The selected file is not an Excel file.", {
        expected: "One of: " + allowedExtensions.join(", "),
        actual: selectedFile.extension
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
      eventName: TELEMETRY_EVENTS.DEEPSEEK_FILE_PAYLOAD_RESOLVED,
      traceId: input.traceId || Telemetry.createTraceId("payload"),
      siteId: "deepseek",
      component: "background",
      level: "info",
      message: "DeepSeek file payload resolved",
      data: {
        fileId: selectedFile.fileId,
        fileName: selectedFile.name || "",
        extension: selectedFile.extension || ""
      }
    });

    return fileResponse.payload || null;
  }

  async function ensureDeepSeekTab(traceId) {
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
      await TabManager.waitForTabComplete(tab.id, 20000);
      await DiagnosticStore.recordRuntimeSnapshot({
        traceId: traceId,
        stage: "ensure_deepseek_tab",
        url: tab.url || deepSeekConfig.baseUrl,
        tabId: tab.id,
        title: tab.title || ""
      });
      await DiagnosticStore.recordContentScriptHealth({
        traceId: traceId,
        available: true,
        activeTabUrl: tab.url || deepSeekConfig.baseUrl,
        checkedAt: new Date().toISOString()
      });
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.DEEPSEEK_TAB_ENSURE_COMPLETED,
        traceId: traceId,
        siteId: "deepseek",
        component: "background",
        level: "info",
        message: "DeepSeek tab is ready",
        data: { tabId: tab.id, url: tab.url || deepSeekConfig.baseUrl }
      });
      return tab;
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

  async function runAutomationStage(traceId, stageName, fn) {
    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.AUTOMATION_ONE_CLICK_PRECONDITION_STARTED,
      traceId: traceId,
      siteId: "deepseek",
      component: "background",
      level: "info",
      message: "Automation one-click stage started",
      stage: stageName
    });

    try {
      const result = await fn();
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.AUTOMATION_ONE_CLICK_PRECONDITION_COMPLETED,
        traceId: traceId,
        siteId: "deepseek",
        component: "background",
        level: "info",
        message: "Automation one-click stage completed",
        stage: stageName
      });
      return result;
    } catch (error) {
      const structured = Errors.toStructuredError(error);
      structured.traceId = structured.traceId || traceId;
      structured.failedStage = structured.failedStage || stageName;
      structured.probableCause = structured.probableCause || AUTOMATION_STAGE_MODULES[stageName] || "background-main.js";
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.AUTOMATION_ONE_CLICK_PRECONDITION_FAILED,
        traceId: traceId,
        siteId: "deepseek",
        component: "background",
        level: "error",
        message: structured.message,
        stage: stageName,
        expected: structured.expected,
        actual: structured.actual,
        data: structured
      });
      throw structured;
    }
  }

  async function handleAutomationOneClick(message) {
    const traceId = message.traceId;
    const input = Object.assign({
      promptText: "",
      autoConnectGateway: true,
      autoOpenDeepSeek: true,
      autoSelectFileIfMissing: true,
      runPreflight: true,
      runActualAutomation: true
    }, message.input || {});

    if (!input.promptText) {
      throw Errors.createError("PROMPT_REQUIRED", "Prompt text is required.", {
        traceId: traceId,
        failedStage: "validate_input",
        expected: "A non-empty prompt should be provided before running automation.",
        actual: "The one-click request did not include prompt text."
      });
    }

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.AUTOMATION_ONE_CLICK_STARTED,
      traceId: traceId,
      siteId: "deepseek",
      component: "background",
      level: "info",
      message: "Automation one-click run started"
    });

    let gatewayStatus = await GatewayClient.getStatus();
    let selectedFile = gatewayStatus.selectedFile || null;
    let pageState = null;
    let workflowId = "";
    let automationResult = null;

    try {
      gatewayStatus = await runAutomationStage(traceId, "ensure_gateway_connected", async function ensureGatewayConnected() {
        const status = input.autoConnectGateway ? await ensureGatewayConnection() : await GatewayClient.getStatus();
        await DiagnosticStore.recordGatewaySnapshot({
          traceId: traceId,
          stage: "ensure_gateway_connected",
          gatewayStatus: status
        });
        return status;
      });

      selectedFile = await runAutomationStage(traceId, "ensure_file_selected", async function ensureFileSelected() {
        let currentStatus = await GatewayClient.getStatus();
        if (!currentStatus.selectedFile && input.autoSelectFileIfMissing) {
          const selection = await handleGatewaySelectFile(traceId);
          currentStatus = selection.gatewayStatus || currentStatus;
        }
        if (!currentStatus.selectedFile || !currentStatus.selectedFile.fileId) {
          throw Errors.createError("FILE_SELECTION_CANCELLED", "No file was selected for the workflow.", {
            traceId: traceId,
            failedStage: "ensure_file_selected",
            expected: "A gateway-selected Excel file should be available.",
            actual: "The file picker completed without a selected file.",
            nextChecks: [
              "Run automation again and select an Excel file when prompted."
            ]
          });
        }
        gatewayStatus = currentStatus;
        return currentStatus.selectedFile;
      });

      if (input.autoOpenDeepSeek) {
        await runAutomationStage(traceId, "ensure_deepseek_tab", function ensureDeepSeekTabStage() {
          return ensureDeepSeekTab(traceId);
        });
      }

      pageState = await runAutomationStage(traceId, "detect_page_state", async function detectPageStateStage() {
        return await forwardToDeepSeekTab({
          type: MESSAGE_TYPES.PAGE_STATE_DETECT,
          traceId: traceId,
          targetSiteId: "deepseek"
        });
      });

      if (input.runPreflight) {
        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.DEEPSEEK_PREFLIGHT_STARTED,
          traceId: traceId,
          siteId: "deepseek",
          component: "background",
          level: "info",
          message: "DeepSeek preflight started"
        });
        const preflightResult = await runAutomationStage(traceId, "run_preflight", async function preflightStage() {
          return await forwardToDeepSeekTab({
            type: MESSAGE_TYPES.RUN_AUTOMATION,
            traceId: traceId,
            targetSiteId: "deepseek",
            input: {
              dryRun: true,
              promptText: input.promptText,
              useGatewaySelectedFile: true,
              selectedFile: selectedFile
            }
          });
        });
        workflowId = preflightResult.workflowId || workflowId;
        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.DEEPSEEK_PREFLIGHT_COMPLETED,
          traceId: traceId,
          siteId: "deepseek",
          component: "background",
          level: "info",
          message: "DeepSeek preflight completed",
          data: { workflowId: preflightResult.workflowId || "" }
        });
      }

      if (input.runActualAutomation) {
        automationResult = await runAutomationStage(traceId, "run_actual_automation", async function actualStage() {
          const nextMessage = {
            type: MESSAGE_TYPES.RUN_AUTOMATION,
            traceId: traceId,
            targetSiteId: "deepseek",
            input: {
              dryRun: false,
              promptText: input.promptText,
              useGatewaySelectedFile: true,
              selectedFile: selectedFile,
              fileId: selectedFile.fileId,
              fileName: selectedFile.name,
              fileExtension: selectedFile.extension
            }
          };
          nextMessage.input.filePayload = await resolveAutomationFilePayload({
            traceId: traceId,
            fileId: selectedFile.fileId,
            fileName: selectedFile.name,
            fileExtension: selectedFile.extension,
            dryRun: false
          });
          return forwardToDeepSeekTab(nextMessage);
        });
        workflowId = automationResult.workflowId || workflowId;
      }

      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.AUTOMATION_ONE_CLICK_COMPLETED,
        traceId: traceId,
        siteId: "deepseek",
        component: "background",
        level: "info",
        message: "Automation one-click run completed"
      });

      return {
        status: "completed",
        traceId: traceId,
        workflowId: workflowId,
        stage: "completed",
        failedStage: "",
        failedStep: automationResult && automationResult.failedStep ? automationResult.failedStep : "",
        gatewayStatus: await GatewayClient.getStatus(),
        selectedFile: selectedFile,
        pageState: pageState,
        automationResult: automationResult,
        diagnosticPackageReady: Boolean(automationResult && automationResult.diagnosticPackage),
        error: null
      };
    } catch (error) {
      const structured = Errors.toStructuredError(error);
      structured.traceId = structured.traceId || traceId;
      await DiagnosticStore.recordError(structured);
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.AUTOMATION_ONE_CLICK_FAILED,
        traceId: traceId,
        siteId: "deepseek",
        component: "background",
        level: "error",
        message: structured.message,
        stage: structured.failedStage || "",
        expected: structured.expected,
        actual: structured.actual,
        data: structured
      });
      return {
        status: "failed",
        traceId: traceId,
        workflowId: workflowId,
        stage: structured.failedStage || "failed",
        failedStage: structured.failedStage || "",
        failedStep: structured.workflowStep || "",
        gatewayStatus: await GatewayClient.getStatus(),
        selectedFile: selectedFile,
        pageState: pageState,
        automationResult: automationResult,
        diagnosticPackageReady: true,
        error: structured
      };
    }
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
        {
          const profileService = resolveSiteProfileService(message.targetSiteId).profileService;
        return {
          status: "completed",
          traceId: traceId,
          profile: await profileService.loadSiteProfile()
        };
        }
      case MESSAGE_TYPES.PROFILE_SAVE: {
        const profileService = resolveSiteProfileService(message.targetSiteId).profileService;
        const saveResult = await profileService.saveSiteProfile(message.profile);
        return {
          status: saveResult.valid ? "completed" : "failed",
          traceId: traceId,
          validation: saveResult
        };
      }
      case MESSAGE_TYPES.PROFILE_RESET: {
        const profileInfo = resolveSiteProfileService(message.targetSiteId);
        const profile = profileInfo.profileService.cloneDefaultProfile();
        await Storage.setValue(profileInfo.storageKey, profile);
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
        const profileInfo = resolveSiteProfileService(message.targetSiteId || "deepseek");
        const profile = await profileInfo.profileService.loadSiteProfile();
        const contentContext = await forwardToActiveTab(message).catch(function swallowContentError() {
          return { status: "failed", pageSummary: null };
        });
        const diagnostics = await DiagnosticStore.exportDiagnostics(profile, profileInfo.config);
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

        const profileInfo = resolveSiteProfileService(message.targetSiteId || "deepseek");
        const profile = await profileInfo.profileService.loadSiteProfile();
        const diagnostics = await DiagnosticStore.exportDiagnostics(profile, profileInfo.config, {
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
        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.DIAGNOSTIC_PACKAGE_EXPORTED,
          traceId: traceId,
          siteId: profileInfo.config.siteId,
          component: "background",
          level: "info",
          message: "AI-ready diagnostic package exported"
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
        return forwardToSiteAwareTab(message);
      case MESSAGE_TYPES.DEEPSEEK_TAB_ENSURE:
        return {
          status: "completed",
          traceId: traceId,
          tab: await ensureDeepSeekTab(traceId)
        };
      case MESSAGE_TYPES.RUN_AUTOMATION: {
        const nextMessage = Object.assign({}, message, {
          input: Object.assign({}, message.input || {})
        });
        nextMessage.input.filePayload = await resolveAutomationFilePayload(nextMessage.input);
        const gatewayStatus = await GatewayClient.getStatus();
        const result = await forwardToDeepSeekTab(nextMessage);
        if (result && typeof result === "object") {
          result.gatewayStatus = gatewayStatus;
        }
        return result;
      }
      case MESSAGE_TYPES.AUTOMATION_ONE_CLICK_RUN:
        return handleAutomationOneClick(message);
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
          await DeepSeekSiteProfile.loadSiteProfile(),
          deepSeekConfig,
          {
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
