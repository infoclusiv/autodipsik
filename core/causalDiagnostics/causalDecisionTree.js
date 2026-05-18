(function initCausalDecisionTree(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const CausalContracts = NewSiteCore.CausalContracts;
  const WorkflowStateTracker = NewSiteCore.WorkflowStateTracker;

  function getLastEntry(list) {
    return Array.isArray(list) && list.length ? list[list.length - 1] : null;
  }

  function pickLatestByWorkflow(entries, workflowId, predicate) {
    if (!Array.isArray(entries)) {
      return null;
    }
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (!entry || entry.workflowId !== workflowId) {
        continue;
      }
      if (!predicate || predicate(entry)) {
        return entry;
      }
    }
    return null;
  }

  function getLatestGateSnapshot(gateSnapshots, workflowId, gateName) {
    return pickLatestByWorkflow(gateSnapshots, workflowId, function matchesGate(entry) {
      return entry.gateName === gateName;
    });
  }

  function getLatestStepEvidence(stepEvidence, workflowId, stepName) {
    return pickLatestByWorkflow(stepEvidence, workflowId, function matchesStep(entry) {
      return entry.stepName === stepName;
    });
  }

  function buildMissingEvidenceVerdict(base, missingEvidence) {
    return CausalContracts.createCausalVerdict(Object.assign({}, base, {
      status: "insufficient_evidence",
      causalCode: "INSUFFICIENT_CAUSAL_EVIDENCE",
      exactKnownCause: "",
      missingEvidence: missingEvidence,
      nextRequiredInstrumentation: missingEvidence.slice(),
      nextBestAction: base.nextBestAction || "Capture the missing causal snapshot before inferring a browser-side cause."
    }));
  }

  function buildEvidenceSummary(workflow, gateSnapshots, stepEvidence) {
    const workflowId = workflow && workflow.workflowId ? workflow.workflowId : "";
    const attachmentGate = getLatestGateSnapshot(gateSnapshots, workflowId, "wait_for_attachment_ready");
    const composerGate = getLatestGateSnapshot(gateSnapshots, workflowId, "wait_for_composer_ready_to_send");
    const submitGate = getLatestGateSnapshot(gateSnapshots, workflowId, "verify_submit_effect");
    const clickStep = getLatestStepEvidence(stepEvidence, workflowId, "click_send");

    return {
      attachmentGate: attachmentGate,
      composerGate: composerGate,
      submitGate: submitGate,
      clickStep: clickStep
    };
  }

  function analyzeWorkflowCausality(input) {
    const diagnosticSnapshot = input && input.diagnosticSnapshot ? input.diagnosticSnapshot : {};
    const workflowRuns = Array.isArray(diagnosticSnapshot.workflowRuns) ? diagnosticSnapshot.workflowRuns : [];
    const stepEvidence = Array.isArray(diagnosticSnapshot.stepEvidence) ? diagnosticSnapshot.stepEvidence : [];
    const gateSnapshots = Array.isArray(diagnosticSnapshot.gateSnapshots) ? diagnosticSnapshot.gateSnapshots : [];
    const lastWorkflow = input && input.lastWorkflow ? input.lastWorkflow : null;
    const workflowSelection = WorkflowStateTracker.classifyWorkflowRuns({
      workflowRuns: workflowRuns,
      traceId: lastWorkflow && lastWorkflow.traceId ? lastWorkflow.traceId : ""
    });
    const primaryWorkflow = workflowSelection.primaryWorkflowForCausalAnalysis;

    if (!primaryWorkflow) {
      return buildMissingEvidenceVerdict({
        ownerModule: "core/causalDiagnostics/causalDecisionTree.js",
        nextBestAction: "Run the actual DeepSeek workflow and export diagnostics again."
      }, ["workflowRuns"]);
    }

    const workflowId = primaryWorkflow.workflowId;
    const workflowName = primaryWorkflow.workflowName;
    const evidenceSummary = buildEvidenceSummary(primaryWorkflow, gateSnapshots, stepEvidence);
    const composerSnapshot = evidenceSummary.composerGate && evidenceSummary.composerGate.snapshot ? evidenceSummary.composerGate.snapshot : null;
    const attachmentSnapshot = evidenceSummary.attachmentGate && evidenceSummary.attachmentGate.snapshot ? evidenceSummary.attachmentGate.snapshot : null;
    const submitSnapshot = evidenceSummary.submitGate && evidenceSummary.submitGate.snapshot ? evidenceSummary.submitGate.snapshot : null;
    const clickStep = evidenceSummary.clickStep;

    const base = {
      primaryWorkflowId: workflowId,
      primaryWorkflowName: workflowName,
      blockedAt: primaryWorkflow.currentStep || primaryWorkflow.failedStep || primaryWorkflow.lastCompletedStep || "",
      blockingCondition: "",
      evidence: {
        workflow: primaryWorkflow,
        latestAttachmentGate: attachmentSnapshot,
        latestComposerGate: composerSnapshot,
        latestSubmitEffectGate: submitSnapshot,
        clickSendStep: clickStep
      },
      ownerModule: "sites/deepseek/chatAutomator.js",
      confidence: "high",
      ruledOutCauses: [],
      nextRequiredInstrumentation: [],
      nextBestAction: "Review the latest causal snapshot for the actual workflow."
    };

    if (workflowSelection.latestDryRunWorkflow
      && workflowSelection.latestActualWorkflow
      && workflowSelection.primaryWorkflowForCausalAnalysis
      && workflowSelection.primaryWorkflowForCausalAnalysis.workflowId === workflowSelection.latestDryRunWorkflow.workflowId) {
      return CausalContracts.createCausalVerdict(Object.assign({}, base, {
        status: "exact",
        causalCode: "DIAGNOSTIC_SELECTED_DRY_RUN_INSTEAD_OF_ACTUAL_WORKFLOW",
        exactKnownCause: "The diagnostic selection preferred the dry run instead of the actual DeepSeek Excel workflow.",
        ownerModule: "core/causalDiagnostics/workflowStateTracker.js",
        nextBestAction: "Use the latest actual workflow as the primary causal workflow."
      }));
    }

    if (!workflowSelection.latestActualWorkflow && workflowSelection.latestDryRunWorkflow) {
      return CausalContracts.createCausalVerdict(Object.assign({}, base, {
        status: "incomplete",
        causalCode: "WORKFLOW_INCOMPLETE",
        exactKnownCause: "Only the dry run completed. No actual DeepSeek Excel workflow was recorded for this trace.",
        ownerModule: "background/workflows/deepseekOneClickWorkflow.js",
        nextBestAction: "Run the actual workflow and export diagnostics again."
      }));
    }

    if (primaryWorkflow.runKind === "actual" && primaryWorkflow.status === "completed") {
      if (submitSnapshot && submitSnapshot.submitEffectObserved === false) {
        return CausalContracts.createCausalVerdict(Object.assign({}, base, {
          status: "exact",
          causalCode: "CLICK_DISPATCHED_BUT_NO_SUBMIT_EFFECT",
          exactKnownCause: "The send click was dispatched but the expected submit effect was not observed.",
          blockedAt: "verify_submit_effect",
          blockingCondition: submitSnapshot.blockingCondition || "submitEffectObserved",
          nextBestAction: "Inspect the selected send candidate and the post-click submit effect signals."
        }));
      }
      return CausalContracts.createCausalVerdict(Object.assign({}, base, {
        status: "success",
        causalCode: "EXACT_CAUSE_FOUND",
        exactKnownCause: "The actual workflow completed and the submit effect was observed.",
        blockedAt: "",
        nextBestAction: "No action required."
      }));
    }

    if (primaryWorkflow.runKind === "actual" && (primaryWorkflow.status === "running" || primaryWorkflow.status === "incomplete" || primaryWorkflow.status === "failed")) {
      const lastCompletedStep = primaryWorkflow.lastCompletedStep || "";

      if (lastCompletedStep === "insert_prompt" && !composerSnapshot) {
        return CausalContracts.createCausalVerdict(Object.assign({}, base, {
          status: "incomplete",
          causalCode: "MISSING_COMPOSER_READY_CAUSAL_SNAPSHOT",
          exactKnownCause: "The workflow reached prompt insertion but no composer-ready causal snapshot was captured.",
          blockedAt: "wait_for_composer_ready_to_send",
          blockingCondition: "missing_composer_snapshot",
          ownerModule: "sites/deepseek/chatAutomator.js",
          nextRequiredInstrumentation: ["wait_for_composer_ready_to_send gate snapshot"],
          nextBestAction: "Capture composer-ready gate snapshots while polling."
        }));
      }

      if (attachmentSnapshot && attachmentSnapshot.attachmentReady === false) {
        return CausalContracts.createCausalVerdict(Object.assign({}, base, {
          status: "exact",
          causalCode: "FILE_ATTACHMENT_NOT_READY",
          exactKnownCause: "The attachment did not become ready near the composer.",
          blockedAt: "wait_for_attachment_ready",
          blockingCondition: attachmentSnapshot.blockingCondition || "attachmentReady",
          nextBestAction: "Verify the attachment card and upload readiness near the composer."
        }));
      }

      if (composerSnapshot) {
        const sendEvidence = composerSnapshot.sendButtonEvidence || {};
        const disabledReason = sendEvidence.disabledReason || "";

        if (!composerSnapshot.promptReady) {
          return CausalContracts.createCausalVerdict(Object.assign({}, base, {
            status: "exact",
            causalCode: "PROMPT_NOT_READY",
            exactKnownCause: "The expected prompt text was not present in the DeepSeek composer.",
            blockedAt: "wait_for_composer_ready_to_send",
            blockingCondition: composerSnapshot.blockingCondition || "promptReady",
            nextBestAction: "Confirm the prompt text remains present in the composer before send."
          }));
        }

        if (sendEvidence.wrongCandidateLikely) {
          return CausalContracts.createCausalVerdict(Object.assign({}, base, {
            status: "exact",
            causalCode: "WRONG_SEND_BUTTON_CANDIDATE",
            exactKnownCause: "The likely selected send-button candidate appears to be a non-send control.",
            blockedAt: "wait_for_composer_ready_to_send",
            blockingCondition: composerSnapshot.blockingCondition || "wrongSendCandidate",
            nextBestAction: "Refine the send-button candidate heuristics to reject the wrong control."
          }));
        }

        if (!sendEvidence.sendButtonCandidateFound) {
          return CausalContracts.createCausalVerdict(Object.assign({}, base, {
            status: "exact",
            causalCode: "SEND_BUTTON_NOT_FOUND",
            exactKnownCause: "No valid send-button candidate was found near the composer.",
            blockedAt: "wait_for_composer_ready_to_send",
            blockingCondition: composerSnapshot.blockingCondition || "sendButtonCandidateFound",
            nextBestAction: "Inspect the visible controls near the composer and update send-button detection."
          }));
        }

        if (!composerSnapshot.sendButtonReady) {
          return CausalContracts.createCausalVerdict(Object.assign({}, base, {
            status: "exact",
            causalCode: "SEND_BUTTON_FOUND_BUT_DISABLED",
            exactKnownCause: "A send-button candidate was found, but it was not ready to click.",
            blockedAt: "wait_for_composer_ready_to_send",
            blockingCondition: composerSnapshot.blockingCondition || "sendButtonReady",
            evidence: Object.assign({}, base.evidence, {
              disabledReason: disabledReason,
              sendButtonEvidence: sendEvidence
            }),
            nextBestAction: "Inspect the disabled reason and wait until the selected candidate becomes enabled."
          }));
        }
      }

      if (clickStep && clickStep.status === "completed" && !submitSnapshot) {
        return buildMissingEvidenceVerdict(Object.assign({}, base, {
          blockedAt: "verify_submit_effect",
          ownerModule: "sites/deepseek/chatAutomator.js",
          nextBestAction: "Capture a submit-effect snapshot immediately after the send click."
        }), ["verify_submit_effect gate snapshot"]);
      }

      if (submitSnapshot && submitSnapshot.submitEffectObserved === false) {
        return CausalContracts.createCausalVerdict(Object.assign({}, base, {
          status: "exact",
          causalCode: "CLICK_DISPATCHED_BUT_NO_SUBMIT_EFFECT",
          exactKnownCause: "The send click executed, but no submit effect was observed.",
          blockedAt: "verify_submit_effect",
          blockingCondition: submitSnapshot.blockingCondition || "submitEffectObserved",
          nextBestAction: "Inspect the selected candidate and the post-click submit effect signals."
        }));
      }

      if (composerSnapshot && composerSnapshot.ready && !clickStep) {
        return CausalContracts.createCausalVerdict(Object.assign({}, base, {
          status: "incomplete",
          causalCode: "CLICK_NOT_EXECUTED_AFTER_READY_GATE",
          exactKnownCause: "The composer-ready gate passed, but no click_send step evidence was recorded.",
          blockedAt: "click_send",
          blockingCondition: "clickNotExecuted",
          nextBestAction: "Capture click_send evidence immediately after the ready gate passes."
        }));
      }

      return buildMissingEvidenceVerdict(base, ["additional gate snapshots or structured step evidence"]);
    }

    return buildMissingEvidenceVerdict(base, ["workflow classification"]);
  }

  NewSiteCore.CausalDecisionTree = {
    analyzeWorkflowCausality: analyzeWorkflowCausality
  };
})(globalThis);
