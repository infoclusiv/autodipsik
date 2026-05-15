(function initMessageRouter(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  const MESSAGE_TYPES = NewSiteCore.MESSAGE_TYPES;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Telemetry = NewSiteCore.Telemetry;
  const Errors = NewSiteCore.Errors;
  const DiagnosticStore = NewSiteCore.DiagnosticStore;
  const MessageContracts = NewSiteCore.MessageContracts;
  const siteId = globalScope.NewSiteAutomation.NEWSITE_CONFIG.siteId;

  const handlers = {};
  handlers[MESSAGE_TYPES.PROFILE_GET] = NewSiteBackground.ProfileHandlers.getProfile;
  handlers[MESSAGE_TYPES.PROFILE_SAVE] = NewSiteBackground.ProfileHandlers.saveProfile;
  handlers[MESSAGE_TYPES.PROFILE_RESET] = NewSiteBackground.ProfileHandlers.resetProfile;
  handlers[MESSAGE_TYPES.RUNTIME_STATUS_GET] = async function handleRuntimeStatus(message) {
    return {
      status: "completed",
      traceId: message.traceId,
      runtimeStatus: await NewSiteBackground.RuntimeStatusService.update()
    };
  };
  handlers[MESSAGE_TYPES.DIAGNOSTICS_GET] = NewSiteBackground.DiagnosticsHandlers.getDiagnostics;
  handlers[MESSAGE_TYPES.EXPORT_DIAGNOSTICS] = NewSiteBackground.DiagnosticsHandlers.exportDiagnostics;
  handlers[MESSAGE_TYPES.SELECTOR_TEST] = NewSiteBackground.TabHandlers.testOrDetect;
  handlers[MESSAGE_TYPES.SELECTOR_TEST_ALL] = NewSiteBackground.TabHandlers.testOrDetect;
  handlers[MESSAGE_TYPES.PAGE_STATE_DETECT] = NewSiteBackground.TabHandlers.testOrDetect;
  handlers[MESSAGE_TYPES.DEEPSEEK_TAB_ENSURE] = NewSiteBackground.TabHandlers.ensureDeepSeekTab;
  handlers[MESSAGE_TYPES.RUN_AUTOMATION] = NewSiteBackground.AutomationHandlers.runAutomation;
  handlers[MESSAGE_TYPES.AUTOMATION_ONE_CLICK_RUN] = NewSiteBackground.AutomationHandlers.runOneClick;
  handlers[MESSAGE_TYPES.GATEWAY_STATUS_GET] = NewSiteBackground.GatewayHandlers.getStatus;
  handlers[MESSAGE_TYPES.GATEWAY_CONNECT] = NewSiteBackground.GatewayHandlers.connect;
  handlers[MESSAGE_TYPES.GATEWAY_DISCONNECT] = NewSiteBackground.GatewayHandlers.disconnect;
  handlers[MESSAGE_TYPES.GATEWAY_SELECT_FILE] = NewSiteBackground.GatewayHandlers.selectFile;
  handlers[MESSAGE_TYPES.GATEWAY_EXECUTE_UPLOAD] = NewSiteBackground.GatewayHandlers.executeUpload;
  handlers[MESSAGE_TYPES.GATEWAY_EXPORT_DIAGNOSTICS] = NewSiteBackground.DiagnosticsHandlers.exportGatewayDiagnostics;

  async function handle(message) {
    const nextMessage = message || {};
    MessageContracts.validateBaseMessage(nextMessage);
    const traceId = nextMessage.traceId || Telemetry.createTraceId("bg");
    nextMessage.traceId = traceId;

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.EXTENSION_MESSAGE_RECEIVED,
      traceId: traceId,
      siteId: siteId,
      component: "background",
      level: "info",
      message: "Background received a message",
      data: { type: nextMessage.type }
    });

    const handler = handlers[nextMessage.type];
    if (!handler) {
      throw Errors.createError("UNSUPPORTED_MESSAGE", "Unsupported background message type.", {
        expected: "A registered background message handler.",
        actual: nextMessage.type || ""
      });
    }

    return handler(nextMessage);
  }

  function handleRuntimeMessage(message, sender, sendResponse) {
    handle(message)
      .then(sendResponse)
      .catch(async function handleError(error) {
        const structuredError = Errors.toStructuredError(error);
        await DiagnosticStore.recordError(structuredError);
        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.EXTENSION_MESSAGE_FAILED,
          traceId: message && message.traceId ? message.traceId : Telemetry.createTraceId("error"),
          siteId: siteId,
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
  }

  NewSiteBackground.MessageRouter = {
    handle: handle,
    handleRuntimeMessage: handleRuntimeMessage
  };
})(globalThis);
