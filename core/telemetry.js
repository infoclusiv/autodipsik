(function initTelemetry(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const config = NewSiteCore.EXTENSION_CONFIG;
  const constants = NewSiteCore.STORAGE_KEYS;
  const storage = NewSiteCore.Storage;

  const eventBuffer = [];

  function nowIso() {
    return new Date().toISOString();
  }

  function createTraceId(prefix) {
    return [
      prefix || "trace",
      Date.now().toString(36),
      Math.random().toString(36).slice(2, 10)
    ].join("_");
  }

  function normalizeEvent(event) {
    return {
      eventName: event.eventName || "unknown.event",
      timestamp: event.timestamp || nowIso(),
      traceId: event.traceId || createTraceId("trace"),
      siteId: event.siteId || "newsite",
      component: event.component || "unknown",
      workflowId: event.workflowId || "",
      stepName: event.stepName || "",
      level: event.level || "info",
      message: event.message || "",
      data: event.data || {}
    };
  }

  async function persistBuffer() {
    if (!storage || !config) {
      return;
    }
    await storage.setValue(constants.EVENT_BUFFER, eventBuffer.slice(-config.diagnosticMaxEvents));
  }

  async function emit(event) {
    if (!config || !config.telemetryEnabled) {
      return normalizeEvent(event);
    }

    const normalized = normalizeEvent(event);
    eventBuffer.push(normalized);

    if (eventBuffer.length > config.diagnosticMaxEvents) {
      eventBuffer.splice(0, eventBuffer.length - config.diagnosticMaxEvents);
    }

    await persistBuffer();
    return normalized;
  }

  async function hydrateFromStorage() {
    if (!storage) {
      return eventBuffer;
    }
    const persisted = await storage.getValue(constants.EVENT_BUFFER, []);
    eventBuffer.splice(0, eventBuffer.length);
    if (Array.isArray(persisted)) {
      Array.prototype.push.apply(eventBuffer, persisted.slice(-config.diagnosticMaxEvents));
    }
    return eventBuffer.slice();
  }

  async function getRecentEvents() {
    if (!eventBuffer.length) {
      await hydrateFromStorage();
    }
    return eventBuffer.slice();
  }

  NewSiteCore.Telemetry = {
    createTraceId: createTraceId,
    emit: emit,
    getRecentEvents: getRecentEvents,
    hydrateFromStorage: hydrateFromStorage
  };
})(globalThis);
