(function initDiagnosticExporter(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const Contracts = NewSiteCore.ObservabilityContracts;
  const Redactor = NewSiteCore.DiagnosticRedactor;

  function getLastEntry(list) {
    return Array.isArray(list) && list.length ? list[list.length - 1] : null;
  }

  function inferFailureCategory(error, workflow) {
    const code = error && error.code ? error.code : "";
    const step = workflow && workflow.failedStep ? workflow.failedStep : "";
    if (/GATEWAY|FILE_SELECTION_CANCELLED|PYTHON_GATEWAY/.test(code)) {
      return "gateway_or_file_resolution";
    }
    if (/SEND_BUTTON|SEND_CLICK/.test(code) || step === "find_send_button" || step === "click_send") {
      return "selector_changed_or_disabled_button";
    }
    if (/CHAT_INPUT|FILE_INPUT/.test(code)) {
      return "selector_or_page_readiness";
    }
    if (/PROMPT/.test(code)) {
      return "input_validation";
    }
    return "workflow_execution";
  }

  function inferOwnerModule(error, workflow) {
    const category = inferFailureCategory(error, workflow);
    if (category === "gateway_or_file_resolution") {
      return "background-main.js";
    }
    if (category === "selector_changed_or_disabled_button" || category === "selector_or_page_readiness") {
      return "sites/deepseek/chatAutomator.js";
    }
    return "core/workflowRunner.js";
  }

  function inferNextAction(error, workflow) {
    const category = inferFailureCategory(error, workflow);
    if (category === "selector_changed_or_disabled_button") {
      return "Test and update selectors.sendButton in Site Profile Editor.";
    }
    if (category === "gateway_or_file_resolution") {
      return "Verify the local gateway is running and that a file can be selected.";
    }
    if (category === "selector_or_page_readiness") {
      return "Refresh DeepSeek, retest selectors, and confirm the composer is visible.";
    }
    return "Review the latest workflow timeline and the failed step evidence.";
  }

  function buildAiDebugSummary(lastWorkflow, errors, diagnosticSnapshot) {
    const lastError = getLastEntry(errors) || (lastWorkflow && lastWorkflow.error) || null;
    const lastRun = getLastEntry(diagnosticSnapshot.workflowRuns) || {};
    return Contracts.createAiDebugSummary({
      status: lastWorkflow && lastWorkflow.status ? lastWorkflow.status : "idle",
      probableFailureArea: lastError ? (lastError.selectorName || lastError.workflowStep || lastError.code || "unknown") : "none",
      failedStage: lastRun.failedStage || (lastError && lastError.failedStage) || "",
      failedStep: lastWorkflow && lastWorkflow.failedStep ? lastWorkflow.failedStep : "",
      expected: lastError && lastError.expected ? lastError.expected : "",
      actual: lastError && lastError.actual ? lastError.actual : "",
      probableOwnerModule: inferOwnerModule(lastError, lastWorkflow),
      probableRootCauseCategory: inferFailureCategory(lastError, lastWorkflow),
      confidence: lastError ? "medium" : "high",
      nextBestAction: inferNextAction(lastError, lastWorkflow),
      filesLikelyInvolved: inferOwnerModule(lastError, lastWorkflow) ? [inferOwnerModule(lastError, lastWorkflow)] : [],
      selectorLikelyInvolved: lastError && lastError.selectorName ? lastError.selectorName : "",
      gatewayLikelyInvolved: Boolean(lastError && /GATEWAY|PYTHON_GATEWAY/.test(lastError.code || "")),
      recommendedNextChecks: lastError && Array.isArray(lastError.nextChecks) && lastError.nextChecks.length
        ? lastError.nextChecks
        : [
          "Check the failed step in the workflow timeline.",
          "Test the DeepSeek selectors from Site Profile Editor.",
          "Re-run the workflow after refreshing the target tab."
        ],
      traceId: lastWorkflow && lastWorkflow.traceId ? lastWorkflow.traceId : "",
      workflowId: lastWorkflow && lastWorkflow.workflowId ? lastWorkflow.workflowId : ""
    });
  }

  function summarizeSelectedFile(gatewayStatus, selectedGatewayFile) {
    const selectedFile = selectedGatewayFile || (gatewayStatus && gatewayStatus.selectedFile) || null;
    if (!selectedFile) {
      return null;
    }
    return {
      name: selectedFile.name || "",
      extension: selectedFile.extension || "",
      sizeBytes: selectedFile.sizeBytes || 0
    };
  }

  function exportDiagnostics(options) {
    const manifest = options.manifest;
    const activeProfile = options.activeProfile;
    const siteConfig = options.siteConfig;
    const events = Array.isArray(options.events) ? options.events : [];
    const lastWorkflow = options.lastWorkflow || null;
    const selectorHealth = Array.isArray(options.selectorHealth) ? options.selectorHealth : [];
    const pageStateHistory = Array.isArray(options.pageStateHistory) ? options.pageStateHistory : [];
    const errors = Array.isArray(options.errors) ? options.errors : [];
    const gatewayStatus = options.gatewayStatus || null;
    const selectedGatewayFile = options.selectedGatewayFile || null;
    const runtimeStatus = options.runtimeStatus || null;
    const diagnosticSnapshot = options.diagnosticSnapshot || Contracts.createDiagnosticSnapshot();

    const rawPackage = {
      generatedAt: new Date().toISOString(),
      summaryVersion: 1,
      aiDebugSummary: buildAiDebugSummary(lastWorkflow, errors, diagnosticSnapshot),
      environment: {
        extensionVersion: manifest.version,
        manifestVersion: manifest.manifest_version,
        browser: "chrome-compatible",
        generatedFrom: "extension-sidepanel"
      },
      runtime: {
        activeTabUrl: runtimeStatus && runtimeStatus.activeTabUrl ? runtimeStatus.activeTabUrl : "",
        currentSite: siteConfig.siteId,
        contentScriptAvailable: Boolean(getLastEntry(diagnosticSnapshot.contentScriptHealth) && getLastEntry(diagnosticSnapshot.contentScriptHealth).available)
      },
      gateway: {
        state: gatewayStatus && gatewayStatus.state ? gatewayStatus.state : "unknown",
        selectedFile: summarizeSelectedFile(gatewayStatus, selectedGatewayFile)
      },
      siteProfile: {
        siteId: activeProfile.siteId,
        version: activeProfile.version,
        selectors: activeProfile.selectors,
        timing: activeProfile.timing
      },
      workflow: {
        timeline: lastWorkflow && lastWorkflow.timeline ? lastWorkflow.timeline : [],
        steps: diagnosticSnapshot.stepEvidence,
        lastWorkflow: lastWorkflow
      },
      selectorHealth: selectorHealth,
      pageStateHistory: pageStateHistory,
      errors: errors,
      telemetryEvents: events,
      evidence: {
        composerSnapshot: getLastEntry(diagnosticSnapshot.runtimeSnapshots),
        visibleButtonsNearComposer: getLastEntry(diagnosticSnapshot.sendButtonEvidence)
          ? getLastEntry(diagnosticSnapshot.sendButtonEvidence).visibleButtonsNearComposer || []
          : [],
        uploadSnapshot: getLastEntry(diagnosticSnapshot.runtimeSnapshots),
        sendButtonSnapshot: getLastEntry(diagnosticSnapshot.sendButtonEvidence) || null,
        expectedVsActualByStep: diagnosticSnapshot.stepEvidence.map(function mapStep(step) {
          return {
            stepName: step.stepName,
            expected: step.expected,
            actual: step.actual,
            status: step.status
          };
        })
      }
    };

    const sanitized = Redactor.sanitizeDiagnosticPackage(rawPackage);
    sanitized.diagnostics.redactions = sanitized.redactions;
    return sanitized.diagnostics;
  }

  NewSiteCore.DiagnosticExporter = {
    exportDiagnostics: exportDiagnostics
  };
})(globalThis);
