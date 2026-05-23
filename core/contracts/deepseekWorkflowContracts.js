(function initDeepSeekWorkflowContracts(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const MessageContracts = NewSiteCore.MessageContracts;
  const Errors = NewSiteCore.Errors;
  const GatewayContracts = NewSiteCore.GatewayContracts;

  function validateRunAutomationInput(input, context) {
    MessageContracts.requireFields(input, ["promptText"], {
      contractName: "RunAutomationInput",
      messageType: context && context.messageType ? context.messageType : ""
    });

    if (typeof input.attachFile !== "undefined" && typeof input.attachFile !== "boolean") {
      throw Errors.createError("CONTRACT_VALIDATION_FAILED", "attachFile must be a boolean when provided.", {
        expected: "attachFile should be true or false.",
        actual: "attachFile was " + String(input.attachFile) + ".",
        messageType: context && context.messageType ? context.messageType : "",
        probableCause: "core/contracts/deepseekWorkflowContracts.js"
      });
    }

    if (typeof input.waitForResponse !== "undefined" && typeof input.waitForResponse !== "boolean") {
      throw Errors.createError("CONTRACT_VALIDATION_FAILED", "waitForResponse must be a boolean when provided.", {
        expected: "waitForResponse should be true or false.",
        actual: "waitForResponse was " + String(input.waitForResponse) + ".",
        messageType: context && context.messageType ? context.messageType : "",
        probableCause: "core/contracts/deepseekWorkflowContracts.js"
      });
    }

    if (typeof input.selectedFile !== "undefined") {
      if (!input.selectedFile || typeof input.selectedFile !== "object" || Array.isArray(input.selectedFile)) {
        throw Errors.createError("CONTRACT_VALIDATION_FAILED", "selectedFile must be an object when provided.", {
          expected: "selectedFile should include file metadata such as fileId and name.",
          actual: "selectedFile was not a valid object.",
          messageType: context && context.messageType ? context.messageType : "",
          probableCause: "core/contracts/deepseekWorkflowContracts.js"
        });
      }

      MessageContracts.requireFields(input.selectedFile, ["fileId", "name"], {
        contractName: "RunAutomationInput.selectedFile",
        messageType: context && context.messageType ? context.messageType : ""
      });
    }
  }

  function validateCapturedResponseResult(input, context) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw Errors.createError("CONTRACT_VALIDATION_FAILED", "Captured response result must be an object.", {
        expected: "A workflow result object with capturedResponse metadata.",
        actual: "The captured response result was missing or invalid.",
        messageType: context && context.messageType ? context.messageType : "",
        probableCause: "core/contracts/deepseekWorkflowContracts.js"
      });
    }

    if (input.responseCaptured !== true) {
      throw Errors.createError("CONTRACT_VALIDATION_FAILED", "responseCaptured must be true when a captured response result is returned.", {
        expected: "responseCaptured should be true for a completed response capture result.",
        actual: "responseCaptured was " + String(input.responseCaptured) + ".",
        messageType: context && context.messageType ? context.messageType : "",
        probableCause: "core/contracts/deepseekWorkflowContracts.js"
      });
    }

    GatewayContracts.validateDeepSeekCapturedResponse(input.capturedResponse, context);
  }

  NewSiteCore.DeepSeekWorkflowContracts = {
    validateCapturedResponseResult: validateCapturedResponseResult,
    validateRunAutomationInput: validateRunAutomationInput
  };
})(globalThis);
