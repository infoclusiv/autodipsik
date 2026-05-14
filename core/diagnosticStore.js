(function initDiagnosticStore(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const Storage = NewSiteCore.Storage;
  const Telemetry = NewSiteCore.Telemetry;
  const STORAGE_KEYS = NewSiteCore.STORAGE_KEYS;
  const EXTENSION_CONFIG = NewSiteCore.EXTENSION_CONFIG;
  const Contracts = NewSiteCore.ObservabilityContracts;
  const DiagnosticExporter = NewSiteCore.DiagnosticExporter;

  async function appendLimited(key, item, limit) {
    const current = await Storage.getValue(key, []);
    const next = Array.isArray(current) ? current.concat([item]).slice(-limit) : [item];
    await Storage.setValue(key, next);
    return next;
  }

  async function recordSelectorHealth(entry) {
    return appendLimited(STORAGE_KEYS.SELECTOR_HEALTH, entry, 100);
  }

  async function recordPageState(entry) {
    await appendSnapshotList("pageStateHistory", entry, 100);
    return appendLimited(STORAGE_KEYS.PAGE_STATE_HISTORY, entry, 100);
  }

  async function recordError(entry) {
    return appendLimited(STORAGE_KEYS.ERROR_LOG, entry, 100);
  }

  async function getDiagnosticSnapshot() {
    return Storage.getValue(STORAGE_KEYS.DIAGNOSTIC_SNAPSHOT, Contracts.createDiagnosticSnapshot());
  }

  async function persistDiagnosticSnapshot(snapshot) {
    await Storage.setValue(STORAGE_KEYS.DIAGNOSTIC_SNAPSHOT, snapshot);
    return snapshot;
  }

  async function appendSnapshotList(key, entry, limit) {
    const snapshot = await getDiagnosticSnapshot();
    const list = Array.isArray(snapshot[key]) ? snapshot[key] : [];
    snapshot[key] = list.concat([entry]).slice(-limit);
    await persistDiagnosticSnapshot(snapshot);
    return snapshot[key];
  }

  async function recordStepEvidence(entry) {
    return appendSnapshotList("stepEvidence", Contracts.createStepEvidence(entry), 200);
  }

  async function recordRuntimeSnapshot(entry) {
    return appendSnapshotList("runtimeSnapshots", entry, 50);
  }

  async function recordGatewaySnapshot(entry) {
    return appendSnapshotList("gatewaySnapshots", entry, 50);
  }

  async function recordContentScriptHealth(entry) {
    return appendSnapshotList("contentScriptHealth", entry, 50);
  }

  async function recordSendButtonEvidence(entry) {
    return appendSnapshotList("sendButtonEvidence", entry, 50);
  }

  async function setLastWorkflow(workflow) {
    await Storage.setValue(STORAGE_KEYS.LAST_WORKFLOW, workflow);
    await appendSnapshotList("workflowRuns", workflow, 20);
  }

  async function exportDiagnostics(activeProfile, siteConfig, extra) {
    const manifest = chrome.runtime.getManifest();
    const events = await Telemetry.getRecentEvents();
    const lastWorkflow = await Storage.getValue(STORAGE_KEYS.LAST_WORKFLOW, null);
    const selectorHealth = await Storage.getValue(STORAGE_KEYS.SELECTOR_HEALTH, []);
    const pageStateHistory = await Storage.getValue(STORAGE_KEYS.PAGE_STATE_HISTORY, []);
    const errors = await Storage.getValue(STORAGE_KEYS.ERROR_LOG, []);
    const gatewayStatus = await Storage.getValue(STORAGE_KEYS.GATEWAY_STATUS, null);
    const selectedGatewayFile = await Storage.getValue(STORAGE_KEYS.GATEWAY_SELECTED_FILE, null);
    const runtimeStatus = await Storage.getValue(STORAGE_KEYS.RUNTIME_STATUS, null);
    const diagnosticSnapshot = await getDiagnosticSnapshot();

    return DiagnosticExporter.exportDiagnostics({
      manifest: manifest,
      extensionConfig: EXTENSION_CONFIG,
      activeProfile: activeProfile,
      siteConfig: siteConfig,
      lastWorkflow: lastWorkflow,
      events: events,
      selectorHealth: selectorHealth,
      pageStateHistory: pageStateHistory,
      errors: errors,
      gatewayStatus: gatewayStatus,
      selectedGatewayFile: selectedGatewayFile,
      runtimeStatus: runtimeStatus,
      diagnosticSnapshot: diagnosticSnapshot,
      extra: extra || {}
    });
  }

  NewSiteCore.DiagnosticStore = {
    recordSelectorHealth: recordSelectorHealth,
    recordPageState: recordPageState,
    recordError: recordError,
    recordStepEvidence: recordStepEvidence,
    recordRuntimeSnapshot: recordRuntimeSnapshot,
    recordGatewaySnapshot: recordGatewaySnapshot,
    recordContentScriptHealth: recordContentScriptHealth,
    recordSendButtonEvidence: recordSendButtonEvidence,
    setLastWorkflow: setLastWorkflow,
    getDiagnosticSnapshot: getDiagnosticSnapshot,
    exportDiagnostics: exportDiagnostics
  };
})(globalThis);
