(function initConfig(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  NewSiteCore.EXTENSION_CONFIG = {
    extensionId: "newsite-automation-extension",
    extensionType: "newsite-automation",
    telemetryEnabled: true,
    diagnosticMaxEvents: 500,
    defaultPollIntervalMs: 500,
    defaultElementWaitTimeoutMs: 60000,
    storageNamespace: "newsite",
    eventBufferStorageKey: "telemetry_buffer",
    runtimeStatusStorageKey: "runtime_status",
    diagnosticSnapshotStorageKey: "diagnostic_snapshot"
  };

  NewSiteCore.GATEWAY_CONFIG = {
    host: "127.0.0.1",
    port: 8765,
    url: "ws://127.0.0.1:8765",
    protocolVersion: 1,
    requestTimeoutMs: 20000,
    pingIntervalMs: 30000,
    reconnectBaseDelayMs: 1500,
    reconnectMaxDelayMs: 15000
  };
})(globalThis);
