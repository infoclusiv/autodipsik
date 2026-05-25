(function initDeepSeekConditionalWorkflow(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  const MESSAGE_TYPES = NewSiteCore.MESSAGE_TYPES;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Errors = NewSiteCore.Errors;
  const DiagnosticStore = NewSiteCore.DiagnosticStore;
  const GatewayClient = NewSiteCore.GatewayClient;
  const ConditionalWorkflowContracts = NewSiteCore.ConditionalWorkflowContracts;
  const ConditionalWorkflowEngine = NewSiteCore.ConditionalWorkflowEngine;
  const workflowSupport = NewSiteBackground.DeepSeekConditionalWorkflowSupport;

  const MODULE_FILE = "background/workflows/deepseekConditionalWorkflow.js";

  async function run(message) {
    const normalizedMessage = workflowSupport.normalizeInput(message || {});
    const traceId = normalizedMessage.traceId;
    const input = normalizedMessage.input;

    let workflowDefinition = null;
    let workflowId = "";
    let gatewayStatus = await GatewayClient.getStatus();
    let selectedFile = input.selectedFile && typeof input.selectedFile === "object"
      ? Object.assign({}, input.selectedFile)
      : (gatewayStatus && gatewayStatus.selectedFile ? gatewayStatus.selectedFile : null);
    let pageState = null;
    let workflowRun = null;
    let workflowRunJsonSave = null;
    let workflowAhkFileSave = null;
    let targetTabId = Number.isInteger(input.targetTabId) ? input.targetTabId : null;

    try {
      workflowDefinition = ConditionalWorkflowContracts.validateConditionalWorkflowDefinition(input.definition, {
        traceId: traceId,
        messageType: MESSAGE_TYPES.CONDITIONAL_WORKFLOW_RUN
      });
      workflowId = workflowDefinition.workflowId;

      await workflowSupport.emitWorkflowEvent(
        TELEMETRY_EVENTS.CONDITIONAL_WORKFLOW_STARTED,
        "info",
        traceId,
        workflowId,
        "Conditional workflow run started",
        {
          expected: "The conditional workflow should evaluate its graph and complete with a multi-turn result."
        }
      );

      const requiresFileAttachment = workflowSupport.workflowRequiresFileAttachment(workflowDefinition);

      gatewayStatus = await workflowSupport.runStage(traceId, workflowId, "ensure_gateway_connected", async function ensureGatewayConnected() {
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
      }, MODULE_FILE);

      selectedFile = await workflowSupport.runStage(traceId, workflowId, "ensure_file_selected", async function ensureFileSelected() {
        if (!requiresFileAttachment) {
          if (input.fileId) {
            const selection = await NewSiteBackground.GatewayFileService.selectFileById(traceId, input.fileId);
            gatewayStatus = selection.gatewayStatus || await GatewayClient.getStatus();
            return gatewayStatus && gatewayStatus.selectedFile ? gatewayStatus.selectedFile : null;
          }

          if (selectedFile && selectedFile.fileId) {
            const selection = await NewSiteBackground.GatewayFileService.selectFileById(traceId, selectedFile.fileId);
            gatewayStatus = selection.gatewayStatus || await GatewayClient.getStatus();
            return gatewayStatus && gatewayStatus.selectedFile ? gatewayStatus.selectedFile : selectedFile;
          }

          return gatewayStatus && gatewayStatus.selectedFile ? gatewayStatus.selectedFile : null;
        }

        let currentStatus = await GatewayClient.getStatus();
        if (input.fileId) {
          const selection = await NewSiteBackground.GatewayFileService.selectFileById(traceId, input.fileId);
          currentStatus = selection.gatewayStatus || await GatewayClient.getStatus();
        } else if (selectedFile && selectedFile.fileId) {
          const selection = await NewSiteBackground.GatewayFileService.selectFileById(traceId, selectedFile.fileId);
          currentStatus = selection.gatewayStatus || await GatewayClient.getStatus();
        }

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
      }, MODULE_FILE);

      if (input.autoOpenDeepSeek) {
        await workflowSupport.runStage(traceId, workflowId, "ensure_deepseek_tab", function ensureDeepSeekTab() {
          if (targetTabId) {
            return chrome.tabs.get(targetTabId);
          }

          return NewSiteBackground.DeepSeekTabService.ensureReady(traceId);
        }, MODULE_FILE);
      }

      pageState = await workflowSupport.runStage(traceId, workflowId, "detect_page_state", async function detectPageState() {
        const pageStateMessage = {
          type: MESSAGE_TYPES.PAGE_STATE_DETECT,
          traceId: traceId,
          targetSiteId: "deepseek"
        };

        return targetTabId
          ? NewSiteBackground.DeepSeekTabService.forwardToTab(targetTabId, pageStateMessage)
          : NewSiteBackground.DeepSeekTabService.forward(pageStateMessage);
      }, MODULE_FILE);

      workflowRun = await workflowSupport.runStage(traceId, workflowId, "run_conditional_workflow", async function executeWorkflow() {
        return ConditionalWorkflowEngine.run({
          definition: workflowDefinition,
          traceId: traceId,
          maxNodes: input.maxNodes,
          input: {
            selectedFile: selectedFile,
            gatewayStatus: gatewayStatus
          },
          onNodeStarted: async function onNodeStarted(payload) {
            await workflowSupport.emitWorkflowEvent(
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
            await workflowSupport.emitWorkflowEvent(
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
            await workflowSupport.emitWorkflowEvent(
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
              selectedFile: node.attachFile === true ? selectedFile : null,
              targetTabId: targetTabId
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
      }, MODULE_FILE);

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
      workflowRunJsonSave = await workflowSupport.saveWorkflowRunJsonIfPossible({
        traceId: traceId,
        workflowId: workflowId,
        selectedFile: selectedFile,
        definition: workflowDefinition,
        workflowRun: workflowRun
      });
      workflowAhkFileSave = await workflowSupport.runStage(traceId, workflowId, "save_workflow_ahk_file", async function persistWorkflowAhkFile() {
        return workflowSupport.saveWorkflowAhkFileIfPossible({
          traceId: traceId,
          workflowId: workflowId,
          selectedFile: selectedFile,
          workflowRun: workflowRun
        });
      }, MODULE_FILE);

      await workflowSupport.emitWorkflowEvent(
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
        workflowAhkFileSave: workflowAhkFileSave,
        error: null
      };
    } catch (error) {
      const structured = Errors.toStructuredError(error);
      structured.traceId = structured.traceId || traceId;
      structured.workflowId = structured.workflowId || workflowId || "";
      structured.probableCause = structured.probableCause || MODULE_FILE;

      try {
        workflowRunJsonSave = await workflowSupport.saveWorkflowRunJsonIfPossible({
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
      await workflowSupport.emitWorkflowEvent(
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
        workflowAhkFileSave: workflowAhkFileSave,
        error: structured
      };
    }
  }

  NewSiteBackground.DeepSeekConditionalWorkflow = {
    run: run
  };
})(globalThis);
