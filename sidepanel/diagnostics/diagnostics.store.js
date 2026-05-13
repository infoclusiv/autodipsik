(function initDiagnosticsStore(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};

  NewSiteSidepanel.DiagnosticsStore = {
    state: {
      diagnostics: null,
      levelFilter: "",
      traceFilter: ""
    }
  };
})(globalThis);
