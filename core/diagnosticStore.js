(function initDiagnosticStore(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const Storage = NewSiteCore.Storage;
  const Telemetry = NewSiteCore.Telemetry;
  const STORAGE_KEYS = NewSiteCore.STORAGE_KEYS;
  const EXTENSION_CONFIG = NewSiteCore.EXTENSION_CONFIG;
  const Contracts = NewSiteCore.ObservabilityContracts;
  const CausalContracts = NewSiteCore.CausalContracts;
  const WorkflowStateTracker = NewSiteCore.WorkflowStateTracker;
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

  async function recordCausalEvidence(entry) {
    return appendSnapshotList("causalEvidence", CausalContracts.createCausalEvidence(entry), 200);
  }

  async function recordGateSnapshot(entry) {
    return appendSnapshotList("gateSnapshots", CausalContracts.createCausalEvidence(entry), 200);
  }

  async function recordCausalReport(entry) {
    return appendSnapshotList("causalReports", CausalContracts.createCausalVerdict(entry), 20);
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

  async function upsertWorkflowRun(nextRun) {
    const snapshot = await getDiagnosticSnapshot();
    const workflowRuns = Array.isArray(snapshot.workflowRuns) ? snapshot.workflowRuns.slice() : [];
    const index = workflowRuns.findIndex(function findRun(run) {
      return run && run.workflowId === nextRun.workflowId;
    });

    if (index >= 0) {
      workflowRuns[index] = nextRun;
    } else {
      workflowRuns.push(nextRun);
    }

    snapshot.workflowRuns = workflowRuns.slice(-20);
    await persistDiagnosticSnapshot(snapshot);
    return nextRun;
  }

  async function findWorkflowRun(workflowId) {
    const snapshot = await getDiagnosticSnapshot();
    const workflowRuns = Array.isArray(snapshot.workflowRuns) ? snapshot.workflowRuns : [];
    return workflowRuns.find(function matchRun(run) {
      return run && run.workflowId === workflowId;
    }) || null;
  }

  async function recordWorkflowStarted(entry) {
    return upsertWorkflowRun(WorkflowStateTracker.recordWorkflowStarted(entry));
  }

  async function recordWorkflowStepStarted(entry) {
    const existing = await findWorkflowRun(entry.workflowId);
    return upsertWorkflowRun(WorkflowStateTracker.recordWorkflowStepStarted(existing, entry));
  }

  async function recordWorkflowStepCompleted(entry) {
    const existing = await findWorkflowRun(entry.workflowId);
    return upsertWorkflowRun(WorkflowStateTracker.recordWorkflowStepCompleted(existing, entry));
  }

  async function recordWorkflowStepFailed(entry) {
    const existing = await findWorkflowRun(entry.workflowId);
    return upsertWorkflowRun(WorkflowStateTracker.recordWorkflowStepFailed(existing, entry));
  }

  async function recordWorkflowCompleted(entry) {
    const existing = await findWorkflowRun(entry.workflowId);
    return upsertWorkflowRun(WorkflowStateTracker.recordWorkflowCompleted(existing, entry));
  }

  async function getLatestGateSnapshot(workflowId, gateName) {
    const snapshot = await getDiagnosticSnapshot();
    const gateSnapshots = Array.isArray(snapshot.gateSnapshots) ? snapshot.gateSnapshots : [];
    for (let index = gateSnapshots.length - 1; index >= 0; index -= 1) {
      const entry = gateSnapshots[index];
      if (entry && entry.workflowId === workflowId && entry.gateName === gateName) {
        return entry;
      }
    }
    return null;
  }

  async function setLastWorkflow(workflow) {
    await Storage.setValue(STORAGE_KEYS.LAST_WORKFLOW, workflow);
    const existing = await findWorkflowRun(workflow.workflowId);
    const merged = WorkflowStateTracker.createWorkflowRunState(Object.assign({}, existing || {}, workflow, {
      workflowId: workflow.workflowId,
      workflowName: workflow.workflowName || (existing && existing.workflowName) || "",
      traceId: workflow.traceId,
      runKind: workflow.runKind || (existing && existing.runKind) || WorkflowStateTracker.inferRunKind(workflow.workflowName || (existing && existing.workflowName) || ""),
      status: workflow.status || (existing && existing.status) || "unknown",
      startedAt: workflow.startedAt || (existing && existing.startedAt) || "",
      lastUpdatedAt: workflow.finishedAt || workflow.lastUpdatedAt || new Date().toISOString(),
      lastCompletedStep: workflow.lastCompletedStep || (existing && existing.lastCompletedStep) || "",
      currentStep: workflow.failedStep || workflow.currentStep || (existing && existing.currentStep) || "",
      nextExpectedStep: workflow.nextExpectedStep || "",
      terminal: typeof workflow.terminal === "boolean" ? workflow.terminal : Boolean(workflow.finishedAt || workflow.status === "completed" || workflow.status === "failed"),
      failedStep: workflow.failedStep || "",
      failedStage: workflow.failedStage || "",
      timeline: workflow.timeline || (existing && existing.timeline) || []
    }));
    await upsertWorkflowRun(merged);
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

    const diagnostics = DiagnosticExporter.exportDiagnostics({
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
    if (diagnostics && diagnostics.causalReport) {
      await recordCausalReport(diagnostics.causalReport);
    }
    return diagnostics;
  }

  NewSiteCore.DiagnosticStore = {
    recordSelectorHealth: recordSelectorHealth,
    recordPageState: recordPageState,
    recordError: recordError,
    recordStepEvidence: recordStepEvidence,
    recordCausalEvidence: recordCausalEvidence,
    recordGateSnapshot: recordGateSnapshot,
    getLatestGateSnapshot: getLatestGateSnapshot,
    recordCausalReport: recordCausalReport,
    recordRuntimeSnapshot: recordRuntimeSnapshot,
    recordGatewaySnapshot: recordGatewaySnapshot,
    recordContentScriptHealth: recordContentScriptHealth,
    recordSendButtonEvidence: recordSendButtonEvidence,
    recordWorkflowStarted: recordWorkflowStarted,
    recordWorkflowStepStarted: recordWorkflowStepStarted,
    recordWorkflowStepCompleted: recordWorkflowStepCompleted,
    recordWorkflowStepFailed: recordWorkflowStepFailed,
    recordWorkflowCompleted: recordWorkflowCompleted,
    setLastWorkflow: setLastWorkflow,
    getDiagnosticSnapshot: getDiagnosticSnapshot,
    exportDiagnostics: exportDiagnostics
  };
})(globalThis);
