(function initDiagnosticsHandlers(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};
  const NewSiteAutomation = globalScope.NewSiteAutomation = globalScope.NewSiteAutomation || {};

  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Telemetry = NewSiteCore.Telemetry;
  const DiagnosticStore = NewSiteCore.DiagnosticStore;
  const GatewayClient = NewSiteCore.GatewayClient;

  async function getDiagnostics(message) {
    const profileInfo = NewSiteBackground.SiteProfileResolver.resolve(message.targetSiteId || "deepseek");
    const profile = await profileInfo.profileService.loadSiteProfile();
    const contentContext = await NewSiteBackground.ActiveTabForwarder.forwardToActiveTab(message).catch(function swallowContentError() {
      return { status: "failed", pageSummary: null };
    });
    const diagnostics = await DiagnosticStore.exportDiagnostics(profile, profileInfo.config);
    diagnostics.liveContext = contentContext;
    return {
      status: "completed",
      traceId: message.traceId,
      diagnostics: diagnostics
    };
  }

  async function exportDiagnostics(message) {
    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.DIAGNOSTIC_EXPORT_STARTED,
      traceId: message.traceId,
      siteId: NewSiteAutomation.NEWSITE_CONFIG.siteId,
      component: "background",
      level: "info",
      message: "Diagnostic export started"
    });

    const profileInfo = NewSiteBackground.SiteProfileResolver.resolve(message.targetSiteId || "deepseek");
    const profile = await profileInfo.profileService.loadSiteProfile();
    const diagnostics = await DiagnosticStore.exportDiagnostics(profile, profileInfo.config, {
      gatewayStatus: await GatewayClient.getStatus()
    });

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.DIAGNOSTIC_EXPORT_COMPLETED,
      traceId: message.traceId,
      siteId: NewSiteAutomation.NEWSITE_CONFIG.siteId,
      component: "background",
      level: "info",
      message: "Diagnostic export completed"
    });
    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.DIAGNOSTIC_PACKAGE_EXPORTED,
      traceId: message.traceId,
      siteId: profileInfo.config.siteId,
      component: "background",
      level: "info",
      message: "AI-ready diagnostic package exported"
    });

    return {
      status: "completed",
      traceId: message.traceId,
      diagnostics: diagnostics
    };
  }

  async function exportGatewayDiagnostics(message) {
    const diagnostics = await DiagnosticStore.exportDiagnostics(
      await DeepSeekAutomation.DeepSeekSiteProfile.loadSiteProfile(),
      DeepSeekAutomation.DEEPSEEK_CONFIG,
      {
        gatewayStatus: await GatewayClient.getStatus()
      }
    );
    return {
      status: "completed",
      traceId: message.traceId,
      diagnostics: diagnostics
    };
  }

  NewSiteBackground.DiagnosticsHandlers = {
    getDiagnostics: getDiagnostics,
    exportDiagnostics: exportDiagnostics,
    exportGatewayDiagnostics: exportGatewayDiagnostics
  };
})(globalThis);
