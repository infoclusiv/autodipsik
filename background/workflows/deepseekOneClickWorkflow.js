(function initDeepSeekOneClickWorkflow(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  const MESSAGE_TYPES = NewSiteCore.MESSAGE_TYPES;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Telemetry = NewSiteCore.Telemetry;
  const Errors = NewSiteCore.Errors;
  const DiagnosticStore = NewSiteCore.DiagnosticStore;
  const GatewayClient = NewSiteCore.GatewayClient;
  const BackgroundContracts = NewSiteCore.BackgroundContracts;
  const GatewayContracts = NewSiteCore.GatewayContracts;

  const AUTOMATION_STAGE_MODULES = {
    ensure_gateway_connected: "background/workflows/deepseekOneClickWorkflow.js",
    ensure_file_selected: "background/workflows/deepseekOneClickWorkflow.js",
    ensure_deepseek_tab: "background/services/deepseekTabService.js",
    detect_page_state: "sites/deepseek/content.js",
    run_preflight: "sites/deepseek/chatAutomator.js",
    run_actual_automation: "sites/deepseek/chatAutomator.js",
    save_deepseek_response_json: "background/services/gatewayFileService.js"
  };

  async function runAutomationStage(traceId, stageName, fn) {
    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.AUTOMATION_ONE_CLICK_PRECONDITION_STARTED,
      traceId: traceId,
      siteId: "deepseek",
      component: "background",
      level: "info",
      message: "Automation one-click stage started",
      stage: stageName
    });

    try {
      const result = await fn();
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.AUTOMATION_ONE_CLICK_PRECONDITION_COMPLETED,
        traceId: traceId,
        siteId: "deepseek",
        component: "background",
        level: "info",
        message: "Automation one-click stage completed",
        stage: stageName
      });
      return result;
    } catch (error) {
      const structured = Errors.toStructuredError(error);
      structured.traceId = structured.traceId || traceId;
      structured.failedStage = structured.failedStage || stageName;
      structured.probableCause = structured.probableCause || AUTOMATION_STAGE_MODULES[stageName] || "background/workflows/deepseekOneClickWorkflow.js";
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.AUTOMATION_ONE_CLICK_PRECONDITION_FAILED,
        traceId: traceId,
        siteId: "deepseek",
        component: "background",
        level: "error",
        message: structured.message,
        stage: stageName,
        expected: structured.expected,
        actual: structured.actual,
        data: structured
      });
      throw structured;
    }
  }

  async function run(message) {
    const traceId = message.traceId;
    const input = Object.assign({
      promptText: "",
      autoConnectGateway: true,
      autoOpenDeepSeek: true,
      autoSelectFileIfMissing: true,
      runPreflight: true,
      runActualAutomation: true
    }, message.input || {});

    BackgroundContracts.validateAutomationOneClickInput(input, {
      messageType: MESSAGE_TYPES.AUTOMATION_ONE_CLICK_RUN
    });

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.AUTOMATION_ONE_CLICK_STARTED,
      traceId: traceId,
      siteId: "deepseek",
      component: "background",
      level: "info",
      message: "Automation one-click run started"
    });

    let gatewayStatus = await GatewayClient.getStatus();
    let selectedFile = gatewayStatus.selectedFile || null;
    let pageState = null;
    let workflowId = "";
    let automationResult = null;
    let responseJsonSave = null;

    try {
      gatewayStatus = await runAutomationStage(traceId, "ensure_gateway_connected", async function ensureGatewayConnected() {
        const status = input.autoConnectGateway
          ? await NewSiteBackground.GatewayFileService.ensureConnected()
          : await GatewayClient.getStatus();
        await DiagnosticStore.recordGatewaySnapshot({
          traceId: traceId,
          stage: "ensure_gateway_connected",
          gatewayStatus: status
        });
        return status;
      });

      selectedFile = await runAutomationStage(traceId, "ensure_file_selected", async function ensureFileSelected() {
        let currentStatus = await GatewayClient.getStatus();
        if (!currentStatus.selectedFile && input.autoSelectFileIfMissing) {
          const selection = await NewSiteBackground.GatewayFileService.selectFile(traceId);
          currentStatus = selection.gatewayStatus || currentStatus;
        }
        if (!currentStatus.selectedFile || !currentStatus.selectedFile.fileId) {
          throw Errors.createError("FILE_SELECTION_CANCELLED", "No file was selected for the workflow.", {
            traceId: traceId,
            failedStage: "ensure_file_selected",
            expected: "A gateway-selected Excel file should be available.",
            actual: "The file picker completed without a selected file.",
            nextChecks: [
              "Run automation again and select an Excel file when prompted."
            ]
          });
        }
        gatewayStatus = currentStatus;
        return currentStatus.selectedFile;
      });

      if (input.autoOpenDeepSeek) {
        await runAutomationStage(traceId, "ensure_deepseek_tab", function ensureDeepSeekTabStage() {
          return NewSiteBackground.DeepSeekTabService.ensureReady(traceId);
        });
      }

      pageState = await runAutomationStage(traceId, "detect_page_state", async function detectPageStateStage() {
        return NewSiteBackground.DeepSeekTabService.forward({
          type: MESSAGE_TYPES.PAGE_STATE_DETECT,
          traceId: traceId,
          targetSiteId: "deepseek"
        });
      });

      if (input.runPreflight) {
        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.DEEPSEEK_PREFLIGHT_STARTED,
          traceId: traceId,
          siteId: "deepseek",
          component: "background",
          level: "info",
          message: "DeepSeek preflight started"
        });
        const preflightResult = await runAutomationStage(traceId, "run_preflight", async function preflightStage() {
          return NewSiteBackground.DeepSeekTabService.forward({
            type: MESSAGE_TYPES.RUN_AUTOMATION,
            traceId: traceId,
            targetSiteId: "deepseek",
            input: {
              dryRun: true,
              promptText: input.promptText,
              useGatewaySelectedFile: true,
              selectedFile: selectedFile,
              waitForResponse: false
            }
          });
        });
        workflowId = preflightResult.workflowId || workflowId;
        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.DEEPSEEK_PREFLIGHT_COMPLETED,
          traceId: traceId,
          siteId: "deepseek",
          component: "background",
          level: "info",
          message: "DeepSeek preflight completed",
          data: { workflowId: preflightResult.workflowId || "" }
        });
      }

      if (input.runActualAutomation) {
        automationResult = await runAutomationStage(traceId, "run_actual_automation", async function actualStage() {
          const nextMessage = {
            type: MESSAGE_TYPES.RUN_AUTOMATION,
            traceId: traceId,
            targetSiteId: "deepseek",
            input: {
              dryRun: false,
              promptText: input.promptText,
              useGatewaySelectedFile: true,
              selectedFile: selectedFile,
              waitForResponse: true,
              fileId: selectedFile.fileId,
              fileName: selectedFile.name,
              fileExtension: selectedFile.extension
            }
          };
          nextMessage.input.filePayload = await NewSiteBackground.GatewayFileService.resolvePayload({
            traceId: traceId,
            fileId: selectedFile.fileId,
            fileName: selectedFile.name,
            fileExtension: selectedFile.extension,
            dryRun: false
          });
          return NewSiteBackground.DeepSeekTabService.forward(nextMessage);
        });
        workflowId = automationResult.workflowId || workflowId;

        responseJsonSave = await runAutomationStage(traceId, "save_deepseek_response_json", async function saveDeepSeekResponseJsonStage() {
          const captureResult = automationResult
            && automationResult.results
            && automationResult.results.wait_for_deepseek_response_complete
            ? automationResult.results.wait_for_deepseek_response_complete
            : null;

          if (!captureResult || captureResult.skipped || captureResult.responseCaptured !== true || !captureResult.capturedResponse) {
            throw Errors.createError("DEEPSEEK_RESPONSE_CAPTURE_MISSING", "The DeepSeek response was not captured, so no JSON save request can be sent.", {
              traceId: traceId,
              workflowId: workflowId,
              failedStage: "save_deepseek_response_json",
              expected: "A completed wait_for_deepseek_response_complete result with capturedResponse should exist before saving JSON.",
              actual: "The actual automation completed without a valid captured response result."
            });
          }

          GatewayContracts.validateDeepSeekCapturedResponse(captureResult.capturedResponse, {
            messageType: "RUN_AUTOMATION_RESULT"
          });

          if (!selectedFile || !selectedFile.fileId) {
            throw Errors.createError("GATEWAY_FILE_NOT_SELECTED", "The selected file metadata was missing before saving the DeepSeek response JSON.", {
              traceId: traceId,
              workflowId: workflowId,
              failedStage: "save_deepseek_response_json",
              expected: "A selected Excel file with fileId should still be available after automation completes.",
              actual: "selectedFile.fileId was missing."
            });
          }

          if (captureResult.capturedResponse.textLength <= 0) {
            throw Errors.createError("DEEPSEEK_CAPTURED_RESPONSE_EMPTY", "The captured DeepSeek response was empty.", {
              traceId: traceId,
              workflowId: workflowId,
              failedStage: "save_deepseek_response_json",
              expected: "Captured response text should be non-empty before sending it to the gateway.",
              actual: "capturedResponse.textLength was " + String(captureResult.capturedResponse.textLength) + "."
            });
          }

          return NewSiteBackground.GatewayFileService.saveDeepSeekResponseJson({
            traceId: traceId,
            workflowId: workflowId,
            fileId: selectedFile.fileId,
            selectedFile: selectedFile,
            response: captureResult.capturedResponse
          });
        });
      }

      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.AUTOMATION_ONE_CLICK_COMPLETED,
        traceId: traceId,
        siteId: "deepseek",
        component: "background",
        level: "info",
        message: "Automation one-click run completed"
      });

      return {
        status: "completed",
        traceId: traceId,
        workflowId: workflowId,
        stage: "completed",
        failedStage: "",
        failedStep: automationResult && automationResult.failedStep ? automationResult.failedStep : "",
        gatewayStatus: await GatewayClient.getStatus(),
        selectedFile: selectedFile,
        pageState: pageState,
        automationResult: automationResult,
        responseJsonSave: responseJsonSave,
        diagnosticPackageReady: Boolean(automationResult && automationResult.diagnosticPackage),
        error: null
      };
    } catch (error) {
      const structured = Errors.toStructuredError(error);
      structured.traceId = structured.traceId || traceId;
      if (structured.failedStage === "save_deepseek_response_json") {
        const captureResult = automationResult
          && automationResult.results
          && automationResult.results.wait_for_deepseek_response_complete
          ? automationResult.results.wait_for_deepseek_response_complete
          : null;
        structured.fileIdPresent = Boolean(selectedFile && selectedFile.fileId);
        structured.selectedFileName = selectedFile && selectedFile.name ? selectedFile.name : "";
        structured.responseTextLength = captureResult && captureResult.capturedResponse
          ? captureResult.capturedResponse.textLength || 0
          : 0;
        structured.expected = structured.expected || "The gateway should write a DeepSeek response JSON file beside the selected Excel file.";
      }
      await DiagnosticStore.recordError(structured);
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.AUTOMATION_ONE_CLICK_FAILED,
        traceId: traceId,
        siteId: "deepseek",
        component: "background",
        level: "error",
        message: structured.message,
        stage: structured.failedStage || "",
        expected: structured.expected,
        actual: structured.actual,
        data: structured
      });
      return {
        status: "failed",
        traceId: traceId,
        workflowId: workflowId,
        stage: structured.failedStage || "failed",
        failedStage: structured.failedStage || "",
        failedStep: structured.workflowStep || "",
        gatewayStatus: await GatewayClient.getStatus(),
        selectedFile: selectedFile,
        pageState: pageState,
        automationResult: automationResult,
        responseJsonSave: responseJsonSave,
        diagnosticPackageReady: true,
        error: structured
      };
    }
  }

  NewSiteBackground.DeepSeekOneClickWorkflow = {
    run: run
  };
})(globalThis);
