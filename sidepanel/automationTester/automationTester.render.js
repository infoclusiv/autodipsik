(function initAutomationRender(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const store = NewSiteSidepanel.AutomationTesterStore.state;
  const sections = NewSiteSidepanel.AutomationTesterSections;

  function buildViewModel() {
    const runtime = store.runtimeStatus || {};
    const pageState = store.pageState || {};
    const gatewayStatus = store.gatewayStatus || {};
    const selectedFile = store.selectedFile || gatewayStatus.selectedFile || null;
    const selectedFiles = store.selectedFiles && store.selectedFiles.length
      ? store.selectedFiles
      : (gatewayStatus.selectedFiles || []);
    const lastRunSummary = store.lastRunSummary || {};
    const conditionalWorkflowResult = store.conditionalWorkflowResult || {};
    const batchRunResult = store.batchRunResult || {};
    const conditionalWorkflowRun = conditionalWorkflowResult.workflowRun || {};
    const conditionalWorkflowVariables = conditionalWorkflowRun.variables || {};
    const conditionalWorkflowVisited = conditionalWorkflowRun.visitedNodeIds || [];
    const workflowRunJsonSave = conditionalWorkflowResult.workflowRunJsonSave || null;
    const workflowAhkFileSave = conditionalWorkflowResult.workflowAhkFileSave || null;
    const error = store.lastError || lastRunSummary.error || null;

    return {
      store: store,
      runtime: runtime,
      pageState: pageState,
      gatewayStatus: gatewayStatus,
      selectedFile: selectedFile,
      selectedFiles: selectedFiles,
      lastRunSummary: lastRunSummary,
      conditionalWorkflowResult: conditionalWorkflowResult,
      batchRunResult: batchRunResult,
      conditionalWorkflowRun: conditionalWorkflowRun,
      conditionalWorkflowVariables: conditionalWorkflowVariables,
      conditionalWorkflowVisited: conditionalWorkflowVisited,
      workflowRunJsonSave: workflowRunJsonSave,
      workflowAhkFileSave: workflowAhkFileSave,
      error: error
    };
  }

  function render(root) {
    const viewModel = buildViewModel();

    root.innerHTML = [
      sections.renderHeaderCard(viewModel),
      sections.renderConditionalWorkflowCard(viewModel),
      sections.renderBatchSummaryCard(viewModel),
      sections.renderSelectedBatchCard(viewModel),
      sections.renderSelectedFileCard(viewModel),
      sections.renderLastRunSummaryCard(viewModel),
      sections.renderRuntimeSnapshotCard(viewModel),
      sections.renderExecutionTimelineCard(viewModel),
      sections.renderAdvancedActionsCard(viewModel)
    ].join("");
  }

  NewSiteSidepanel.AutomationTesterRender = {
    render: render
  };
})(globalThis);
