(function initObservabilityContracts(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function buildStructuredError(input) {
    const source = input || {};
    return {
      code: source.code || "UNKNOWN_ERROR",
      message: source.message || "Unexpected error",
      expected: source.expected || "",
      actual: source.actual || "",
      recoverable: typeof source.recoverable === "boolean" ? source.recoverable : true,
      suggestedFix: source.suggestedFix || "",
      probableCause: source.probableCause || "",
      selectorName: source.selectorName || "",
      selector: source.selector || "",
      traceId: source.traceId || "",
      workflowId: source.workflowId || "",
      failedStage: source.failedStage || "",
      workflowStep: source.workflowStep || "",
      activeTabUrl: source.activeTabUrl || source.url || "",
      pageState: source.pageState || null,
      pageSummary: source.pageSummary || null,
      nextChecks: Array.isArray(source.nextChecks) ? source.nextChecks.slice() : []
    };
  }

  function createDiagnosticSnapshot() {
    return {
      workflowRuns: [],
      stepEvidence: [],
      runtimeSnapshots: [],
      gatewaySnapshots: [],
      contentScriptHealth: [],
      sendButtonEvidence: [],
      pageStateHistory: [],
      selectorHealth: []
    };
  }

  function createStepEvidence(input) {
    const source = input || {};
    return {
      traceId: source.traceId || "",
      workflowId: source.workflowId || "",
      stage: source.stage || "",
      stepName: source.stepName || "",
      status: source.status || "unknown",
      expected: source.expected || "",
      actual: source.actual || "",
      selectorName: source.selectorName || "",
      selectorValue: source.selectorValue || "",
      foundBy: source.foundBy || "",
      elapsedMs: typeof source.elapsedMs === "number" ? source.elapsedMs : 0,
      retryCount: typeof source.retryCount === "number" ? source.retryCount : 0,
      snapshot: source.snapshot || null,
      timestamp: source.timestamp || new Date().toISOString()
    };
  }

  function createAiDebugSummary(input) {
    const source = input || {};
    return {
      status: source.status || "unknown",
      probableFailureArea: source.probableFailureArea || "unknown",
      failedStage: source.failedStage || "",
      failedStep: source.failedStep || "",
      expected: source.expected || "",
      actual: source.actual || "",
      probableOwnerModule: source.probableOwnerModule || "",
      probableRootCauseCategory: source.probableRootCauseCategory || "",
      confidence: source.confidence || "low",
      nextBestAction: source.nextBestAction || "",
      filesLikelyInvolved: Array.isArray(source.filesLikelyInvolved) ? source.filesLikelyInvolved.slice() : [],
      selectorLikelyInvolved: source.selectorLikelyInvolved || "",
      gatewayLikelyInvolved: Boolean(source.gatewayLikelyInvolved),
      recommendedNextChecks: Array.isArray(source.recommendedNextChecks) ? source.recommendedNextChecks.slice() : [],
      traceId: source.traceId || "",
      workflowId: source.workflowId || ""
    };
  }

  NewSiteCore.ObservabilityContracts = {
    buildStructuredError: buildStructuredError,
    createDiagnosticSnapshot: createDiagnosticSnapshot,
    createStepEvidence: createStepEvidence,
    createAiDebugSummary: createAiDebugSummary,
    clone: clone
  };
})(globalThis);
