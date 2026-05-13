(function initWorkflowRunner(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const Telemetry = NewSiteCore.Telemetry;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Errors = NewSiteCore.Errors;

  async function runWorkflow(options) {
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
      context.currentStep = step.name;
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.WORKFLOW_STEP_STARTED,
        traceId: traceId,
        siteId: siteId,
        component: "workflowRunner",
        workflowId: workflowId,
        stepName: step.name,
        level: "info",
        message: step.description || step.name,
        data: { expected: step.expected || "" }
      });

      try {
        const result = await step.run(context);
        context.results[step.name] = result;
        context.timeline.push({
          stepName: step.name,
          status: "completed",
          startedAt: startedAt,
          finishedAt: new Date().toISOString()
        });

        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.WORKFLOW_STEP_COMPLETED,
          traceId: traceId,
          siteId: siteId,
          component: "workflowRunner",
          workflowId: workflowId,
          stepName: step.name,
          level: "info",
          message: "Workflow step completed",
          data: { result: result }
        });
      } catch (error) {
        const structuredError = Errors.toStructuredError(error);
        structuredError.workflowStep = step.name;
        context.timeline.push({
          stepName: step.name,
          status: "failed",
          startedAt: startedAt,
          finishedAt: new Date().toISOString(),
          error: structuredError
        });

        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.WORKFLOW_STEP_FAILED,
          traceId: traceId,
          siteId: siteId,
          component: "workflowRunner",
          workflowId: workflowId,
          stepName: step.name,
          level: "error",
          message: structuredError.message,
          data: structuredError
        });

        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.WORKFLOW_FAILED,
          traceId: traceId,
          siteId: siteId,
          component: "workflowRunner",
          workflowId: workflowId,
          stepName: step.name,
          level: "error",
          message: "Workflow failed",
          data: structuredError
        });

        return {
          status: "failed",
          traceId: traceId,
          workflowId: workflowId,
          failedStep: step.name,
          timeline: context.timeline,
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

    return {
      status: "completed",
      traceId: traceId,
      workflowId: workflowId,
      timeline: context.timeline,
      results: context.results,
      error: null
    };
  }

  NewSiteCore.WorkflowRunner = {
    runWorkflow: runWorkflow
  };
})(globalThis);
