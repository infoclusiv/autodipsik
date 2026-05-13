(function initDiagnosticStore(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const Storage = NewSiteCore.Storage;
  const Telemetry = NewSiteCore.Telemetry;
  const STORAGE_KEYS = NewSiteCore.STORAGE_KEYS;
  const EXTENSION_CONFIG = NewSiteCore.EXTENSION_CONFIG;

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
    return appendLimited(STORAGE_KEYS.PAGE_STATE_HISTORY, entry, 100);
  }

  async function recordError(entry) {
    return appendLimited(STORAGE_KEYS.ERROR_LOG, entry, 100);
  }

  async function setLastWorkflow(workflow) {
    await Storage.setValue(STORAGE_KEYS.LAST_WORKFLOW, workflow);
  }

  function buildAiDebugSummary(lastWorkflow, events, errors) {
    const lastError = (errors && errors[errors.length - 1]) || (lastWorkflow && lastWorkflow.error) || null;
    return {
      probableFailureArea: lastError ? (lastError.selectorName || lastError.workflowStep || lastError.code || "unknown") : "none",
      failedStep: lastWorkflow && lastWorkflow.failedStep ? lastWorkflow.failedStep : "",
      expected: lastError && lastError.expected ? lastError.expected : "",
      actual: lastError && lastError.actual ? lastError.actual : "",
      recommendedNextChecks: lastError && Array.isArray(lastError.nextChecks) ? lastError.nextChecks : [
        "Check that the content script is running on the expected domain.",
        "Check whether the stored selectors still match visible elements.",
        "Check the active page state and URL before re-running the workflow."
      ]
    };
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

    return {
      generatedAt: new Date().toISOString(),
      extension: {
        id: EXTENSION_CONFIG.extensionId,
        version: manifest.version,
        type: EXTENSION_CONFIG.extensionType
      },
      site: {
        siteId: siteConfig.siteId,
        baseUrl: siteConfig.baseUrl,
        urlPattern: siteConfig.urlPattern
      },
      activeProfile: activeProfile,
      lastWorkflow: lastWorkflow,
      events: events,
      selectorHealth: selectorHealth,
      pageStateHistory: pageStateHistory,
      errors: errors,
      gateway: {
        status: gatewayStatus,
        selectedFile: selectedGatewayFile
      },
      aiDebugSummary: buildAiDebugSummary(lastWorkflow, events, errors),
      extra: extra || {}
    };
  }

  NewSiteCore.DiagnosticStore = {
    recordSelectorHealth: recordSelectorHealth,
    recordPageState: recordPageState,
    recordError: recordError,
    setLastWorkflow: setLastWorkflow,
    exportDiagnostics: exportDiagnostics
  };
})(globalThis);
