(function initGatewayContracts(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const MessageContracts = NewSiteCore.MessageContracts;
  const Errors = NewSiteCore.Errors;

  function ensureObject(value, context) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw Errors.createError("CONTRACT_VALIDATION_FAILED", "Expected an object payload.", {
        expected: (context && context.expected) || "A non-null object payload.",
        actual: (context && context.actual) || "Received a non-object payload.",
        messageType: context && context.messageType ? context.messageType : "",
        probableCause: context && context.contractName ? context.contractName : "core/contracts/gatewayContracts.js"
      });
    }
  }

  function validateDeepSeekCapturedResponse(input, context) {
    ensureObject(input, {
      contractName: "DeepSeekCapturedResponse",
      messageType: context && context.messageType ? context.messageType : "",
      expected: "A captured DeepSeek response object with non-empty text and metadata.",
      actual: "The captured response payload was missing or invalid."
    });

    MessageContracts.requireFields(input, ["source", "capturedAt", "selectorUsed", "text", "textLength", "completionSignals"], {
      contractName: "DeepSeekCapturedResponse",
      messageType: context && context.messageType ? context.messageType : ""
    });

    if (String(input.text || "").trim().length < 1) {
      throw Errors.createError("CONTRACT_VALIDATION_FAILED", "Captured response text is required.", {
        expected: "capturedResponse.text should be a non-empty string.",
        actual: "capturedResponse.text was empty or whitespace only.",
        messageType: context && context.messageType ? context.messageType : "",
        probableCause: "core/contracts/gatewayContracts.js"
      });
    }

    if (typeof input.textLength !== "number" || input.textLength < 0) {
      throw Errors.createError("CONTRACT_VALIDATION_FAILED", "Captured response textLength is invalid.", {
        expected: "capturedResponse.textLength should be a non-negative number.",
        actual: "capturedResponse.textLength was " + String(input.textLength) + ".",
        messageType: context && context.messageType ? context.messageType : "",
        probableCause: "core/contracts/gatewayContracts.js"
      });
    }

    if (input.textLength !== String(input.text || "").length) {
      throw Errors.createError("CONTRACT_VALIDATION_FAILED", "Captured response textLength does not match the response text.", {
        expected: "capturedResponse.textLength should match capturedResponse.text.length.",
        actual: "textLength was " + String(input.textLength) + " but text length was " + String(String(input.text || "").length) + ".",
        messageType: context && context.messageType ? context.messageType : "",
        probableCause: "core/contracts/gatewayContracts.js"
      });
    }

    ensureObject(input.completionSignals, {
      contractName: "DeepSeekCapturedResponse",
      messageType: context && context.messageType ? context.messageType : "",
      expected: "capturedResponse.completionSignals should be an object.",
      actual: "capturedResponse.completionSignals was missing or invalid."
    });
  }

  function validateFileContentRequest(input, context) {
    MessageContracts.requireFields(input, ["fileId"], {
      contractName: "GatewayFileContentRequest",
      messageType: context && context.messageType ? context.messageType : ""
    });
  }

  function validateSaveDeepSeekResponseJsonRequest(input, context) {
    ensureObject(input, {
      contractName: "SaveDeepSeekResponseJsonRequest",
      messageType: context && context.messageType ? context.messageType : "",
      expected: "A save request payload with fileId and response.",
      actual: "The save request payload was missing or invalid."
    });

    MessageContracts.requireFields(input, ["fileId", "response"], {
      contractName: "SaveDeepSeekResponseJsonRequest",
      messageType: context && context.messageType ? context.messageType : ""
    });

    if (!input.traceId) {
      throw Errors.createError("CONTRACT_VALIDATION_FAILED", "traceId is required to save a DeepSeek response JSON.", {
        expected: "saveDeepSeekResponseJson payload should include traceId.",
        actual: "traceId was missing.",
        messageType: context && context.messageType ? context.messageType : "",
        probableCause: "core/contracts/gatewayContracts.js"
      });
    }

    validateDeepSeekCapturedResponse(input.response, context);
  }

  function validateSaveDeepSeekResponseJsonResponse(input, context) {
    ensureObject(input, {
      contractName: "SaveDeepSeekResponseJsonResponse",
      messageType: context && context.messageType ? context.messageType : "",
      expected: "A gateway save response payload with output metadata.",
      actual: "The gateway save response payload was missing or invalid."
    });

    MessageContracts.requireFields(input, ["status", "outputPath", "fileName", "bytesWritten"], {
      contractName: "SaveDeepSeekResponseJsonResponse",
      messageType: context && context.messageType ? context.messageType : ""
    });

    if (typeof input.bytesWritten !== "number" || input.bytesWritten <= 0) {
      throw Errors.createError("CONTRACT_VALIDATION_FAILED", "bytesWritten must be a positive number.", {
        expected: "save response bytesWritten should be greater than 0.",
        actual: "bytesWritten was " + String(input.bytesWritten) + ".",
        messageType: context && context.messageType ? context.messageType : "",
        probableCause: "core/contracts/gatewayContracts.js"
      });
    }
  }

  function validateSaveDeepSeekWorkflowRunJsonRequest(input, context) {
    ensureObject(input, {
      contractName: "SaveDeepSeekWorkflowRunJsonRequest",
      messageType: context && context.messageType ? context.messageType : "",
      expected: "A save request payload with fileId, traceId, workflowId, and workflowRun.",
      actual: "The workflow run save request payload was missing or invalid."
    });

    MessageContracts.requireFields(input, ["fileId", "traceId", "workflowId", "workflowRun"], {
      contractName: "SaveDeepSeekWorkflowRunJsonRequest",
      messageType: context && context.messageType ? context.messageType : ""
    });

    ensureObject(input.workflowRun, {
      contractName: "SaveDeepSeekWorkflowRunRequest.workflowRun",
      messageType: context && context.messageType ? context.messageType : "",
      expected: "workflowRun should be an object containing the conditional workflow execution result.",
      actual: "workflowRun was missing or invalid."
    });
  }

  function validateSaveDeepSeekWorkflowRunJsonResponse(input, context) {
    ensureObject(input, {
      contractName: "SaveDeepSeekWorkflowRunJsonResponse",
      messageType: context && context.messageType ? context.messageType : "",
      expected: "A gateway workflow run save response with output metadata.",
      actual: "The workflow run save response payload was missing or invalid."
    });

    MessageContracts.requireFields(input, ["status", "outputPath", "fileName", "bytesWritten"], {
      contractName: "SaveDeepSeekWorkflowRunJsonResponse",
      messageType: context && context.messageType ? context.messageType : ""
    });

    if (typeof input.bytesWritten !== "number" || input.bytesWritten <= 0) {
      throw Errors.createError("CONTRACT_VALIDATION_FAILED", "bytesWritten must be a positive number.", {
        expected: "workflow run save response bytesWritten should be greater than 0.",
        actual: "bytesWritten was " + String(input.bytesWritten) + ".",
        messageType: context && context.messageType ? context.messageType : "",
        probableCause: "core/contracts/gatewayContracts.js"
      });
    }
  }

  function validateSaveDeepSeekWorkflowAhkFileRequest(input, context) {
    ensureObject(input, {
      contractName: "SaveDeepSeekWorkflowAhkFileRequest",
      messageType: context && context.messageType ? context.messageType : "",
      expected: "A save request payload with fileId, traceId, workflowId, and workflowRun.",
      actual: "The workflow AHK save request payload was missing or invalid."
    });

    MessageContracts.requireFields(input, ["fileId", "traceId", "workflowId", "workflowRun"], {
      contractName: "SaveDeepSeekWorkflowAhkFileRequest",
      messageType: context && context.messageType ? context.messageType : ""
    });

    ensureObject(input.workflowRun, {
      contractName: "SaveDeepSeekWorkflowAhkFileRequest.workflowRun",
      messageType: context && context.messageType ? context.messageType : "",
      expected: "workflowRun should be an object containing the conditional workflow execution result.",
      actual: "workflowRun was missing or invalid."
    });
  }

  function validateSaveDeepSeekWorkflowAhkFileResponse(input, context) {
    ensureObject(input, {
      contractName: "SaveDeepSeekWorkflowAhkFileResponse",
      messageType: context && context.messageType ? context.messageType : "",
      expected: "A gateway workflow AHK save response with output metadata.",
      actual: "The workflow AHK save response payload was missing or invalid."
    });

    MessageContracts.requireFields(input, ["status", "outputPath", "fileName", "bytesWritten"], {
      contractName: "SaveDeepSeekWorkflowAhkFileResponse",
      messageType: context && context.messageType ? context.messageType : ""
    });

    if (typeof input.bytesWritten !== "number" || input.bytesWritten <= 0) {
      throw Errors.createError("CONTRACT_VALIDATION_FAILED", "bytesWritten must be a positive number.", {
        expected: "workflow AHK save response bytesWritten should be greater than 0.",
        actual: "bytesWritten was " + String(input.bytesWritten) + ".",
        messageType: context && context.messageType ? context.messageType : "",
        probableCause: "core/contracts/gatewayContracts.js"
      });
    }

    if (typeof input.overwritten !== "undefined" && typeof input.overwritten !== "boolean") {
      throw Errors.createError("CONTRACT_VALIDATION_FAILED", "overwritten must be a boolean when provided.", {
        expected: "workflow AHK save response overwritten should be a boolean when present.",
        actual: "overwritten was " + typeof input.overwritten + ".",
        messageType: context && context.messageType ? context.messageType : "",
        probableCause: "core/contracts/gatewayContracts.js"
      });
    }
  }

  NewSiteCore.GatewayContracts = {
    validateDeepSeekCapturedResponse: validateDeepSeekCapturedResponse,
    validateFileContentRequest: validateFileContentRequest,
    validateSaveDeepSeekResponseJsonRequest: validateSaveDeepSeekResponseJsonRequest,
    validateSaveDeepSeekResponseJsonResponse: validateSaveDeepSeekResponseJsonResponse,
    validateSaveDeepSeekWorkflowRunJsonRequest: validateSaveDeepSeekWorkflowRunJsonRequest,
    validateSaveDeepSeekWorkflowRunJsonResponse: validateSaveDeepSeekWorkflowRunJsonResponse,
    validateSaveDeepSeekWorkflowAhkFileRequest: validateSaveDeepSeekWorkflowAhkFileRequest,
    validateSaveDeepSeekWorkflowAhkFileResponse: validateSaveDeepSeekWorkflowAhkFileResponse
  };
})(globalThis);
