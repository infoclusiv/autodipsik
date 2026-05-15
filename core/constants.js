(function initConstants(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  // Load-order note: domain constant modules must execute before this compatibility facade.
  NewSiteCore.MESSAGE_TYPES = Object.assign(
    {},
    NewSiteCore.CoreMessageTypes || {},
    NewSiteCore.GatewayMessageTypes || {},
    NewSiteCore.DeepSeekMessageTypes || {}
  );

  NewSiteCore.STORAGE_KEYS = Object.assign(
    {},
    NewSiteCore.CoreStorageKeys || {},
    NewSiteCore.GatewayStorageKeys || {},
    NewSiteCore.DeepSeekStorageKeys || {}
  );

  NewSiteCore.TELEMETRY_EVENTS = Object.assign(
    {},
    NewSiteCore.CoreTelemetryEvents || {},
    NewSiteCore.GatewayTelemetryEvents || {},
    NewSiteCore.DeepSeekTelemetryEvents || {}
  );
})(globalThis);
