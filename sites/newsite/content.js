(function initContent(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const NewSiteAutomation = globalScope.NewSiteAutomation = globalScope.NewSiteAutomation || {};
  const MESSAGE_TYPES = NewSiteCore.MESSAGE_TYPES;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Telemetry = NewSiteCore.Telemetry;
  const DiagnosticStore = NewSiteCore.DiagnosticStore;
  const SiteProfile = NewSiteAutomation.SiteProfile;
  const Selectors = NewSiteAutomation.Selectors;
  const Automator = NewSiteAutomation.Automator;
  const PageState = NewSiteAutomation.PageState;
  const DomHelpers = NewSiteAutomation.DomHelpers;

  async function getProfile(message) {
    return message && message.profile ? SiteProfile.normalizeSiteProfile(message.profile) : SiteProfile.loadSiteProfile();
  }

  async function handleSelectorTest(message) {
    const traceId = message.traceId || Telemetry.createTraceId("selector");
    const profile = await getProfile(message);
    const selectorName = message.selectorName;
    const selector = message.selector || profile.selectors[selectorName] || "";

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.SELECTOR_TEST_STARTED,
      traceId: traceId,
      siteId: profile.siteId,
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
      siteId: profile.siteId,
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
      siteId: profile.siteId,
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
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.PAGE_STATE_DETECT_COMPLETED,
        traceId: traceId,
        siteId: profile.siteId,
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
        siteId: profile.siteId,
        component: "content",
        level: "error",
        message: error.message
      });
      throw error;
    }
  }

  async function handleRunAutomation(message) {
    const traceId = message.traceId || Telemetry.createTraceId("workflow");
    const profile = await getProfile(message);
    const result = await Automator.runMainAutomation({
      profile: profile,
      input: message.input || {},
      traceId: traceId
    });

    await DiagnosticStore.setLastWorkflow({
      workflowId: result.workflowId,
      traceId: result.traceId,
      failedStep: result.failedStep || "",
      status: result.status,
      startedAt: result.timeline && result.timeline[0] ? result.timeline[0].startedAt : new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      error: result.error || null,
      diagnosticPackage: result.diagnosticPackage || null
    });

    if (result.error) {
      await DiagnosticStore.recordError(result.error);
    }

    if (result.diagnosticPackage) {
      await DiagnosticStore.recordError({
        code: "DEEPSEEK_DIAGNOSTIC_PACKAGE_CREATED",
        message: "DeepSeek automation diagnostic package created.",
        expected: result.diagnosticPackage.expected || "",
        actual: result.diagnosticPackage.actual || "",
        workflowStep: result.failedStep || "",
        pageSummary: result.diagnosticPackage.composerDomSummary || null
      });
    }

    return result;
  }

  chrome.runtime.onMessage.addListener(function handleRuntimeMessage(message, sender, sendResponse) {
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
        case MESSAGE_TYPES.DIAGNOSTICS_GET:
          return {
            status: "completed",
            traceId: message.traceId || Telemetry.createTraceId("diag"),
            pageSummary: DomHelpers.getPageSummary()
          };
        default:
          return {
            status: "ignored",
            message: "Unsupported content message type."
          };
      }
    })()
      .then(sendResponse)
      .catch(function handleError(error) {
        sendResponse({
          status: "failed",
          error: NewSiteCore.Errors.toStructuredError({
            message: error.message,
            actual: "Content script message handling failed.",
            url: location.href,
            pageSummary: DomHelpers.getPageSummary()
          })
        });
      });

    return true;
  });
})(globalThis);
