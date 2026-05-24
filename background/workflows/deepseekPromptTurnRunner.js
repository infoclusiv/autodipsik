(function initDeepSeekPromptTurnRunner(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  const MESSAGE_TYPES = NewSiteCore.MESSAGE_TYPES;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Telemetry = NewSiteCore.Telemetry;
  const Errors = NewSiteCore.Errors;
  const DiagnosticStore = NewSiteCore.DiagnosticStore;
  const GatewayContracts = NewSiteCore.GatewayContracts;
  const DeepSeekWorkflowContracts = NewSiteCore.DeepSeekWorkflowContracts;

  const STAGE_NAME = "deepseek_prompt_turn";
  const MODULE_FILE = "background/workflows/deepseekPromptTurnRunner.js";

  function createTurnError(code, message, details) {
    return Errors.createError(code, message, Object.assign({
      probableCause: MODULE_FILE
    }, details || {}));
  }

  function normalizeInput(input) {
    const selectedFile = input && input.selectedFile && typeof input.selectedFile === "object" && !Array.isArray(input.selectedFile)
      ? Object.assign({}, input.selectedFile)
      : null;
    const attachFile = input && input.attachFile === false ? false : true;

    return {
      traceId: input && input.traceId ? input.traceId : Telemetry.createTraceId("prompt_turn"),
      workflowId: input && input.workflowId ? input.workflowId : "",
      nodeId: input && input.nodeId ? input.nodeId : "",
      turnIndex: Number.isInteger(input && input.turnIndex) ? input.turnIndex : 0,
      promptText: input && input.promptText ? String(input.promptText) : "",
      promptTextLength: String(input && input.promptText ? input.promptText : "").length,
      attachFile: attachFile,
      waitForResponse: input && typeof input.waitForResponse === "boolean" ? input.waitForResponse : true,
      selectedFile: selectedFile,
      targetTabId: Number.isInteger(input && input.targetTabId) ? input.targetTabId : null
    };
  }

  async function emitTurnEvent(eventName, level, input, message, data) {
    await Telemetry.emit({
      eventName: eventName,
      traceId: input.traceId,
      workflowId: input.workflowId,
      siteId: "deepseek",
      component: "deepseekPromptTurnRunner",
      level: level,
      message: message,
      stage: STAGE_NAME,
      stepName: input.nodeId || "",
      actual: data && data.actual ? data.actual : "",
      expected: data && data.expected ? data.expected : "",
      data: Object.assign({
        nodeId: input.nodeId,
        turnIndex: input.turnIndex,
        attachFile: input.attachFile,
        promptTextLength: input.promptTextLength
      }, data || {})
    });
  }

  async function recordTurnEvidence(status, input, workflowId, actual, snapshot) {
    await DiagnosticStore.recordStepEvidence({
      traceId: input.traceId,
      workflowId: workflowId || input.workflowId || "",
      stage: STAGE_NAME,
      stepName: input.nodeId || "",
      status: status,
      expected: "A single DeepSeek prompt turn should complete with a normalized captured response.",
      actual: actual,
      elapsedMs: 0,
      snapshot: Object.assign({
        nodeId: input.nodeId,
        turnIndex: input.turnIndex,
        attachFile: input.attachFile,
        promptTextLength: input.promptTextLength
      }, snapshot || {})
    });
  }

  function buildAutomationInput(input) {
    const automationInput = {
      dryRun: false,
      promptText: input.promptText,
      attachFile: input.attachFile,
      waitForResponse: input.waitForResponse
    };

    if (input.selectedFile) {
      automationInput.selectedFile = Object.assign({}, input.selectedFile);
      automationInput.fileId = input.selectedFile.fileId || "";
      automationInput.fileName = input.selectedFile.name || "";
      automationInput.fileExtension = input.selectedFile.extension || "";
    }

    return automationInput;
  }

  function extractCapturedResponse(automationResult, input) {
    const captureResult = automationResult
      && automationResult.results
      && automationResult.results.wait_for_deepseek_response_complete
      ? automationResult.results.wait_for_deepseek_response_complete
      : null;

    if (!captureResult || captureResult.skipped || captureResult.responseCaptured !== true || !captureResult.capturedResponse) {
      throw createTurnError("DEEPSEEK_RESPONSE_CAPTURE_MISSING", "The DeepSeek prompt turn did not return a captured response.", {
        traceId: input.traceId,
        workflowId: automationResult && automationResult.workflowId ? automationResult.workflowId : input.workflowId || "",
        failedStage: STAGE_NAME,
        workflowStep: input.nodeId || "",
        expected: "automationResult.results.wait_for_deepseek_response_complete.capturedResponse should exist for a completed prompt turn.",
        actual: "The prompt turn finished without a valid captured response payload."
      });
    }

    GatewayContracts.validateDeepSeekCapturedResponse(captureResult.capturedResponse, {
      messageType: "DEEPSEEK_PROMPT_TURN_RESULT",
      workflowId: automationResult && automationResult.workflowId ? automationResult.workflowId : input.workflowId || ""
    });

    return captureResult.capturedResponse;
  }

  async function runTurn(rawInput) {
    const input = normalizeInput(rawInput || {});
    const automationInput = buildAutomationInput(input);

    DeepSeekWorkflowContracts.validateRunAutomationInput(automationInput, {
      messageType: MESSAGE_TYPES.RUN_AUTOMATION
    });

    await emitTurnEvent(
      TELEMETRY_EVENTS.WORKFLOW_STEP_STARTED,
      "info",
      input,
      "DeepSeek prompt turn started",
      {
        expected: "A single DeepSeek prompt turn should send the prompt and capture a response."
      }
    );

    let automationResult = null;

    try {
      if (input.attachFile) {
        automationInput.filePayload = await NewSiteBackground.GatewayFileService.resolvePayload(Object.assign({}, automationInput, {
          traceId: input.traceId
        }));
      } else {
        automationInput.filePayload = null;
      }

      const forwardMessage = {
        type: MESSAGE_TYPES.RUN_AUTOMATION,
        traceId: input.traceId,
        targetSiteId: "deepseek",
        input: automationInput
      };

      automationResult = input.targetTabId
        ? await NewSiteBackground.DeepSeekTabService.forwardToTab(input.targetTabId, forwardMessage)
        : await NewSiteBackground.DeepSeekTabService.forward(forwardMessage);

      const response = extractCapturedResponse(automationResult, input);
      const result = {
        status: "completed",
        traceId: input.traceId,
        nodeId: input.nodeId,
        turnIndex: input.turnIndex,
        attachFile: input.attachFile,
        promptTextLength: input.promptTextLength,
        workflowId: automationResult && automationResult.workflowId ? automationResult.workflowId : input.workflowId || "",
        automationResult: automationResult,
        response: response,
        error: null
      };

      await recordTurnEvidence(
        "completed",
        input,
        result.workflowId,
        "Captured response text length " + String(response.textLength) + " for DeepSeek prompt turn.",
        {
          responseTextLength: response.textLength,
          selectorUsed: response.selectorUsed || "",
          attachFile: input.attachFile
        }
      );

      await emitTurnEvent(
        TELEMETRY_EVENTS.WORKFLOW_STEP_COMPLETED,
        "info",
        input,
        "DeepSeek prompt turn completed",
        {
          actual: "Captured response text length " + String(response.textLength) + ".",
          responseTextLength: response.textLength,
          selectorUsed: response.selectorUsed || "",
          workflowId: result.workflowId
        }
      );

      return result;
    } catch (error) {
      const structured = Errors.toStructuredError(error);
      structured.traceId = structured.traceId || input.traceId;
      structured.workflowId = structured.workflowId || (automationResult && automationResult.workflowId ? automationResult.workflowId : input.workflowId || "");
      structured.failedStage = structured.failedStage || STAGE_NAME;
      structured.workflowStep = structured.workflowStep || input.nodeId || "";
      structured.probableCause = structured.probableCause || MODULE_FILE;
      structured.turnIndex = input.turnIndex;
      structured.attachFile = input.attachFile;
      structured.promptTextLength = input.promptTextLength;

      await DiagnosticStore.recordError(structured);
      await recordTurnEvidence(
        "failed",
        input,
        structured.workflowId,
        structured.actual || structured.message,
        {
          responseTextLength: 0,
          attachFile: input.attachFile
        }
      );

      await emitTurnEvent(
        TELEMETRY_EVENTS.WORKFLOW_STEP_FAILED,
        "error",
        input,
        structured.message,
        {
          expected: structured.expected,
          actual: structured.actual,
          workflowId: structured.workflowId
        }
      );

      throw structured;
    }
  }

  NewSiteBackground.DeepSeekPromptTurnRunner = {
    runTurn: runTurn
  };
})(globalThis);
