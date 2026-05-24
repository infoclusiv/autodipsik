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

  async function runConditionalWorkflowBatch(input) {
    return messaging.sendMessage({
      type: MESSAGE_TYPES.CONDITIONAL_WORKFLOW_BATCH_RUN,
      input: {
        definition: input.definition || null,
        selectedFiles: Array.isArray(input.selectedFiles) ? input.selectedFiles : [],
        continueOnError: input && input.continueOnError === true,
        autoConnectGateway: true,
        maxNodes: input && typeof input.maxNodes !== "undefined" ? input.maxNodes : null
      }
    });
  }

  NewSiteSidepanel.AutomationRunOrchestrator = {
    runConditionalWorkflow: runConditionalWorkflow,
    runConditionalWorkflowBatch: runConditionalWorkflowBatch
  };
})(globalThis);
