(function initAutomationStore(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};

  NewSiteSidepanel.AutomationTesterStore = {
    state: {
      gatewayStatus: null,
      selectedFile: null,
      fileSelectionResult: null,
      runtimeStatus: null,
      pageState: null,
      workflowResult: null,
      conditionalWorkflowText: "",
      conditionalWorkflowResult: null,
      conditionalWorkflowParseError: "",
      lastRunSummary: null,
      lastError: null,
      promptText: "",
      isConnectingGateway: false,
      isSelectingFile: false,
      isRunningAutomation: false,
      isRunningConditionalWorkflow: false
    }
  };
})(globalThis);
