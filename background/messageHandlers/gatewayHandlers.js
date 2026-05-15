(function initGatewayHandlers(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  const GatewayClient = NewSiteCore.GatewayClient;

  async function getStatus(message) {
    return {
      status: "completed",
      traceId: message.traceId,
      gatewayStatus: await GatewayClient.getStatus()
    };
  }

  async function connect(message) {
    return {
      status: "completed",
      traceId: message.traceId,
      gatewayStatus: await NewSiteBackground.GatewayFileService.ensureConnected()
    };
  }

  async function disconnect(message) {
    return {
      status: "completed",
      traceId: message.traceId,
      gatewayStatus: await GatewayClient.disconnect()
    };
  }

  async function selectFile(message) {
    await NewSiteBackground.GatewayFileService.ensureConnected();
    return NewSiteBackground.GatewayFileService.selectFile(message.traceId);
  }

  async function executeUpload(message) {
    await NewSiteBackground.GatewayFileService.ensureConnected();
    return NewSiteBackground.GatewayFileService.executeUpload(message.traceId);
  }

  NewSiteBackground.GatewayHandlers = {
    getStatus: getStatus,
    connect: connect,
    disconnect: disconnect,
    selectFile: selectFile,
    executeUpload: executeUpload
  };
})(globalThis);
