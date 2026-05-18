(function initDiagnosticExporter(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const Contracts = NewSiteCore.ObservabilityContracts;
  const WorkflowStateTracker = NewSiteCore.WorkflowStateTracker;
  const CausalDecisionTree = NewSiteCore.CausalDecisionTree;
  const Redactor = NewSiteCore.DiagnosticRedactor;

  function getLastEntry(list) {
    return Array.isArray(list) && list.length ? list[list.length - 1] : null;
  }

  function findLatestStepEvidence(stepEvidence, stepName) {
    if (!Array.isArray(stepEvidence)) {
      return null;
    }
    for (let index = stepEvidence.length - 1; index >= 0; index -= 1) {
      if (stepEvidence[index] && stepEvidence[index].stepName === stepName) {
        return stepEvidence[index];
      }
    }
    return null;
  }

  function inferFailureArea(error, workflow, readinessSummary) {
    const code = error && error.code ? error.code : "";
    const failedStep = workflow && workflow.failedStep ? workflow.failedStep : "";

    if (code === "FILE_ATTACHMENT_NOT_READY" || failedStep === "wait_for_attachment_ready") {
      return "attachment_readiness";
    }
    if (code === "COMPOSER_NOT_READY_TO_SEND" || failedStep === "wait_for_composer_ready_to_send") {
      if (readinessSummary && readinessSummary.failedCondition) {
        return readinessSummary.failedCondition;
      }
      return "composer_readiness";
    }
    if (/SEND_BUTTON|SEND_CLICK/.test(code) || failedStep === "click_send") {
      return "send_button_readiness";
    }
    if (/PROMPT/.test(code)) {
      return "prompt_readiness";
    }
    return error ? (error.selectorName || error.workflowStep || error.code || "unknown") : "none";
  }

  function inferFailureCategory(error, workflow) {
    const code = error && error.code ? error.code : "";
    const step = workflow && workflow.failedStep ? workflow.failedStep : "";
    if (/GATEWAY|FILE_SELECTION_CANCELLED|PYTHON_GATEWAY/.test(code)) {
      return "gateway_or_file_resolution";
    }
    if (code === "FILE_ATTACHMENT_NOT_READY" || step === "wait_for_attachment_ready") {
      return "attachment_readiness";
    }
    if (code === "COMPOSER_NOT_READY_TO_SEND" || step === "wait_for_composer_ready_to_send") {
      return "composer_readiness";
    }
    if (/SEND_BUTTON|SEND_CLICK|COMPOSER_NOT_READY_TO_SEND/.test(code) || step === "find_send_button" || step === "wait_for_composer_ready_to_send" || step === "click_send") {
      return "selector_changed_or_disabled_button";
    }
    if (/CHAT_INPUT|FILE_INPUT|FILE_ATTACHMENT_NOT_READY/.test(code)) {
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
    if (category === "attachment_readiness") {
      return "Verify the attachment card shows the selected Excel file near the composer and that upload progress has fully cleared.";
    }
    if (category === "composer_readiness") {
      return "Confirm attachment readiness, prompt presence, and send-button enabled state in the same composer state before clicking send.";
    }
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

  function summarizeAttachmentReadiness(snapshot) {
    if (!snapshot) {
      return null;
    }
    return {
      attachmentReady: Boolean(snapshot.attachmentReady || (
        snapshot.attachmentVisible
        && snapshot.matchedByFileName
        && snapshot.matchedByExtension
        && snapshot.nearComposer
        && !snapshot.uploadProgressVisible
      )),
      fileNameExpected: snapshot.fileNameExpected || "",
      matchedText: snapshot.matchedText || "",
      matchedByFileName: Boolean(snapshot.matchedByFileName),
      matchedByExtension: Boolean(snapshot.matchedByExtension),
      attachmentVisible: Boolean(snapshot.attachmentVisible),
      nearComposer: Boolean(snapshot.nearComposer),
      uploadProgressVisible: Boolean(snapshot.uploadProgressVisible),
      stableDetections: typeof snapshot.stableDetections === "number" ? snapshot.stableDetections : 0,
      stableDurationMs: typeof snapshot.stableDurationMs === "number" ? snapshot.stableDurationMs : 0,
      readinessFailures: Array.isArray(snapshot.readinessFailures) ? snapshot.readinessFailures.slice() : [],
      attachmentElementSummary: snapshot.attachmentElementSummary || null,
      selectorName: snapshot.selectorName || "fileAttachedIndicator",
      selectorValue: snapshot.selectorValue || ""
    };
  }

  function summarizeComposerReadyToSend(snapshot) {
    if (!snapshot) {
      return null;
    }
    return {
      ready: Boolean(snapshot.ready),
      attachmentReady: Boolean(snapshot.attachmentReady),
      promptReady: Boolean(snapshot.promptReady),
      sendButtonReady: Boolean(snapshot.sendButtonReady),
      promptValueLength: typeof snapshot.promptValueLength === "number" ? snapshot.promptValueLength : 0,
      expectedPromptLength: typeof snapshot.expectedPromptLength === "number" ? snapshot.expectedPromptLength : 0,
      uploadProgressVisible: Boolean(snapshot.uploadProgressVisible),
      attempts: typeof snapshot.attempts === "number" ? snapshot.attempts : 0,
      elapsedMs: typeof snapshot.elapsedMs === "number" ? snapshot.elapsedMs : 0,
      readinessFailures: Array.isArray(snapshot.readinessFailures) ? snapshot.readinessFailures.slice() : [],
      attachmentEvidence: snapshot.attachmentEvidence || null,
      promptEvidence: snapshot.promptEvidence || null,
      sendButtonEvidence: snapshot.sendButtonEvidence || null
    };
  }

  function inferFailedReadinessCondition(lastWorkflow, attachmentSnapshot, composerSnapshot) {
    const failedStep = lastWorkflow && lastWorkflow.failedStep ? lastWorkflow.failedStep : "";
    if (failedStep === "wait_for_attachment_ready" || (attachmentSnapshot && attachmentSnapshot.attachmentReady === false)) {
      return "attachment_readiness";
    }
    if (failedStep === "wait_for_composer_ready_to_send" || composerSnapshot) {
      if (composerSnapshot && !composerSnapshot.attachmentReady) {
        return "attachment_readiness";
      }
      if (composerSnapshot && !composerSnapshot.promptReady) {
        return "prompt_readiness";
      }
      if (composerSnapshot && !composerSnapshot.sendButtonReady) {
        return "send_button_readiness";
      }
      if (failedStep === "wait_for_composer_ready_to_send") {
        return "composer_readiness";
      }
    }
    return "";
  }

  function inferInvolvedArea(lastWorkflow, attachmentSnapshot, composerSnapshot, lastError) {
    const failedCondition = inferFailedReadinessCondition(lastWorkflow, attachmentSnapshot, composerSnapshot);
    if (failedCondition === "attachment_readiness") {
      return "composer_attachment_area";
    }
    if (failedCondition === "prompt_readiness") {
      return "composer_input";
    }
    if (failedCondition === "send_button_readiness") {
      return "composer_send_button";
    }
    return lastError && lastError.selectorName ? lastError.selectorName : "";
  }

  function buildReadinessSummary(lastWorkflow, diagnosticSnapshot) {
    const workflowSelection = WorkflowStateTracker.classifyWorkflowRuns({
      workflowRuns: diagnosticSnapshot.workflowRuns,
      traceId: lastWorkflow && lastWorkflow.traceId ? lastWorkflow.traceId : ""
    });
    const workflowId = workflowSelection.primaryWorkflowForCausalAnalysis && workflowSelection.primaryWorkflowForCausalAnalysis.workflowId
      ? workflowSelection.primaryWorkflowForCausalAnalysis.workflowId
      : "";
    const attachmentStep = findLatestStepEvidence(diagnosticSnapshot.stepEvidence, "wait_for_attachment_ready");
    const composerStep = findLatestStepEvidence(diagnosticSnapshot.stepEvidence, "wait_for_composer_ready_to_send");
    const latestAttachmentGate = workflowId && Array.isArray(diagnosticSnapshot.gateSnapshots)
      ? diagnosticSnapshot.gateSnapshots.filter(function onlyGate(entry) {
        return entry && entry.workflowId === workflowId && entry.gateName === "wait_for_attachment_ready";
      }).slice(-1)[0] || null
      : null;
    const latestComposerGate = workflowId && Array.isArray(diagnosticSnapshot.gateSnapshots)
      ? diagnosticSnapshot.gateSnapshots.filter(function onlyGate(entry) {
        return entry && entry.workflowId === workflowId && entry.gateName === "wait_for_composer_ready_to_send";
      }).slice(-1)[0] || null
      : null;
    const attachmentSnapshot = summarizeAttachmentReadiness((latestAttachmentGate && latestAttachmentGate.snapshot) || (attachmentStep && attachmentStep.snapshot));
    const composerSnapshot = summarizeComposerReadyToSend((latestComposerGate && latestComposerGate.snapshot) || (composerStep && composerStep.snapshot));
    const failedCondition = inferFailedReadinessCondition(lastWorkflow, attachmentSnapshot, composerSnapshot);

    return {
      attachmentStep: attachmentStep,
      composerStep: composerStep,
      latestAttachmentReadinessSnapshot: attachmentSnapshot,
      latestComposerReadyToSendSnapshot: composerSnapshot,
      failedCondition: failedCondition
    };
  }

  function buildAiDebugSummary(lastWorkflow, errors, diagnosticSnapshot) {
    const lastError = getLastEntry(errors) || (lastWorkflow && lastWorkflow.error) || null;
    const workflowSelection = WorkflowStateTracker.classifyWorkflowRuns({
      workflowRuns: diagnosticSnapshot.workflowRuns,
      traceId: lastWorkflow && lastWorkflow.traceId ? lastWorkflow.traceId : ""
    });
    const lastRun = workflowSelection.primaryWorkflowForCausalAnalysis || getLastEntry(diagnosticSnapshot.workflowRuns) || {};
    const readinessSummary = buildReadinessSummary(lastWorkflow, diagnosticSnapshot);
    return Contracts.createAiDebugSummary({
      status: lastWorkflow && lastWorkflow.status ? lastWorkflow.status : "idle",
      probableFailureArea: inferFailureArea(lastError, lastWorkflow, readinessSummary),
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
      workflowId: lastWorkflow && lastWorkflow.workflowId ? lastWorkflow.workflowId : "",
      legacy: true,
      source: "legacy-aiDebugSummary"
    });
  }

  function createCausalReportMarkdown(diagnostics) {
    const causalReport = diagnostics && diagnostics.causalReport ? diagnostics.causalReport : {};
    const evidence = causalReport.evidence || {};
    const lines = [
      "# Causal Report",
      "",
      "## Verdict",
      String(causalReport.status || "unknown").toUpperCase(),
      "",
      "## Causal Code",
      causalReport.causalCode || "UNKNOWN",
      "",
      "## Primary Workflow",
      causalReport.primaryWorkflowName || causalReport.primaryWorkflowId || "Unknown",
      "",
      "## Blocked At",
      causalReport.blockedAt || "None",
      "",
      "## Evidence",
      "- blockingCondition: " + (causalReport.blockingCondition || "none"),
      "- ownerModule: " + (causalReport.ownerModule || "unknown"),
      "- attachmentReady: " + String(Boolean(evidence.latestComposerGate && evidence.latestComposerGate.attachmentReady)),
      "- promptReady: " + String(Boolean(evidence.latestComposerGate && evidence.latestComposerGate.promptReady)),
      "- sendButtonCandidateFound: " + String(Boolean(evidence.latestComposerGate && evidence.latestComposerGate.sendButtonEvidence && evidence.latestComposerGate.sendButtonEvidence.sendButtonCandidateFound)),
      "- sendButtonReady: " + String(Boolean(evidence.latestComposerGate && evidence.latestComposerGate.sendButtonReady)),
      "- disabledReason: " + (((evidence.latestComposerGate && evidence.latestComposerGate.sendButtonEvidence && evidence.latestComposerGate.sendButtonEvidence.disabledReason) || "none")),
      "- clickSendExecuted: " + String(Boolean(evidence.clickSendStep && evidence.clickSendStep.status === "completed")),
      "",
      "## Missing Evidence",
      (Array.isArray(causalReport.missingEvidence) && causalReport.missingEvidence.length
        ? causalReport.missingEvidence.map(function mapEvidence(item) {
          return "- " + item;
        }).join("\n")
        : "- none"),
      "",
      "## Exact Cause",
      causalReport.exactKnownCause || "None",
      "",
      "## Next Best Action",
      causalReport.nextBestAction || "None"
    ];
    return lines.join("\n");
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
    const readinessSummary = buildReadinessSummary(lastWorkflow, diagnosticSnapshot);
    const lastError = getLastEntry(errors) || (lastWorkflow && lastWorkflow.error) || null;
    const workflowSelection = WorkflowStateTracker.classifyWorkflowRuns({
      workflowRuns: diagnosticSnapshot.workflowRuns,
      traceId: lastWorkflow && lastWorkflow.traceId ? lastWorkflow.traceId : ""
    });
    const causalReport = CausalDecisionTree.analyzeWorkflowCausality({
      lastWorkflow: lastWorkflow,
      diagnosticSnapshot: diagnosticSnapshot,
      errors: errors
    });

    const rawPackage = {
      generatedAt: new Date().toISOString(),
      summaryVersion: 1,
      aiDebugSummary: buildAiDebugSummary(lastWorkflow, errors, diagnosticSnapshot),
      causalReport: causalReport,
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
        timing: activeProfile.timing,
        behavior: activeProfile.behavior
      },
      workflow: {
        latestDryRunWorkflow: workflowSelection.latestDryRunWorkflow,
        latestActualWorkflow: workflowSelection.latestActualWorkflow,
        activeOrIncompleteWorkflow: workflowSelection.activeOrIncompleteWorkflow,
        primaryWorkflowForCausalAnalysis: workflowSelection.primaryWorkflowForCausalAnalysis,
        timeline: lastWorkflow && lastWorkflow.timeline ? lastWorkflow.timeline : [],
        steps: diagnosticSnapshot.stepEvidence,
        lastWorkflow: lastWorkflow
      },
      selectorHealth: selectorHealth,
      pageStateHistory: pageStateHistory,
      errors: errors,
      telemetryEvents: events,
      readiness: {
        latestAttachmentReadinessSnapshot: readinessSummary.latestAttachmentReadinessSnapshot,
        latestComposerReadyToSendSnapshot: readinessSummary.latestComposerReadyToSendSnapshot,
        failedCondition: readinessSummary.failedCondition,
        involvedArea: inferInvolvedArea(lastWorkflow, readinessSummary.latestAttachmentReadinessSnapshot, readinessSummary.latestComposerReadyToSendSnapshot, lastError),
        failedStage: lastWorkflow && lastWorkflow.failedStage ? lastWorkflow.failedStage : "",
        failedStep: lastWorkflow && lastWorkflow.failedStep ? lastWorkflow.failedStep : "",
        errorCode: lastError && lastError.code ? lastError.code : "",
        likelyOwnerModule: inferOwnerModule(lastError, lastWorkflow),
        recommendedNextChecks: lastError && Array.isArray(lastError.nextChecks) && lastError.nextChecks.length
          ? lastError.nextChecks
          : [],
        knownReadinessGates: [
          "wait_for_attachment_ready",
          "wait_for_composer_ready_to_send"
        ]
      },
      evidence: {
        composerSnapshot: getLastEntry(diagnosticSnapshot.runtimeSnapshots),
        visibleButtonsNearComposer: getLastEntry(diagnosticSnapshot.sendButtonEvidence)
          ? getLastEntry(diagnosticSnapshot.sendButtonEvidence).visibleButtonsNearComposer || []
          : [],
        uploadSnapshot: getLastEntry(diagnosticSnapshot.runtimeSnapshots),
        sendButtonSnapshot: getLastEntry(diagnosticSnapshot.sendButtonEvidence) || null,
        attachmentReadinessStep: readinessSummary.attachmentStep,
        composerReadyToSendStep: readinessSummary.composerStep,
        expectedVsActualByStep: diagnosticSnapshot.stepEvidence.map(function mapStep(step) {
          return {
            stepName: step.stepName,
            expected: step.expected,
            actual: step.actual,
            status: step.status
          };
        })
      },
      causalReportMarkdown: createCausalReportMarkdown({ causalReport: causalReport })
    };

    const sanitized = Redactor.sanitizeDiagnosticPackage(rawPackage);
    sanitized.diagnostics.redactions = sanitized.redactions;
    return sanitized.diagnostics;
  }

  NewSiteCore.DiagnosticExporter = {
    exportDiagnostics: exportDiagnostics,
    createCausalReportMarkdown: createCausalReportMarkdown
  };
})(globalThis);
