(function initWorkflowStateTracker(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const CausalContracts = NewSiteCore.CausalContracts;

  const KNOWN_STEP_ORDER = [
    "validate_input",
    "wait_for_page_ready",
    "attach_file",
    "wait_for_attachment_ready",
    "insert_prompt",
    "wait_for_composer_ready_to_send",
    "click_send",
    "verify_submit_effect",
    "finalize"
  ];

  function inferRunKind(workflowName) {
    const value = String(workflowName || "");
    if (/dry_run/i.test(value)) {
      return "dry_run";
    }
    if (/excel_chat|actual|automation/i.test(value)) {
      return "actual";
    }
    return "unknown";
  }

  function findStepIndex(stepName, knownStepOrder) {
    const order = Array.isArray(knownStepOrder) && knownStepOrder.length ? knownStepOrder : KNOWN_STEP_ORDER;
    return order.indexOf(stepName);
  }

  function inferNextExpectedStep(stepName, knownStepOrder) {
    const order = Array.isArray(knownStepOrder) && knownStepOrder.length ? knownStepOrder : KNOWN_STEP_ORDER;
    const index = findStepIndex(stepName, order);
    return index >= 0 && index + 1 < order.length ? order[index + 1] : "";
  }

  function createWorkflowRunState(input) {
    const source = input || {};
    return CausalContracts.createWorkflowClassification({
      workflowId: source.workflowId,
      workflowName: source.workflowName,
      traceId: source.traceId,
      runKind: source.runKind || inferRunKind(source.workflowName),
      status: source.status || "unknown",
      startedAt: source.startedAt,
      lastUpdatedAt: source.lastUpdatedAt,
      lastCompletedStep: source.lastCompletedStep,
      currentStep: source.currentStep,
      nextExpectedStep: source.nextExpectedStep,
      terminal: source.terminal,
      failedStep: source.failedStep,
      failedStage: source.failedStage,
      timeline: source.timeline
    });
  }

  function updateWorkflowRunState(existing, patch) {
    return createWorkflowRunState(Object.assign({}, existing || {}, patch || {}));
  }

  function recordWorkflowStarted(input) {
    const now = input && input.startedAt ? input.startedAt : new Date().toISOString();
    return createWorkflowRunState({
      workflowId: input.workflowId,
      workflowName: input.workflowName,
      traceId: input.traceId,
      runKind: input.runKind || inferRunKind(input.workflowName),
      status: "running",
      startedAt: now,
      lastUpdatedAt: now,
      nextExpectedStep: input.nextExpectedStep || "",
      terminal: false,
      timeline: input.timeline || []
    });
  }

  function recordWorkflowStepStarted(existing, input) {
    return updateWorkflowRunState(existing, {
      currentStep: input.stepName || "",
      nextExpectedStep: input.nextExpectedStep || "",
      status: existing && existing.status === "failed" ? "failed" : "running",
      lastUpdatedAt: input.lastUpdatedAt || new Date().toISOString(),
      terminal: false
    });
  }

  function recordWorkflowStepCompleted(existing, input) {
    return updateWorkflowRunState(existing, {
      lastCompletedStep: input.stepName || "",
      currentStep: input.stepName || "",
      nextExpectedStep: input.nextExpectedStep || inferNextExpectedStep(input.stepName, input.knownStepOrder),
      status: "running",
      lastUpdatedAt: input.lastUpdatedAt || new Date().toISOString(),
      terminal: false
    });
  }

  function recordWorkflowStepFailed(existing, input) {
    return updateWorkflowRunState(existing, {
      status: "failed",
      currentStep: input.stepName || "",
      failedStep: input.stepName || "",
      failedStage: input.failedStage || "",
      nextExpectedStep: input.nextExpectedStep || "",
      lastUpdatedAt: input.lastUpdatedAt || new Date().toISOString(),
      terminal: true
    });
  }

  function recordWorkflowCompleted(existing, input) {
    return updateWorkflowRunState(existing, {
      status: "completed",
      currentStep: input.currentStep || existing.currentStep || "",
      nextExpectedStep: "",
      lastUpdatedAt: input.lastUpdatedAt || new Date().toISOString(),
      terminal: true
    });
  }

  function sortWorkflowRuns(workflowRuns) {
    return (Array.isArray(workflowRuns) ? workflowRuns.slice() : []).sort(function sortRuns(left, right) {
      const leftTime = Date.parse(left && (left.lastUpdatedAt || left.startedAt) || "") || 0;
      const rightTime = Date.parse(right && (right.lastUpdatedAt || right.startedAt) || "") || 0;
      return leftTime - rightTime;
    });
  }

  function getLatestMatching(workflowRuns, predicate) {
    const ordered = sortWorkflowRuns(workflowRuns);
    for (let index = ordered.length - 1; index >= 0; index -= 1) {
      if (predicate(ordered[index])) {
        return ordered[index];
      }
    }
    return null;
  }

  function classifyWorkflowRuns(input) {
    const workflowRuns = Array.isArray(input && input.workflowRuns) ? input.workflowRuns : [];
    const traceId = input && input.traceId ? input.traceId : "";
    const scopedRuns = traceId
      ? workflowRuns.filter(function filterByTrace(run) {
        return run && run.traceId === traceId;
      })
      : workflowRuns.slice();
    const latestDryRunWorkflow = getLatestMatching(scopedRuns, function isDryRun(run) {
      return run && run.runKind === "dry_run";
    });
    const latestActualWorkflow = getLatestMatching(scopedRuns, function isActual(run) {
      return run && run.runKind === "actual";
    });
    const activeOrIncompleteWorkflow = getLatestMatching(scopedRuns, function isActive(run) {
      return run && (run.status === "running" || run.status === "incomplete" || run.status === "failed");
    });
    const primaryWorkflowForCausalAnalysis = latestActualWorkflow || activeOrIncompleteWorkflow || latestDryRunWorkflow || getLatestMatching(scopedRuns, function any(run) {
      return Boolean(run);
    });

    return {
      latestDryRunWorkflow: latestDryRunWorkflow,
      latestActualWorkflow: latestActualWorkflow,
      activeOrIncompleteWorkflow: activeOrIncompleteWorkflow,
      primaryWorkflowForCausalAnalysis: primaryWorkflowForCausalAnalysis
    };
  }

  NewSiteCore.WorkflowStateTracker = {
    KNOWN_STEP_ORDER: KNOWN_STEP_ORDER.slice(),
    inferRunKind: inferRunKind,
    inferNextExpectedStep: inferNextExpectedStep,
    createWorkflowRunState: createWorkflowRunState,
    updateWorkflowRunState: updateWorkflowRunState,
    recordWorkflowStarted: recordWorkflowStarted,
    recordWorkflowStepStarted: recordWorkflowStepStarted,
    recordWorkflowStepCompleted: recordWorkflowStepCompleted,
    recordWorkflowStepFailed: recordWorkflowStepFailed,
    recordWorkflowCompleted: recordWorkflowCompleted,
    classifyWorkflowRuns: classifyWorkflowRuns
  };
})(globalThis);
