(function initSidepanel(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const Dom = NewSiteSidepanel.Dom;

  function activateTab(tabName) {
    Dom.qsa(".tab-button").forEach(function toggleTab(button) {
      button.classList.toggle("is-active", button.getAttribute("data-tab") === tabName);
    });
    Dom.qsa(".panel").forEach(function togglePanel(panel) {
      panel.classList.toggle("is-active", panel.getAttribute("data-panel") === tabName);
    });
  }

  function bindTabs() {
    Dom.qsa(".tab-button").forEach(function attach(button) {
      button.addEventListener("click", function onClick() {
        activateTab(button.getAttribute("data-tab"));
      });
    });
  }

  function boot() {
    bindTabs();
    NewSiteSidepanel.DeepSeekUploadController.mount(Dom.byId("deepseek-upload-root"));
    NewSiteSidepanel.ProfileEditorController.mount(Dom.byId("profile-editor-root"));
    NewSiteSidepanel.AutomationTesterController.mount(Dom.byId("automation-tester-root"));
    NewSiteSidepanel.DiagnosticsController.mount(Dom.byId("diagnostics-root"));
  }

  document.addEventListener("DOMContentLoaded", boot);
})(globalThis);
