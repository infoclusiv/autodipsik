(function initAutomationRunOrchestrator(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const messaging = NewSiteSidepanel.ChromeMessaging;
  const MESSAGE_TYPES = globalScope.NewSiteCore.MESSAGE_TYPES;

  async function runOneClick(input) {
    return messaging.sendMessage({
      type: MESSAGE_TYPES.AUTOMATION_ONE_CLICK_RUN,
      input: {
        promptText: input.promptText || "",
        autoConnectGateway: true,
        autoOpenDeepSeek: true,
        autoSelectFileIfMissing: true,
        runPreflight: true,
        runActualAutomation: true
      }
    });
  }

  NewSiteSidepanel.AutomationRunOrchestrator = {
    runOneClick: runOneClick
  };
})(globalThis);
