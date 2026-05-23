(function initDeepSeekConditionalWorkflow(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  const MESSAGE_TYPES = NewSiteCore.MESSAGE_TYPES;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Telemetry = NewSiteCore.Telemetry;
  const Errors = NewSiteCore.Errors;
  const DiagnosticStore = NewSiteCore.DiagnosticStore;
  const GatewayClient = NewSiteCore.GatewayClient;
  const ConditionalWorkflowContracts = NewSiteCore.ConditionalWorkflowContracts;
  const ConditionalWorkflowEngine = NewSiteCore.ConditionalWorkflowEngine;

  const MODULE_FILE = "background/workflows/deepseekConditionalWorkflow.js";

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

  async function runStage(traceId, workflowId, stageName, fn) {
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
      structured.probableCause = structured.probableCause || MODULE_FILE;
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
      autoSelectFileIfMissing: true
    }, message.input || {});

    return {
      traceId: message.traceId || Telemetry.createTraceId("conditional_workflow"),
      input: input
    };
  }

  async function run(message) {
    const normalizedMessage = normalizeInput(message || {});
    const traceId = normalizedMessage.traceId;
    const input = normalizedMessage.input;

    let workflowDefinition = null;
    let workflowId = "";
    let gatewayStatus = await GatewayClient.getStatus();
    let selectedFile = gatewayStatus && gatewayStatus.selectedFile ? gatewayStatus.selectedFile : null;
    let pageState = null;
    let workflowRun = null;
    let workflowRunJsonSave = null;

    try {
      workflowDefinition = ConditionalWorkflowContracts.validateConditionalWorkflowDefinition(input.definition, {
        traceId: traceId,
        messageType: MESSAGE_TYPES.CONDITIONAL_WORKFLOW_RUN
      });
      workflowId = workflowDefinition.workflowId;

      await emitWorkflowEvent(
        TELEMETRY_EVENTS.CONDITIONAL_WORKFLOW_STARTED,
        "info",
        traceId,
        workflowId,
        "Conditional workflow run started",
        {
          expected: "The conditional workflow should evaluate its graph and complete with a multi-turn result."
        }
      );

      const requiresFileAttachment = workflowRequiresFileAttachment(workflowDefinition);

      gatewayStatus = await runStage(traceId, workflowId, "ensure_gateway_connected", async function ensureGatewayConnected() {
        const status = input.autoConnectGateway
          ? await NewSiteBackground.GatewayFileService.ensureConnected()
          : await GatewayClient.getStatus();
        await DiagnosticStore.recordGatewaySnapshot({
          traceId: traceId,
          workflowId: workflowId,
          stage: "ensure_gateway_connected",
          gatewayStatus: status
        });
        return status;
      });

      selectedFile = await runStage(traceId, workflowId, "ensure_file_selected", async function ensureFileSelected() {
        if (!requiresFileAttachment) {
          return gatewayStatus && gatewayStatus.selectedFile ? gatewayStatus.selectedFile : null;
        }

        let currentStatus = await GatewayClient.getStatus();
        if (!currentStatus.selectedFile && input.autoSelectFileIfMissing) {
          const selection = await NewSiteBackground.GatewayFileService.selectFile(traceId);
          currentStatus = selection.gatewayStatus || currentStatus;
        }

        if (!currentStatus.selectedFile || !currentStatus.selectedFile.fileId) {
          throw Errors.createError("FILE_SELECTION_CANCELLED", "No file was selected for the conditional workflow.", {
            traceId: traceId,
            workflowId: workflowId,
            failedStage: "ensure_file_selected",
            expected: "A gateway-selected Excel file should be available because at least one prompt node requires attachment.",
            actual: "No selected gateway file was available for the conditional workflow."
          });
        }

        gatewayStatus = currentStatus;
        return currentStatus.selectedFile;
      });

      if (input.autoOpenDeepSeek) {
        await runStage(traceId, workflowId, "ensure_deepseek_tab", function ensureDeepSeekTab() {
          return NewSiteBackground.DeepSeekTabService.ensureReady(traceId);
        });
      }

      pageState = await runStage(traceId, workflowId, "detect_page_state", async function detectPageState() {
        return NewSiteBackground.DeepSeekTabService.forward({
          type: MESSAGE_TYPES.PAGE_STATE_DETECT,
          traceId: traceId,
          targetSiteId: "deepseek"
        });
      });

      workflowRun = await runStage(traceId, workflowId, "run_conditional_workflow", async function executeWorkflow() {
        return ConditionalWorkflowEngine.run({
          definition: workflowDefinition,
          traceId: traceId,
          maxNodes: input.maxNodes,
          input: {
            selectedFile: selectedFile,
            gatewayStatus: gatewayStatus
          },
          onNodeStarted: async function onNodeStarted(payload) {
            await emitWorkflowEvent(
              TELEMETRY_EVENTS.CONDITIONAL_WORKFLOW_NODE_STARTED,
              "info",
              traceId,
              workflowId,
              "Conditional workflow node started",
              {
                nodeId: payload.node.id,
                nodeType: payload.node.type,
                visitedCount: payload.state.visitedNodeIds.length
              }
            );
          },
          onNodeCompleted: async function onNodeCompleted(payload) {
            await emitWorkflowEvent(
              TELEMETRY_EVENTS.CONDITIONAL_WORKFLOW_NODE_COMPLETED,
              "info",
              traceId,
              workflowId,
              "Conditional workflow node completed",
              {
                nodeId: payload.node.id,
                nodeType: payload.node.type,
                nextNodeId: payload.nextNodeId || "",
                actual: "Conditional workflow node completed."
              }
            );
          },
          onNodeFailed: async function onNodeFailed(payload) {
            const structured = Errors.toStructuredError(payload.error);
            await emitWorkflowEvent(
              TELEMETRY_EVENTS.CONDITIONAL_WORKFLOW_NODE_FAILED,
              "error",
              traceId,
              workflowId,
              structured.message,
              {
                nodeId: payload.node.id,
                nodeType: payload.node.type,
                expected: structured.expected,
                actual: structured.actual
              }
            );
          },
          runPromptTurn: async function runPromptTurn(node, executionContext) {
            const turnIndex = Array.isArray(executionContext && executionContext.turns)
              ? executionContext.turns.length + 1
              : 1;
            const promptTurn = await NewSiteBackground.DeepSeekPromptTurnRunner.runTurn({
              traceId: traceId,
              workflowId: workflowId,
              nodeId: node.id,
              turnIndex: turnIndex,
              promptText: node.promptText,
              attachFile: node.attachFile === true,
              waitForResponse: node.waitForResponse !== false,
              selectedFile: node.attachFile === true ? selectedFile : null
            });

            return {
              nodeId: promptTurn.nodeId,
              turnIndex: promptTurn.turnIndex,
              attachFile: promptTurn.attachFile,
              response: promptTurn.response,
              automationResult: promptTurn.automationResult
            };
          }
        });
      });

      if (!workflowRun || workflowRun.status !== "completed") {
        throw workflowRun && workflowRun.error
          ? workflowRun.error
          : Errors.createError("CONDITIONAL_WORKFLOW_FAILED", "Conditional workflow execution did not complete successfully.", {
            traceId: traceId,
            workflowId: workflowId,
            failedStage: "run_conditional_workflow",
            expected: "Conditional workflow engine should return completed status.",
            actual: "Workflow engine returned an incomplete or invalid result.",
            probableCause: MODULE_FILE
          });
      }

      gatewayStatus = await GatewayClient.getStatus();
      workflowRunJsonSave = await saveWorkflowRunJsonIfPossible({
        traceId: traceId,
        workflowId: workflowId,
        selectedFile: selectedFile,
        definition: workflowDefinition,
        workflowRun: workflowRun
      });

      await emitWorkflowEvent(
        TELEMETRY_EVENTS.CONDITIONAL_WORKFLOW_COMPLETED,
        "info",
        traceId,
        workflowId,
        "Conditional workflow run completed",
        {
          actual: "Workflow visited " + String(workflowRun.visitedNodeIds.length) + " nodes and completed successfully."
        }
      );

      return {
        status: "completed",
        traceId: traceId,
        workflowId: workflowId,
        stage: "completed",
        gatewayStatus: gatewayStatus,
        selectedFile: selectedFile,
        pageState: pageState,
        workflowRun: workflowRun,
        workflowRunJsonSave: workflowRunJsonSave,
        error: null
      };
    } catch (error) {
      const structured = Errors.toStructuredError(error);
      structured.traceId = structured.traceId || traceId;
      structured.workflowId = structured.workflowId || workflowId || "";
      structured.probableCause = structured.probableCause || MODULE_FILE;

      try {
        workflowRunJsonSave = await saveWorkflowRunJsonIfPossible({
          traceId: traceId,
          workflowId: structured.workflowId || workflowId,
          selectedFile: selectedFile,
          definition: workflowDefinition,
          workflowRun: workflowRun
        });
      } catch (saveError) {
        structured.workflowRunJsonSaveError = Errors.toStructuredError(saveError);
        await DiagnosticStore.recordError(structured.workflowRunJsonSaveError);
      }

      await DiagnosticStore.recordError(structured);
      await emitWorkflowEvent(
        TELEMETRY_EVENTS.CONDITIONAL_WORKFLOW_FAILED,
        "error",
        traceId,
        structured.workflowId,
        structured.message,
        {
          expected: structured.expected,
          actual: structured.actual
        }
      );

      return {
        status: "failed",
        traceId: traceId,
        workflowId: workflowId,
        stage: structured.failedStage || "failed",
        gatewayStatus: await GatewayClient.getStatus(),
        selectedFile: selectedFile,
        pageState: pageState,
        workflowRun: workflowRun,
        workflowRunJsonSave: workflowRunJsonSave,
        error: structured
      };
    }
  }

  NewSiteBackground.DeepSeekConditionalWorkflow = {
    run: run
  };
})(globalThis);
