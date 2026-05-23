(function initWorkflowLabBootstrap(globalScope) {
  const WorkflowLab = globalScope.WorkflowLab = globalScope.WorkflowLab || {};

  function boot() {
    WorkflowLab.Controller.mount(document.getElementById("workflow-lab-root"));
  }

  document.addEventListener("DOMContentLoaded", boot);
})(globalThis);
