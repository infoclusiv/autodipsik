(function initAutomationRunOrchestrator(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const messaging = NewSiteSidepanel.ChromeMessaging;
  const MESSAGE_TYPES = globalScope.NewSiteCore.MESSAGE_TYPES;

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
    runConditionalWorkflow: runConditionalWorkflow
  };
})(globalThis);
