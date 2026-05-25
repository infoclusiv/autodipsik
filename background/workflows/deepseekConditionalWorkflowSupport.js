(function initDeepSeekConditionalWorkflowSupport(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Telemetry = NewSiteCore.Telemetry;
  const Errors = NewSiteCore.Errors;

  function workflowRequiresFileAttachment(definition) {
    return Array.isArray(definition.nodes) && definition.nodes.some(function requiresAttachment(node) {
      return node && node.type === "prompt" && node.attachFile === true;
    });
  }

  async function emitWorkflowEvent(eventName, level, traceId, workflowId, message, data) {
    await Telemetry.emit({
      eventName: eventName,
      traceId: traceId,
      workflowId: workflowId || "",
      siteId: "deepseek",
      component: "deepseekConditionalWorkflow",
      level: level,
      message: message,
      stage: "conditional_workflow",
      stepName: data && data.nodeId ? data.nodeId : "",
      expected: data && data.expected ? data.expected : "",
      actual: data && data.actual ? data.actual : "",
      data: data || {}
    });
  }

  function buildDefinitionSummary(definition) {
    return {
      flowVersion: definition && typeof definition.flowVersion !== "undefined" ? definition.flowVersion : 0,
      startNodeId: definition && definition.startNodeId ? definition.startNodeId : "",
      nodeCount: definition && Array.isArray(definition.nodes) ? definition.nodes.length : 0
    };
  }

  async function saveWorkflowRunJsonIfPossible(options) {
    if (!options.selectedFile || !options.selectedFile.fileId || !options.workflowRun) {
      return null;
    }

    return NewSiteBackground.GatewayFileService.saveDeepSeekWorkflowRunJson({
      traceId: options.traceId,
      workflowId: options.workflowId,
      fileId: options.selectedFile.fileId,
      selectedFile: options.selectedFile,
      definitionSummary: buildDefinitionSummary(options.definition),
      workflowRun: options.workflowRun
    });
  }

  async function saveWorkflowAhkFileIfPossible(options) {
    if (!options.selectedFile || !options.selectedFile.fileId || !options.workflowRun) {
      return null;
    }

    return NewSiteBackground.GatewayFileService.saveDeepSeekWorkflowAhkFile({
      traceId: options.traceId,
      workflowId: options.workflowId,
      fileId: options.selectedFile.fileId,
      selectedFile: options.selectedFile,
      workflowRun: options.workflowRun
    });
  }

  async function runStage(traceId, workflowId, stageName, fn, moduleFile) {
    await emitWorkflowEvent(TELEMETRY_EVENTS.CONDITIONAL_WORKFLOW_NODE_STARTED, "info", traceId, workflowId, "Conditional workflow stage started", {
      nodeId: stageName,
      expected: "Conditional workflow stage should complete successfully."
    });

    try {
      const result = await fn();
      await emitWorkflowEvent(TELEMETRY_EVENTS.CONDITIONAL_WORKFLOW_NODE_COMPLETED, "info", traceId, workflowId, "Conditional workflow stage completed", {
        nodeId: stageName,
        actual: "Stage completed successfully."
      });
      return result;
    } catch (error) {
      const structured = Errors.toStructuredError(error);
      structured.traceId = structured.traceId || traceId;
      structured.workflowId = structured.workflowId || workflowId || "";
      structured.failedStage = structured.failedStage || stageName;
      structured.probableCause = structured.probableCause || moduleFile || "background/workflows/deepseekConditionalWorkflowSupport.js";
      await emitWorkflowEvent(TELEMETRY_EVENTS.CONDITIONAL_WORKFLOW_NODE_FAILED, "error", traceId, structured.workflowId, structured.message, {
        nodeId: stageName,
        expected: structured.expected,
        actual: structured.actual
      });
      throw structured;
    }
  }

  function normalizeInput(message) {
    const input = Object.assign({
      definition: null,
      autoConnectGateway: true,
      autoOpenDeepSeek: true,
      autoSelectFileIfMissing: true,
      selectedFile: null,
      fileId: "",
      targetTabId: null,
      targetWindowId: null
    }, message.input || {});

    return {
      traceId: message.traceId || Telemetry.createTraceId("conditional_workflow"),
      input: input
    };
  }

  NewSiteBackground.DeepSeekConditionalWorkflowSupport = {
    workflowRequiresFileAttachment: workflowRequiresFileAttachment,
    emitWorkflowEvent: emitWorkflowEvent,
    buildDefinitionSummary: buildDefinitionSummary,
    saveWorkflowRunJsonIfPossible: saveWorkflowRunJsonIfPossible,
    saveWorkflowAhkFileIfPossible: saveWorkflowAhkFileIfPossible,
    runStage: runStage,
    normalizeInput: normalizeInput
  };
})(globalThis);
