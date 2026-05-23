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

  async function runConditionalWorkflow(input) {
    return messaging.sendMessage({
      type: MESSAGE_TYPES.CONDITIONAL_WORKFLOW_RUN,
      input: {
        definition: input.definition || null,
        autoConnectGateway: true,
        autoOpenDeepSeek: true,
        autoSelectFileIfMissing: true
      }
    });
  }

  NewSiteSidepanel.AutomationRunOrchestrator = {
    runOneClick: runOneClick,
    runConditionalWorkflow: runConditionalWorkflow
  };
})(globalThis);
