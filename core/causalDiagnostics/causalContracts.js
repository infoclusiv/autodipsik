(function initCausalContracts(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  const VALID_VERDICT_STATUSES = ["exact", "insufficient_evidence", "incomplete", "unknown", "success"];
  const VALID_WORKFLOW_RUN_KINDS = ["dry_run", "actual", "unknown"];
  const VALID_WORKFLOW_STATUSES = ["running", "completed", "failed", "incomplete", "unknown"];
  const VALID_CONFIDENCE = ["low", "medium", "high"];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function pickEnum(value, allowed, fallback) {
    return allowed.indexOf(value) >= 0 ? value : fallback;
  }

  function createCausalVerdict(input) {
    const source = input || {};
    return {
      status: pickEnum(source.status, VALID_VERDICT_STATUSES, "unknown"),
      causalCode: source.causalCode || "",
      exactKnownCause: source.exactKnownCause || "",
      primaryWorkflowId: source.primaryWorkflowId || "",
      primaryWorkflowName: source.primaryWorkflowName || "",
      blockedAt: source.blockedAt || "",
      blockingCondition: source.blockingCondition || "",
      evidence: source.evidence && typeof source.evidence === "object" ? clone(source.evidence) : {},
      missingEvidence: Array.isArray(source.missingEvidence) ? source.missingEvidence.slice() : [],
      ruledOutCauses: Array.isArray(source.ruledOutCauses) ? source.ruledOutCauses.slice() : [],
      ownerModule: source.ownerModule || "",
      confidence: pickEnum(source.confidence, VALID_CONFIDENCE, "low"),
      nextRequiredInstrumentation: Array.isArray(source.nextRequiredInstrumentation) ? source.nextRequiredInstrumentation.slice() : [],
      nextBestAction: source.nextBestAction || ""
    };
  }

  function createCausalEvidence(input) {
    const source = input || {};
    return {
      traceId: source.traceId || "",
      workflowId: source.workflowId || "",
      workflowName: source.workflowName || "",
      runKind: pickEnum(source.runKind, VALID_WORKFLOW_RUN_KINDS, "unknown"),
      gateName: source.gateName || "",
      stepName: source.stepName || "",
      stage: source.stage || "",
      status: source.status || "observed",
      attempt: typeof source.attempt === "number" ? source.attempt : 0,
      elapsedMs: typeof source.elapsedMs === "number" ? source.elapsedMs : 0,
      blockingCondition: source.blockingCondition || "",
      snapshot: source.snapshot || null,
      timestamp: source.timestamp || new Date().toISOString()
    };
  }

  function createMissingEvidenceReport(input) {
    const source = input || {};
    return {
      causalCode: source.causalCode || "INSUFFICIENT_CAUSAL_EVIDENCE",
      summary: source.summary || "",
      missingEvidence: Array.isArray(source.missingEvidence) ? source.missingEvidence.slice() : [],
      nextRequiredInstrumentation: Array.isArray(source.nextRequiredInstrumentation) ? source.nextRequiredInstrumentation.slice() : [],
      nextBestAction: source.nextBestAction || ""
    };
  }

  function createWorkflowClassification(input) {
    const source = input || {};
    return {
      workflowId: source.workflowId || "",
      workflowName: source.workflowName || "",
      traceId: source.traceId || "",
      runKind: pickEnum(source.runKind, VALID_WORKFLOW_RUN_KINDS, "unknown"),
      status: pickEnum(source.status, VALID_WORKFLOW_STATUSES, "unknown"),
      startedAt: source.startedAt || "",
      lastUpdatedAt: source.lastUpdatedAt || source.startedAt || "",
      lastCompletedStep: source.lastCompletedStep || "",
      currentStep: source.currentStep || "",
      nextExpectedStep: source.nextExpectedStep || "",
      terminal: typeof source.terminal === "boolean" ? source.terminal : false,
      failedStep: source.failedStep || "",
      failedStage: source.failedStage || "",
      timeline: Array.isArray(source.timeline) ? clone(source.timeline) : []
    };
  }

  NewSiteCore.CausalContracts = {
    createCausalVerdict: createCausalVerdict,
    createCausalEvidence: createCausalEvidence,
    createMissingEvidenceReport: createMissingEvidenceReport,
    createWorkflowClassification: createWorkflowClassification,
    clone: clone
  };
})(globalThis);
