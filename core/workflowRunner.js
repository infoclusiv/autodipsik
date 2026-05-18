(function initWorkflowRunner(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const Telemetry = NewSiteCore.Telemetry;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Errors = NewSiteCore.Errors;
  const WorkflowStateTracker = NewSiteCore.WorkflowStateTracker;

  async function runWorkflow(options) {
    const DiagnosticStore = NewSiteCore.DiagnosticStore;
    const siteId = options.siteId;
    const workflowName = options.workflowName;
    const traceId = options.traceId;
    const input = options.input || {};
    const steps = Array.isArray(options.steps) ? options.steps : [];
    const workflowId = options.workflowId || [workflowName, Date.now().toString(36)].join("_");
    const context = {
      siteId: siteId,
      workflowId: workflowId,
      workflowName: workflowName,
      traceId: traceId,
      input: input,
      results: {},
      timeline: []
    };
    const knownStepOrder = steps.map(function mapStep(step) {
      return step.name;
    });

    await DiagnosticStore.recordWorkflowStarted({
      traceId: traceId,
      workflowId: workflowId,
      workflowName: workflowName,
      runKind: WorkflowStateTracker.inferRunKind(workflowName),
      nextExpectedStep: knownStepOrder[0] || ""
    });

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.WORKFLOW_STARTED,
      traceId: traceId,
      siteId: siteId,
      component: "workflowRunner",
      workflowId: workflowId,
      level: "info",
      message: "Workflow started",
      data: { workflowName: workflowName }
    });

    for (const step of steps) {
      const startedAt = new Date().toISOString();
      const startedTime = Date.now();
      context.currentStep = step.name;
      context.currentStage = step.stage || "workflow";
      await DiagnosticStore.recordWorkflowStepStarted({
        traceId: traceId,
        workflowId: workflowId,
        stepName: step.name,
        stage: context.currentStage,
        nextExpectedStep: WorkflowStateTracker.inferNextExpectedStep(step.name, knownStepOrder)
      });
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.WORKFLOW_STEP_STARTED,
        traceId: traceId,
        siteId: siteId,
        component: "workflowRunner",
        workflowId: workflowId,
        stepName: step.name,
        stage: context.currentStage,
        level: "info",
        message: step.description || step.name,
        expected: step.expected || "",
        data: { expected: step.expected || "" }
      });

      try {
        const result = await step.run(context);
        const durationMs = Date.now() - startedTime;
        context.results[step.name] = result;
        context.timeline.push({
          stepName: step.name,
          stage: context.currentStage,
          status: "completed",
          startedAt: startedAt,
          finishedAt: new Date().toISOString(),
          expected: step.expected || "",
          actual: result && result.actual ? result.actual : "",
          durationMs: durationMs
        });

        await DiagnosticStore.recordStepEvidence({
          traceId: traceId,
          workflowId: workflowId,
          stage: context.currentStage,
          stepName: step.name,
          status: "completed",
          expected: step.expected || "",
          actual: result && result.actual ? result.actual : "",
          selectorName: result && result.selectorName ? result.selectorName : "",
          selectorValue: result && result.selectorValue ? result.selectorValue : "",
          foundBy: result && result.foundBy ? result.foundBy : "",
          elapsedMs: durationMs,
          snapshot: result && result.snapshot ? result.snapshot : null
        });
        await DiagnosticStore.recordWorkflowStepCompleted({
          traceId: traceId,
          workflowId: workflowId,
          stepName: step.name,
          stage: context.currentStage,
          nextExpectedStep: WorkflowStateTracker.inferNextExpectedStep(step.name, knownStepOrder)
        });

        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.WORKFLOW_STEP_COMPLETED,
          traceId: traceId,
          siteId: siteId,
          component: "workflowRunner",
          workflowId: workflowId,
          stepName: step.name,
          stage: context.currentStage,
          level: "info",
          message: "Workflow step completed",
          durationMs: durationMs,
          expected: step.expected || "",
          actual: result && result.actual ? result.actual : "",
          selectorName: result && result.selectorName ? result.selectorName : "",
          selectorValue: result && result.selectorValue ? result.selectorValue : "",
          data: { result: result }
        });
      } catch (error) {
        const structuredError = Errors.toStructuredError(error);
        structuredError.workflowStep = step.name;
        structuredError.failedStage = structuredError.failedStage || context.currentStage;
        structuredError.traceId = structuredError.traceId || traceId;
        structuredError.workflowId = structuredError.workflowId || workflowId;
        const durationMs = Date.now() - startedTime;
        context.timeline.push({
          stepName: step.name,
          stage: context.currentStage,
          status: "failed",
          startedAt: startedAt,
          finishedAt: new Date().toISOString(),
          expected: step.expected || "",
          actual: structuredError.actual || "",
          durationMs: durationMs,
          error: structuredError
        });

        await DiagnosticStore.recordStepEvidence({
          traceId: traceId,
          workflowId: workflowId,
          stage: context.currentStage,
          stepName: step.name,
          status: "failed",
          expected: step.expected || "",
          actual: structuredError.actual || "",
          selectorName: structuredError.selectorName || "",
          selectorValue: structuredError.selector || "",
          elapsedMs: durationMs,
          snapshot: structuredError.snapshot || structuredError.pageSummary || null
        });
        await DiagnosticStore.recordWorkflowStepFailed({
          traceId: traceId,
          workflowId: workflowId,
          stepName: step.name,
          failedStage: context.currentStage
        });

        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.WORKFLOW_STEP_FAILED,
          traceId: traceId,
          siteId: siteId,
          component: "workflowRunner",
          workflowId: workflowId,
          stepName: step.name,
          stage: context.currentStage,
          level: "error",
          message: structuredError.message,
          durationMs: durationMs,
          expected: step.expected || "",
          actual: structuredError.actual || "",
          selectorName: structuredError.selectorName || "",
          selectorValue: structuredError.selector || "",
          data: structuredError
        });

        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.WORKFLOW_FAILED,
          traceId: traceId,
          siteId: siteId,
          component: "workflowRunner",
          workflowId: workflowId,
          stepName: step.name,
          stage: context.currentStage,
          level: "error",
          message: "Workflow failed",
          expected: step.expected || "",
          actual: structuredError.actual || "",
          data: structuredError
        });

        return {
          status: "failed",
          traceId: traceId,
          workflowId: workflowId,
          workflowName: workflowName,
          failedStep: step.name,
          failedStage: context.currentStage,
          timeline: context.timeline,
          results: context.results,
          error: structuredError
        };
      }
    }

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.WORKFLOW_COMPLETED,
      traceId: traceId,
      siteId: siteId,
      component: "workflowRunner",
      workflowId: workflowId,
      level: "info",
      message: "Workflow completed"
    });
    await DiagnosticStore.recordWorkflowCompleted({
      traceId: traceId,
      workflowId: workflowId,
      currentStep: steps.length ? steps[steps.length - 1].name : ""
    });

    return {
      status: "completed",
      traceId: traceId,
      workflowId: workflowId,
      workflowName: workflowName,
      timeline: context.timeline,
      results: context.results,
      error: null
    };
  }

  NewSiteCore.WorkflowRunner = {
    runWorkflow: runWorkflow
  };
})(globalThis);
