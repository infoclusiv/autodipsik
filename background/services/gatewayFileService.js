(function initGatewayFileService(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Telemetry = NewSiteCore.Telemetry;
  const Errors = NewSiteCore.Errors;
  const GatewayClient = NewSiteCore.GatewayClient;
  const GatewayProtocol = NewSiteCore.GatewayProtocol;
  const DiagnosticStore = NewSiteCore.DiagnosticStore;
  const GatewayContracts = NewSiteCore.GatewayContracts;

  async function ensureConnected() {
    try {
      return await GatewayClient.connect();
    } catch (error) {
      throw Errors.toStructuredError(error);
    }
  }

  async function selectFile(traceId) {
    const response = await GatewayClient.request(
      GatewayProtocol.GATEWAY_MESSAGE_TYPES.FILE_PICKER_OPEN_REQUEST,
      {
        allowedExtensions: [".xlsx", ".xls", ".csv"],
        dialogTitle: "Select Excel file to attach"
      }
    );
    const result = {
      status: "completed",
      traceId: traceId,
      gatewayStatus: await GatewayClient.getStatus(),
      file: response.payload || null
    };
    await DiagnosticStore.recordGatewaySnapshot({
      traceId: traceId,
      stage: "ensure_file_selected",
      gatewayStatus: result.gatewayStatus
    });
    return result;
  }

  async function executeUpload(traceId) {
    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.DEEPSEEK_EXECUTE_CLICKED,
      traceId: traceId,
      siteId: "deepseek",
      component: "background",
      level: "info",
      message: "DeepSeek upload execution requested"
    });

    const gatewayStatus = await GatewayClient.getStatus();
    const selectedFile = gatewayStatus.selectedFile;
    if (!selectedFile || !selectedFile.fileId) {
      throw Errors.createError("FILE_NOT_SELECTED", "No file has been selected in the Python gateway.", {
        expected: "A file should be selected before executing the upload.",
        actual: "The gateway has no selected file metadata.",
        suggestedFix: "Use the Select Excel File button before clicking Execute."
      });
    }

    const fileResponse = await GatewayClient.request(
      GatewayProtocol.GATEWAY_MESSAGE_TYPES.FILE_CONTENT_REQUEST,
      {
        fileId: selectedFile.fileId,
        encoding: "base64"
      }
    );

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.DEEPSEEK_ATTACH_STARTED,
      traceId: traceId,
      siteId: "deepseek",
      component: "background",
      level: "info",
      message: "Sending file to DeepSeek content script",
      data: { fileName: selectedFile.name, sizeBytes: selectedFile.sizeBytes }
    });

    const attachResult = await NewSiteBackground.DeepSeekTabService.forward({
      type: NewSiteCore.MESSAGE_TYPES.DEEPSEEK_ATTACH_FILE,
      traceId: traceId,
      file: fileResponse.payload
    });

    await Telemetry.emit({
      eventName: attachResult && attachResult.status === "completed"
        ? TELEMETRY_EVENTS.DEEPSEEK_ATTACH_COMPLETED
        : TELEMETRY_EVENTS.DEEPSEEK_ATTACH_FAILED,
      traceId: traceId,
      siteId: "deepseek",
      component: "background",
      level: attachResult && attachResult.status === "completed" ? "info" : "error",
      message: attachResult && attachResult.status === "completed"
        ? "DeepSeek file attached"
        : "DeepSeek file attach failed",
      data: attachResult || {}
    });

    return {
      status: "completed",
      traceId: traceId,
      gatewayStatus: await GatewayClient.getStatus(),
      attachResult: attachResult
    };
  }

  async function resolvePayload(input) {
    if (!input || input.dryRun) {
      return null;
    }

    await ensureConnected();

    const gatewayStatus = await GatewayClient.getStatus();
    let selectedFile = null;

    if (input.fileId) {
      selectedFile = {
        fileId: input.fileId,
        name: input.fileName || "",
        extension: input.fileExtension || ""
      };
    } else if (gatewayStatus && gatewayStatus.selectedFile) {
      selectedFile = gatewayStatus.selectedFile;
    }

    if (!selectedFile && input.filePath) {
      const fileByPathResponse = await GatewayClient.request(
        GatewayProtocol.GATEWAY_MESSAGE_TYPES.FILE_CONTENT_BY_PATH_REQUEST,
        {
          path: input.filePath
        }
      );
      return fileByPathResponse.payload || null;
    }

    if (!selectedFile || !selectedFile.fileId) {
      throw Errors.createError("GATEWAY_FILE_NOT_SELECTED", "No Excel file has been selected through the gateway.", {
        expected: "Automation Tester should select an Excel file through the gateway before running automation.",
        actual: "No gateway selectedFile or input.fileId is available.",
        gatewayStatus: gatewayStatus,
        suggestedFix: "Click Select Excel File in Automation Tester before running the workflow."
      });
    }

    const allowedExtensions = [".xls", ".xlsx"];
    if (
      selectedFile.extension
      && allowedExtensions.indexOf(String(selectedFile.extension).toLowerCase()) === -1
    ) {
      throw Errors.createError("FILE_EXTENSION_NOT_ALLOWED", "The selected file is not an Excel file.", {
        expected: "One of: " + allowedExtensions.join(", "),
        actual: selectedFile.extension
      });
    }

    const fileResponse = await GatewayClient.request(
      GatewayProtocol.GATEWAY_MESSAGE_TYPES.FILE_CONTENT_REQUEST,
      {
        fileId: selectedFile.fileId,
        encoding: "base64"
      }
    );

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.DEEPSEEK_FILE_PAYLOAD_RESOLVED,
      traceId: input.traceId || Telemetry.createTraceId("payload"),
      siteId: "deepseek",
      component: "background",
      level: "info",
      message: "DeepSeek file payload resolved",
      data: {
        fileId: selectedFile.fileId,
        fileName: selectedFile.name || "",
        extension: selectedFile.extension || ""
      }
    });

    return fileResponse.payload || null;
  }

  async function saveDeepSeekResponseJson(input) {
    const requestPayload = {
      fileId: input && input.fileId ? input.fileId : "",
      traceId: input && input.traceId ? input.traceId : "",
      workflowId: input && input.workflowId ? input.workflowId : "",
      selectedFile: input && input.selectedFile ? input.selectedFile : null,
      response: input && input.response ? input.response : null
    };

    GatewayContracts.validateSaveDeepSeekResponseJsonRequest(requestPayload, {
      messageType: GatewayProtocol.GATEWAY_MESSAGE_TYPES.SAVE_DEEPSEEK_RESPONSE_JSON
    });

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.DEEPSEEK_RESPONSE_JSON_SAVE_STARTED,
      traceId: requestPayload.traceId,
      workflowId: requestPayload.workflowId,
      siteId: "deepseek",
      component: "background",
      level: "info",
      message: "DeepSeek response JSON save requested",
      data: {
        fileId: requestPayload.fileId,
        fileName: requestPayload.selectedFile && requestPayload.selectedFile.name ? requestPayload.selectedFile.name : "",
        responseTextLength: requestPayload.response.textLength
      }
    });

    try {
      const gatewayResponse = await GatewayClient.request(
        GatewayProtocol.GATEWAY_MESSAGE_TYPES.SAVE_DEEPSEEK_RESPONSE_JSON,
        requestPayload
      );

      GatewayContracts.validateSaveDeepSeekResponseJsonResponse(gatewayResponse.payload || null, {
        messageType: gatewayResponse.type || GatewayProtocol.GATEWAY_MESSAGE_TYPES.DEEPSEEK_RESPONSE_JSON_SAVED
      });

      await DiagnosticStore.recordGatewaySnapshot({
        traceId: requestPayload.traceId,
        workflowId: requestPayload.workflowId,
        stage: "save_deepseek_response_json",
        gatewayResponseType: gatewayResponse.type,
        saveResult: gatewayResponse.payload || null
      });

      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.DEEPSEEK_RESPONSE_JSON_SAVE_COMPLETED,
        traceId: requestPayload.traceId,
        workflowId: requestPayload.workflowId,
        siteId: "deepseek",
        component: "background",
        level: "info",
        message: "DeepSeek response JSON save completed",
        data: gatewayResponse.payload || {}
      });

      return gatewayResponse.payload || null;
    } catch (error) {
      const structured = Errors.toStructuredError(error);
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.DEEPSEEK_RESPONSE_JSON_SAVE_FAILED,
        traceId: requestPayload.traceId,
        workflowId: requestPayload.workflowId,
        siteId: "deepseek",
        component: "background",
        level: "error",
        message: structured.message,
        expected: structured.expected,
        actual: structured.actual,
        data: structured
      });
      throw structured;
    }
  }

  NewSiteBackground.GatewayFileService = {
    ensureConnected: ensureConnected,
    selectFile: selectFile,
    executeUpload: executeUpload,
    resolvePayload: resolvePayload,
    saveDeepSeekResponseJson: saveDeepSeekResponseJson
  };
})(globalThis);
