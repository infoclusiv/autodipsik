(function initGatewayContracts(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const MessageContracts = NewSiteCore.MessageContracts;

  function validateFileContentRequest(input, context) {
    MessageContracts.requireFields(input, ["fileId"], {
      contractName: "GatewayFileContentRequest",
      messageType: context && context.messageType ? context.messageType : ""
    });
  }

  NewSiteCore.GatewayContracts = {
    validateFileContentRequest: validateFileContentRequest
  };
})(globalThis);
