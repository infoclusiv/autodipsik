(function initAutomationHandlers(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  const GatewayClient = NewSiteCore.GatewayClient;
  const DeepSeekWorkflowContracts = NewSiteCore.DeepSeekWorkflowContracts;

  async function runAutomation(message) {
    const nextMessage = Object.assign({}, message, {
      input: Object.assign({}, message.input || {})
    });
    DeepSeekWorkflowContracts.validateRunAutomationInput(nextMessage.input, {
      messageType: nextMessage.type
    });
    nextMessage.input.filePayload = await NewSiteBackground.GatewayFileService.resolvePayload(nextMessage.input);
    const gatewayStatus = await GatewayClient.getStatus();
    const result = await NewSiteBackground.DeepSeekTabService.forward(nextMessage);
    if (result && typeof result === "object") {
      result.gatewayStatus = gatewayStatus;
    }
    return result;
  }

  async function runOneClick(message) {
    return NewSiteBackground.DeepSeekOneClickWorkflow.run(message);
  }

  async function runConditionalWorkflow(message) {
    return NewSiteBackground.DeepSeekConditionalWorkflow.run(message);
  }

  NewSiteBackground.AutomationHandlers = {
    runAutomation: runAutomation,
    runOneClick: runOneClick,
    runConditionalWorkflow: runConditionalWorkflow
  };
})(globalThis);
