(function initDeepSeekBatchConditionalWorkflow(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  const MESSAGE_TYPES = NewSiteCore.MESSAGE_TYPES;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Telemetry = NewSiteCore.Telemetry;
  const Errors = NewSiteCore.Errors;
  const ConditionalWorkflowContracts = NewSiteCore.ConditionalWorkflowContracts;

  const MODULE_FILE = "background/workflows/deepseekBatchConditionalWorkflow.js";

  function workflowRequiresFileAttachment(definition) {
    return Array.isArray(definition.nodes) && definition.nodes.some(function requiresAttachment(node) {
      return node && node.type === "prompt" && node.attachFile === true;
    });
  }

  function normalizeSelectedFiles(selectedFiles) {
    if (!Array.isArray(selectedFiles)) {
      return [];
    }

    return selectedFiles
      .filter(function isObject(file) {
        return file && typeof file === "object" && !Array.isArray(file);
      })
      .map(function cloneFile(file) {
        return Object.assign({}, file);
      });
  }

  function normalizeInput(message) {
    const input = Object.assign({
      definition: null,
      selectedFiles: [],
      continueOnError: false,
      autoConnectGateway: true,
      maxNodes: null,
      targetWindowId: null,
      batchId: ""
    }, message.input || {});

    return {
      traceId: message.traceId || Telemetry.createTraceId("conditional_batch"),
      input: input
    };
  }

  async function emitBatchEvent(eventName, level, traceId, workflowId, batchId, message, data) {
    await Telemetry.emit({
      eventName: eventName,
      traceId: traceId,
      workflowId: workflowId || "",
      siteId: "deepseek",
      component: "deepseekBatchConditionalWorkflow",
      level: level,
      message: message,
      stage: "conditional_workflow_batch",
      expected: data && data.expected ? data.expected : "",
      actual: data && data.actual ? data.actual : "",
      data: Object.assign({
        batchId: batchId || ""
      }, data || {})
    });
  }

  function buildBatchError(code, message, details) {
    return Errors.createError(code, message, Object.assign({
      probableCause: MODULE_FILE
    }, details || {}));
  }

  function buildItemResult(itemRunResult) {
    return {
      index: itemRunResult.index,
      selectedFile: itemRunResult.selectedFile || null,
      tabId: typeof itemRunResult.tabId === "number" ? itemRunResult.tabId : null,
      status: itemRunResult.status,
      traceId: itemRunResult.traceId,
      workflowRunJsonSave: itemRunResult.workflowRunJsonSave || null,
      workflowAhkFileSave: itemRunResult.workflowAhkFileSave || null,
      error: itemRunResult.error || null
    };
  }

  async function run(message) {
    const normalizedMessage = normalizeInput(message || {});
    const traceId = normalizedMessage.traceId;
    const input = normalizedMessage.input;
    const batchId = input.batchId || Telemetry.createTraceId("batch");
    const selectedFiles = normalizeSelectedFiles(input.selectedFiles);

    let workflowDefinition = null;
    let workflowId = "";
    let completedCount = 0;
    let failedCount = 0;
    let baseWindowId = Number.isInteger(input.targetWindowId) ? input.targetWindowId : null;
    let results = [];

    try {
      workflowDefinition = ConditionalWorkflowContracts.validateConditionalWorkflowDefinition(input.definition, {
        traceId: traceId,
        messageType: MESSAGE_TYPES.CONDITIONAL_WORKFLOW_BATCH_RUN
      });
      workflowId = workflowDefinition.workflowId;

      await emitBatchEvent(
        TELEMETRY_EVENTS.CONDITIONAL_WORKFLOW_BATCH_STARTED,
        "info",
        traceId,
        workflowId,
        batchId,
        "Conditional workflow batch started",
        {
          totalCount: selectedFiles.length,
          expected: "The conditional workflow batch should run each selected file sequentially."
        }
      );

      if (!selectedFiles.length) {
        throw buildBatchError(
          "BATCH_FILES_REQUIRED",
          "At least one selected file is required for the batch conditional workflow.",
          {
            traceId: traceId,
            workflowId: workflowId,
            expected: "selectedFiles should contain one or more gateway-selected files.",
            actual: "selectedFiles was empty."
          }
        );
      }

      if (workflowRequiresFileAttachment(workflowDefinition) && !selectedFiles.length) {
        throw buildBatchError(
          "FILE_SELECTION_REQUIRED",
          "The conditional workflow batch requires at least one selected Excel file.",
          {
            traceId: traceId,
            workflowId: workflowId,
            expected: "At least one selected file should be available because the workflow attaches a file.",
            actual: "No selected files were provided."
          }
        );
      }

      for (let index = 0; index < selectedFiles.length; index += 1) {
        const itemRunResult = await NewSiteBackground.DeepSeekBatchItemRunner.runItem({
          index: index,
          traceId: Telemetry.createTraceId("conditional_item"),
          sourceSelectedFile: selectedFiles[index],
          workflowDefinition: workflowDefinition,
          workflowId: workflowId,
          input: input,
          baseWindowId: baseWindowId,
          isFirstItem: index === 0
        });

        baseWindowId = typeof itemRunResult.baseWindowId === "number"
          ? itemRunResult.baseWindowId
          : baseWindowId;

        results.push(buildItemResult(itemRunResult));

        if (itemRunResult.status === "completed") {
          completedCount += 1;
          continue;
        }

        failedCount += 1;

        if (!input.continueOnError) {
          await emitBatchEvent(
            TELEMETRY_EVENTS.CONDITIONAL_WORKFLOW_BATCH_FAILED,
            "error",
            traceId,
            workflowId,
            batchId,
            itemRunResult.error.message,
            {
              totalCount: selectedFiles.length,
              completedCount: completedCount,
              failedCount: failedCount,
              failedIndex: index,
              failedFileId: itemRunResult.selectedFile && itemRunResult.selectedFile.fileId ? itemRunResult.selectedFile.fileId : "",
              actual: itemRunResult.error.actual || itemRunResult.error.message
            }
          );
          return {
            status: "failed",
            traceId: traceId,
            workflowId: workflowId,
            batchId: batchId,
            totalCount: selectedFiles.length,
            completedCount: completedCount,
            failedCount: failedCount,
            results: results,
            error: itemRunResult.error
          };
        }
      }

      await emitBatchEvent(
        TELEMETRY_EVENTS.CONDITIONAL_WORKFLOW_BATCH_COMPLETED,
        "info",
        traceId,
        workflowId,
        batchId,
        "Conditional workflow batch completed",
        {
          totalCount: selectedFiles.length,
          completedCount: completedCount,
          failedCount: failedCount,
          actual: "Batch completed with " + String(completedCount) + " successful items."
        }
      );

      return {
        status: failedCount > 0 ? "failed" : "completed",
        traceId: traceId,
        workflowId: workflowId,
        batchId: batchId,
        totalCount: selectedFiles.length,
        completedCount: completedCount,
        failedCount: failedCount,
        results: results,
        error: failedCount > 0 ? results[results.length - 1].error : null
      };
    } catch (error) {
      const structured = Errors.toStructuredError(error);
      structured.traceId = structured.traceId || traceId;
      structured.workflowId = structured.workflowId || workflowId || "";
      structured.probableCause = structured.probableCause || MODULE_FILE;

      await emitBatchEvent(
        TELEMETRY_EVENTS.CONDITIONAL_WORKFLOW_BATCH_FAILED,
        "error",
        traceId,
        structured.workflowId,
        batchId,
        structured.message,
        {
          totalCount: selectedFiles.length,
          completedCount: completedCount,
          failedCount: failedCount,
          actual: structured.actual || structured.message
        }
      );

      return {
        status: "failed",
        traceId: traceId,
        workflowId: workflowId,
        batchId: batchId,
        totalCount: selectedFiles.length,
        completedCount: completedCount,
        failedCount: failedCount,
        results: results,
        error: structured
      };
    }
  }

  NewSiteBackground.DeepSeekBatchConditionalWorkflow = {
    run: run
  };
})(globalThis);
