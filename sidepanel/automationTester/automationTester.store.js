(function initAutomationStore(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};

  NewSiteSidepanel.AutomationTesterStore = {
    state: {
      gatewayStatus: null,
      selectedFile: null,
      selectedFiles: [],
      fileSelectionResult: null,
      batchSelectionResult: null,
      batchRunResult: null,
      runtimeStatus: null,
      pageState: null,
      conditionalWorkflowText: "",
      conditionalWorkflowResult: null,
      conditionalWorkflowParseError: "",
      lastRunSummary: null,
      lastError: null,
      isConnectingGateway: false,
      isSelectingFile: false,
      isSelectingFiles: false,
      isRunningConditionalWorkflow: false,
      isRunningBatchConditionalWorkflow: false
    }
  };
})(globalThis);
