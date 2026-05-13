(function initLogView(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};

  function renderJson(data) {
    return JSON.stringify(data, null, 2);
  }

  NewSiteSidepanel.LogView = {
    renderJson: renderJson
  };
})(globalThis);
