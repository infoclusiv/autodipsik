(function initWorkflowLabStore(globalScope) {
  const WorkflowLab = globalScope.WorkflowLab = globalScope.WorkflowLab || {};

  WorkflowLab.Store = {
    state: {
      gatewayStatus: null,
      selectedFile: null,
      conditionalWorkflowText: "",
      conditionalWorkflowResult: null,
      conditionalWorkflowParseError: "",
      isRunningConditionalWorkflow: false,
      lastError: null
    }
  };
})(globalThis);
