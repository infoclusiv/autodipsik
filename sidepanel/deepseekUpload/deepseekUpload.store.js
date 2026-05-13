(function initDeepSeekUploadStore(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};

  NewSiteSidepanel.DeepSeekUploadStore = {
    state: {
      gatewayStatus: null,
      lastResult: null,
      lastError: null,
      diagnostics: null
    }
  };
})(globalThis);
