(function initAutomationStore(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};

  NewSiteSidepanel.AutomationTesterStore = {
    state: {
      gatewayStatus: null,
      selectedFile: null,
      fileSelectionResult: null,
      runtimeStatus: null,
      pageState: null,
      conditionalWorkflowText: "",
      conditionalWorkflowResult: null,
      conditionalWorkflowParseError: "",
      lastRunSummary: null,
      lastError: null,
      isConnectingGateway: false,
      isSelectingFile: false,
      isRunningConditionalWorkflow: false
    }
  };
})(globalThis);
