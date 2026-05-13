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
})(globalThis);
