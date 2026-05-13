(function initAutomationStore(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};

  NewSiteSidepanel.AutomationTesterStore = {
    state: {
      runtimeStatus: null,
      pageState: null,
      workflowResult: null,
      lastError: null
    }
  };
})(globalThis);
