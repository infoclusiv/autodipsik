(function initGatewayPersistenceService(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Telemetry = NewSiteCore.Telemetry;
  const Errors = NewSiteCore.Errors;
  const GatewayClient = NewSiteCore.GatewayClient;
  const GatewayProtocol = NewSiteCore.GatewayProtocol;
  const DiagnosticStore = NewSiteCore.DiagnosticStore;
  const GatewayContracts = NewSiteCore.GatewayContracts;

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

  async function saveDeepSeekWorkflowRunJson(input) {
    const requestPayload = {
      fileId: input && input.fileId ? input.fileId : "",
      traceId: input && input.traceId ? input.traceId : "",
      workflowId: input && input.workflowId ? input.workflowId : "",
      selectedFile: input && input.selectedFile ? input.selectedFile : null,
      definitionSummary: input && input.definitionSummary ? input.definitionSummary : null,
      workflowRun: input && input.workflowRun ? input.workflowRun : null
    };

    GatewayContracts.validateSaveDeepSeekWorkflowRunJsonRequest(requestPayload, {
      messageType: GatewayProtocol.GATEWAY_MESSAGE_TYPES.SAVE_DEEPSEEK_WORKFLOW_RUN_JSON
    });

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.DEEPSEEK_WORKFLOW_RUN_JSON_SAVE_STARTED,
      traceId: requestPayload.traceId,
      workflowId: requestPayload.workflowId,
      siteId: "deepseek",
      component: "background",
      level: "info",
      message: "DeepSeek workflow run JSON save requested",
      data: {
        fileId: requestPayload.fileId,
        fileName: requestPayload.selectedFile && requestPayload.selectedFile.name ? requestPayload.selectedFile.name : "",
        workflowStatus: requestPayload.workflowRun && requestPayload.workflowRun.status ? requestPayload.workflowRun.status : "",
        visitedNodeCount: requestPayload.workflowRun && Array.isArray(requestPayload.workflowRun.visitedNodeIds)
          ? requestPayload.workflowRun.visitedNodeIds.length
          : 0
      }
    });

    try {
      const gatewayResponse = await GatewayClient.request(
        GatewayProtocol.GATEWAY_MESSAGE_TYPES.SAVE_DEEPSEEK_WORKFLOW_RUN_JSON,
        requestPayload
      );

      GatewayContracts.validateSaveDeepSeekWorkflowRunJsonResponse(gatewayResponse.payload || null, {
        messageType: gatewayResponse.type || GatewayProtocol.GATEWAY_MESSAGE_TYPES.DEEPSEEK_WORKFLOW_RUN_JSON_SAVED
      });

      await DiagnosticStore.recordGatewaySnapshot({
        traceId: requestPayload.traceId,
        workflowId: requestPayload.workflowId,
        stage: "save_deepseek_workflow_run_json",
        gatewayResponseType: gatewayResponse.type,
        saveResult: gatewayResponse.payload || null
      });

      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.DEEPSEEK_WORKFLOW_RUN_JSON_SAVE_COMPLETED,
        traceId: requestPayload.traceId,
        workflowId: requestPayload.workflowId,
        siteId: "deepseek",
        component: "background",
        level: "info",
        message: "DeepSeek workflow run JSON save completed",
        data: gatewayResponse.payload || {}
      });

      return gatewayResponse.payload || null;
    } catch (error) {
      const structured = Errors.toStructuredError(error);
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.DEEPSEEK_WORKFLOW_RUN_JSON_SAVE_FAILED,
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

  async function saveDeepSeekWorkflowAhkFile(input) {
    const requestPayload = {
      fileId: input && input.fileId ? input.fileId : "",
      traceId: input && input.traceId ? input.traceId : "",
      workflowId: input && input.workflowId ? input.workflowId : "",
      selectedFile: input && input.selectedFile ? input.selectedFile : null,
      workflowRun: input && input.workflowRun ? input.workflowRun : null
    };

    GatewayContracts.validateSaveDeepSeekWorkflowAhkFileRequest(requestPayload, {
      messageType: GatewayProtocol.GATEWAY_MESSAGE_TYPES.SAVE_DEEPSEEK_WORKFLOW_AHK_FILE
    });

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.DEEPSEEK_WORKFLOW_AHK_FILE_SAVE_STARTED,
      traceId: requestPayload.traceId,
      workflowId: requestPayload.workflowId,
      siteId: "deepseek",
      component: "background",
      level: "info",
      message: "DeepSeek workflow AHK file save requested",
      data: {
        fileId: requestPayload.fileId,
        fileName: requestPayload.selectedFile && requestPayload.selectedFile.name ? requestPayload.selectedFile.name : "",
        workflowStatus: requestPayload.workflowRun && requestPayload.workflowRun.status ? requestPayload.workflowRun.status : ""
      }
    });

    try {
      const gatewayResponse = await GatewayClient.request(
        GatewayProtocol.GATEWAY_MESSAGE_TYPES.SAVE_DEEPSEEK_WORKFLOW_AHK_FILE,
        requestPayload
      );

      GatewayContracts.validateSaveDeepSeekWorkflowAhkFileResponse(gatewayResponse.payload || null, {
        messageType: gatewayResponse.type || GatewayProtocol.GATEWAY_MESSAGE_TYPES.DEEPSEEK_WORKFLOW_AHK_FILE_SAVED
      });

      await DiagnosticStore.recordGatewaySnapshot({
        traceId: requestPayload.traceId,
        workflowId: requestPayload.workflowId,
        stage: "save_deepseek_workflow_ahk_file",
        gatewayResponseType: gatewayResponse.type,
        saveResult: gatewayResponse.payload || null
      });

      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.DEEPSEEK_WORKFLOW_AHK_FILE_SAVE_COMPLETED,
        traceId: requestPayload.traceId,
        workflowId: requestPayload.workflowId,
        siteId: "deepseek",
        component: "background",
        level: "info",
        message: "DeepSeek workflow AHK file save completed",
        data: gatewayResponse.payload || {}
      });

      return gatewayResponse.payload || null;
    } catch (error) {
      const structured = Errors.toStructuredError(error);
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.DEEPSEEK_WORKFLOW_AHK_FILE_SAVE_FAILED,
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

  NewSiteBackground.GatewayPersistenceService = {
    saveDeepSeekResponseJson: saveDeepSeekResponseJson,
    saveDeepSeekWorkflowRunJson: saveDeepSeekWorkflowRunJson,
    saveDeepSeekWorkflowAhkFile: saveDeepSeekWorkflowAhkFile
  };
})(globalThis);
