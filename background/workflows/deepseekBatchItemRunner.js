(function initDeepSeekBatchItemRunner(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  const Errors = NewSiteCore.Errors;

  async function runItem(options) {
    const itemOptions = options || {};
    const index = Number.isInteger(itemOptions.index) ? itemOptions.index : 0;
    const sourceSelectedFile = itemOptions.sourceSelectedFile || null;
    const workflowDefinition = itemOptions.workflowDefinition || null;
    const workflowId = itemOptions.workflowId || "";
    const input = itemOptions.input || {};
    const itemTraceId = itemOptions.traceId || "";
    const isFirstItem = itemOptions.isFirstItem === true;

    let activeSelectedFile = sourceSelectedFile;
    let targetTab = null;
    let workflowResult = null;
    let itemError = null;
    let baseWindowId = typeof itemOptions.baseWindowId === "number" ? itemOptions.baseWindowId : null;

    try {
      const activation = await NewSiteBackground.GatewayFileService.selectFileById(
        itemTraceId,
        sourceSelectedFile && sourceSelectedFile.fileId ? sourceSelectedFile.fileId : ""
      );
      activeSelectedFile = activation && activation.selectedFile
        ? activation.selectedFile
        : (activation && activation.gatewayStatus && activation.gatewayStatus.selectedFile
          ? activation.gatewayStatus.selectedFile
          : sourceSelectedFile);

      if (isFirstItem) {
        targetTab = await NewSiteBackground.DeepSeekTabService.ensureReady(itemTraceId);
        if (targetTab && typeof targetTab.windowId === "number") {
          baseWindowId = targetTab.windowId;
        }
      } else {
        targetTab = await NewSiteBackground.DeepSeekTabService.openFreshReady(itemTraceId, {
          windowId: baseWindowId
        });
        if (targetTab && typeof targetTab.windowId === "number" && baseWindowId === null) {
          baseWindowId = targetTab.windowId;
        }
      }

      workflowResult = await NewSiteBackground.DeepSeekConditionalWorkflow.run({
        traceId: itemTraceId,
        input: {
          definition: workflowDefinition,
          autoConnectGateway: false,
          autoOpenDeepSeek: false,
          autoSelectFileIfMissing: false,
          fileId: activeSelectedFile && activeSelectedFile.fileId ? activeSelectedFile.fileId : "",
          selectedFile: activeSelectedFile,
          targetTabId: targetTab && typeof targetTab.id === "number" ? targetTab.id : null,
          targetWindowId: targetTab && typeof targetTab.windowId === "number" ? targetTab.windowId : baseWindowId,
          maxNodes: input.maxNodes
        }
      });

      if (!workflowResult || workflowResult.status !== "completed") {
        itemError = workflowResult && workflowResult.error
          ? workflowResult.error
          : Errors.createError(
            "CONDITIONAL_WORKFLOW_BATCH_ITEM_FAILED",
            "A batch workflow item did not complete successfully.",
            {
              traceId: itemTraceId,
              workflowId: workflowId,
              failedStage: workflowResult && workflowResult.stage ? workflowResult.stage : "run_conditional_workflow",
              expected: "Each batch item should complete successfully.",
              actual: "The workflow result returned failed or invalid status.",
              probableCause: "background/workflows/deepseekBatchConditionalWorkflow.js"
            }
          );
      }
    } catch (error) {
      itemError = Errors.toStructuredError(error);
      itemError.traceId = itemError.traceId || itemTraceId;
      itemError.workflowId = itemError.workflowId || workflowId || "";
      itemError.failedStage = itemError.failedStage || "conditional_workflow_batch_item";
      itemError.probableCause = itemError.probableCause || "background/workflows/deepseekBatchConditionalWorkflow.js";
    }

    return {
      index: index,
      traceId: itemTraceId,
      selectedFile: workflowResult && workflowResult.selectedFile ? workflowResult.selectedFile : activeSelectedFile || null,
      tabId: targetTab && typeof targetTab.id === "number" ? targetTab.id : null,
      status: itemError ? "failed" : "completed",
      workflowRunJsonSave: workflowResult && workflowResult.workflowRunJsonSave ? workflowResult.workflowRunJsonSave : null,
      workflowAhkFileSave: workflowResult && workflowResult.workflowAhkFileSave ? workflowResult.workflowAhkFileSave : null,
      error: itemError || null,
      workflowResult: workflowResult,
      baseWindowId: baseWindowId
    };
  }

  NewSiteBackground.DeepSeekBatchItemRunner = {
    runItem: runItem
  };
})(globalThis);
