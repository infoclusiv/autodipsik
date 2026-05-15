(function initDeepSeekWorkflowContracts(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const MessageContracts = NewSiteCore.MessageContracts;

  function validateRunAutomationInput(input, context) {
    MessageContracts.requireFields(input, ["promptText"], {
      contractName: "RunAutomationInput",
      messageType: context && context.messageType ? context.messageType : ""
    });
  }

  NewSiteCore.DeepSeekWorkflowContracts = {
    validateRunAutomationInput: validateRunAutomationInput
  };
})(globalThis);
