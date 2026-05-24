(function initGatewayProtocol(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const gatewayConfig = NewSiteCore.GATEWAY_CONFIG || {};

  const GATEWAY_MESSAGE_TYPES = {
    HELLO: "HELLO",
    HELLO_ACK: "HELLO_ACK",
    PING: "PING",
    PONG: "PONG",
    FILE_PICKER_OPEN_REQUEST: "FILE_PICKER_OPEN_REQUEST",
    FILE_SELECTED: "FILE_SELECTED",
    FILE_CONTENT_REQUEST: "FILE_CONTENT_REQUEST",
    FILE_CONTENT_BY_PATH_REQUEST: "FILE_CONTENT_BY_PATH_REQUEST",
    FILE_CONTENT_RESPONSE: "FILE_CONTENT_RESPONSE",
    SAVE_DEEPSEEK_RESPONSE_JSON: "SAVE_DEEPSEEK_RESPONSE_JSON",
    DEEPSEEK_RESPONSE_JSON_SAVED: "DEEPSEEK_RESPONSE_JSON_SAVED",
    SAVE_DEEPSEEK_WORKFLOW_RUN_JSON: "SAVE_DEEPSEEK_WORKFLOW_RUN_JSON",
    DEEPSEEK_WORKFLOW_RUN_JSON_SAVED: "DEEPSEEK_WORKFLOW_RUN_JSON_SAVED",
    SAVE_DEEPSEEK_WORKFLOW_AHK_FILE: "SAVE_DEEPSEEK_WORKFLOW_AHK_FILE",
    DEEPSEEK_WORKFLOW_AHK_FILE_SAVED: "DEEPSEEK_WORKFLOW_AHK_FILE_SAVED",
    ERROR: "ERROR"
  };

  function createRequestId(prefix) {
    const seed = Math.random().toString(36).slice(2, 10);
    return [prefix || "msg", Date.now().toString(36), seed].join("_");
  }

  function createEnvelope(type, payload, options) {
    const meta = options || {};
    const id = meta.id || createRequestId("gw");
    return {
      id: id,
      type: type,
      version: gatewayConfig.protocolVersion || 1,
      timestamp: new Date().toISOString(),
      source: meta.source || "extension_background",
      correlationId: meta.correlationId || id,
      payload: payload || {}
    };
  }

  function isResponseFor(requestEnvelope, candidateEnvelope) {
    if (!requestEnvelope || !candidateEnvelope) {
      return false;
    }
    return candidateEnvelope.correlationId === requestEnvelope.id || candidateEnvelope.id === requestEnvelope.id;
  }

  NewSiteCore.GatewayProtocol = {
    GATEWAY_MESSAGE_TYPES: GATEWAY_MESSAGE_TYPES,
    createEnvelope: createEnvelope,
    createRequestId: createRequestId,
    isResponseFor: isResponseFor
  };
})(globalThis);
