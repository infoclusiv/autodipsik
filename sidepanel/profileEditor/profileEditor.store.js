(function initProfileEditorStore(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};

  const state = {
    profile: null,
    validationErrors: [],
    selectorResults: {}
  };

  NewSiteSidepanel.ProfileEditorStore = {
    state: state
  };
})(globalThis);
