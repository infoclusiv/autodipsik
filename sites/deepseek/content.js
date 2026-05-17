(function initDeepSeekContent(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};

  if (DeepSeekAutomation.__contentScriptInitialized) {
    return;
  }

  DeepSeekAutomation.__contentScriptInitialized = true;
  DeepSeekAutomation.__contentScriptLoadedAt = new Date().toISOString();

  const MESSAGE_TYPES = NewSiteCore.MESSAGE_TYPES;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Telemetry = NewSiteCore.Telemetry;
  const Errors = NewSiteCore.Errors;
  const DiagnosticStore = NewSiteCore.DiagnosticStore;
  const DeepSeekWorkflowContracts = NewSiteCore.DeepSeekWorkflowContracts;
  const DeepSeekSiteProfile = DeepSeekAutomation.DeepSeekSiteProfile;
  const Selectors = DeepSeekAutomation.DeepSeekSelectors;
  const DomHelpers = DeepSeekAutomation.DeepSeekDomHelpers;
  const PageState = DeepSeekAutomation.DeepSeekPageState;
  const Automator = DeepSeekAutomation.ChatAutomator;
  const FilePayloadHelpers = DeepSeekAutomation.FilePayloadHelpers;

  console.debug("[Autodipsik][DeepSeek] content script loaded", {
    url: location.href,
    loadedAt: DeepSeekAutomation.__contentScriptLoadedAt
  });

  async function attachFileToDeepSeek(filePayload, traceId) {
    const profile = await DeepSeekSiteProfile.loadSiteProfile();

    const input = await Selectors.waitForElement(
      profile.selectors.fileInput,
      profile.upload.elementWaitTimeoutMs,
      profile.upload.pollIntervalMs
    );

    if (!input) {
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.DEEPSEEK_FILE_INPUT_NOT_FOUND,
        traceId: traceId,
        siteId: profile.siteId,
        component: "content",
        level: "error",
        message: "DeepSeek file input not found",
        data: { selector: profile.selectors.fileInput, snapshot: DomHelpers.getUploadSnapshot() }
      });
      throw Errors.createError("DEEPSEEK_FILE_INPUT_NOT_FOUND", "Could not find the DeepSeek file input.", {
        expected: "A file input matching the DeepSeek site profile should exist in the DOM.",
        actual: "No matching input[type='file'] element was found before timeout.",
        recoverable: true,
        suggestedFix: "Open the attachment menu manually or adjust the DeepSeek file input selector.",
        selector: profile.selectors.fileInput,
        pageSummary: DomHelpers.getUploadSnapshot()
      });
    }

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.DEEPSEEK_FILE_INPUT_FOUND,
      traceId: traceId,
      siteId: profile.siteId,
      component: "content",
      level: "info",
      message: "DeepSeek file input found",
      data: { selector: profile.selectors.fileInput }
    });

    const file = FilePayloadHelpers.base64ToFile(filePayload.contentBase64, filePayload.name, filePayload.mimeType);
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;

    profile.upload.dispatchEvents.forEach(function dispatchEventName(eventName) {
      input.dispatchEvent(new Event(eventName, { bubbles: true }));
    });

    await new Promise(function wait(resolve) {
      setTimeout(resolve, profile.upload.waitAfterAttachMs || 1500);
    });

    await DiagnosticStore.recordRuntimeSnapshot({
      traceId: traceId,
      stage: "deepseek_attach_file",
      url: location.href,
      uploadSnapshot: profile.diagnostics.captureDomUploadState ? DomHelpers.getUploadSnapshot() : null
    });

    return {
      status: "completed",
      traceId: traceId,
      attached: true,
      fileName: file.name,
      fileSize: file.size,
      selectorUsed: profile.selectors.fileInput,
      snapshot: profile.diagnostics.captureDomUploadState ? DomHelpers.getUploadSnapshot() : null
    };
  }

  async function getProfile(message) {
    return message && message.profile
      ? DeepSeekSiteProfile.normalizeSiteProfile(message.profile)
      : DeepSeekSiteProfile.loadSiteProfile();
  }

  async function handleSelectorTest(message) {
    const traceId = message.traceId || Telemetry.createTraceId("selector");
    const profile = await getProfile(message);
    const selectorName = message.selectorName;
    const selector = message.selector || profile.selectors[selectorName] || "";

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.SELECTOR_TEST_STARTED,
      traceId: traceId,
      siteId: "deepseek",
      component: "content",
      level: "info",
      message: "Selector test started",
      data: { selectorName: selectorName, selector: selector }
    });

    const result = await Selectors.testSelector({ selectorName: selectorName, selector: selector });
    await DiagnosticStore.recordSelectorHealth(Object.assign({ traceId: traceId, url: location.href }, result));

    await Telemetry.emit({
      eventName: result.status === "found" ? TELEMETRY_EVENTS.SELECTOR_TEST_COMPLETED : TELEMETRY_EVENTS.SELECTOR_TEST_FAILED,
      traceId: traceId,
      siteId: "deepseek",
      component: "content",
      level: result.status === "found" ? "info" : "warn",
      message: "Selector test finished",
      data: result
    });

    return {
      status: "completed",
      traceId: traceId,
      result: result
    };
  }

  async function handleSelectorTestAll(message) {
    const traceId = message.traceId || Telemetry.createTraceId("selector");
    const profile = await getProfile(message);
    const result = await Automator.testAllSelectors({ profile: profile, traceId: traceId });

    for (const entry of result.selectorHealth) {
      await DiagnosticStore.recordSelectorHealth(Object.assign({ traceId: traceId, url: location.href }, entry));
    }

    return result;
  }

  async function handlePageStateDetect(message) {
    const traceId = message.traceId || Telemetry.createTraceId("page");
    const profile = await getProfile(message);

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.PAGE_STATE_DETECT_STARTED,
      traceId: traceId,
      siteId: "deepseek",
      component: "content",
      level: "info",
      message: "Page-state detection started"
    });

    try {
      const pageState = PageState.detectPageState(profile);
      const payload = {
        traceId: traceId,
        url: location.href,
        pageState: pageState,
        pageSummary: DomHelpers.getPageSummary()
      };

      await DiagnosticStore.recordPageState(payload);
      await DiagnosticStore.recordContentScriptHealth({
        traceId: traceId,
        available: true,
        activeTabUrl: location.href,
        checkedAt: new Date().toISOString()
      });
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.PAGE_STATE_DETECT_COMPLETED,
        traceId: traceId,
        siteId: "deepseek",
        component: "content",
        level: "info",
        message: "Page-state detection completed",
        data: payload
      });

      return {
        status: "completed",
        traceId: traceId,
        pageState: pageState,
        pageSummary: payload.pageSummary
      };
    } catch (error) {
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.PAGE_STATE_DETECT_FAILED,
        traceId: traceId,
        siteId: "deepseek",
        component: "content",
        level: "error",
        message: error.message
      });
      throw error;
    }
  }

  async function handleRunAutomation(message) {
    const traceId = message.traceId || Telemetry.createTraceId("workflow");
    DeepSeekWorkflowContracts.validateRunAutomationInput(message.input || {}, {
      messageType: message.type
    });
    const profile = await getProfile(message);
    await DiagnosticStore.recordContentScriptHealth({
      traceId: traceId,
      available: true,
      activeTabUrl: location.href,
      checkedAt: new Date().toISOString()
    });
    const result = await Automator.runMainAutomation({
      profile: profile,
      input: message.input || {},
      traceId: traceId
    });

    await DiagnosticStore.setLastWorkflow({
      workflowId: result.workflowId,
      traceId: result.traceId,
      failedStep: result.failedStep || "",
      failedStage: result.failedStage || "",
      status: result.status,
      startedAt: result.timeline && result.timeline[0] ? result.timeline[0].startedAt : new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      timeline: result.timeline || [],
      error: result.error || null,
      diagnosticPackage: result.diagnosticPackage || null
    });

    if (result.error) {
      await DiagnosticStore.recordError(result.error);
    }

    if (result.diagnosticPackage) {
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.DIAGNOSTIC_PACKAGE_CREATED,
        traceId: traceId,
        workflowId: result.workflowId,
        siteId: "deepseek",
        component: "content",
        level: "warn",
        message: "AI-ready diagnostic package created"
      });
      await DiagnosticStore.recordError({
        code: "DEEPSEEK_DIAGNOSTIC_PACKAGE_CREATED",
        message: "DeepSeek automation diagnostic package created.",
        expected: result.diagnosticPackage.expected || "",
        actual: result.diagnosticPackage.actual || "",
        traceId: traceId,
        workflowId: result.workflowId,
        failedStage: result.failedStage || "",
        workflowStep: result.failedStep || "",
        pageSummary: result.diagnosticPackage.composerDomSummary || null
      });
    }

    return result;
  }

  chrome.runtime.onMessage.addListener(function onMessage(message, sender, sendResponse) {
    if (!message || !message.type) {
      return;
    }

    (async function routeMessage() {
      switch (message.type) {
        case MESSAGE_TYPES.SELECTOR_TEST:
          return handleSelectorTest(message);
        case MESSAGE_TYPES.SELECTOR_TEST_ALL:
          return handleSelectorTestAll(message);
        case MESSAGE_TYPES.PAGE_STATE_DETECT:
          return handlePageStateDetect(message);
        case MESSAGE_TYPES.RUN_AUTOMATION:
          return handleRunAutomation(message);
        case MESSAGE_TYPES.DEEPSEEK_CONTENT_SCRIPT_PING:
          return {
            status: "completed",
            siteId: "deepseek",
            contentScript: "sites/deepseek/content.js",
            available: true,
            url: location.href,
            loadedAt: DeepSeekAutomation.__contentScriptLoadedAt || "",
            traceId: message.traceId || Telemetry.createTraceId("deepseek_ping")
          };
        case MESSAGE_TYPES.DIAGNOSTICS_GET:
          return {
            status: "completed",
            traceId: message.traceId || Telemetry.createTraceId("diag"),
            pageSummary: DomHelpers.getPageSummary(),
            uploadSnapshot: DomHelpers.getUploadSnapshot()
          };
        case MESSAGE_TYPES.DEEPSEEK_ATTACH_FILE:
          return attachFileToDeepSeek(message.file, message.traceId || Telemetry.createTraceId("deepseek"));
        default:
          return {
            status: "ignored",
            message: "Unsupported DeepSeek content message type."
          };
      }
    })()
      .then(sendResponse)
      .catch(function handleError(error) {
        sendResponse({
          status: "failed",
          error: Errors.toStructuredError({
            message: error.message,
            actual: "DeepSeek content script message handling failed.",
            url: location.href,
            pageSummary: DomHelpers.getPageSummary()
          })
        });
      });

    return true;
  });
})(globalThis);
