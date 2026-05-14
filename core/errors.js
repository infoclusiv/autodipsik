(function initErrors(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  function toStructuredError(input) {
    if (!input) {
      return {
        code: "UNKNOWN_ERROR",
        message: "Unknown error",
        expected: "",
        actual: "",
        nextChecks: []
      };
    }

    if (typeof input === "string") {
      return {
        code: "GENERIC_ERROR",
        message: input,
        expected: "",
        actual: "",
        nextChecks: []
      };
    }

    return {
      code: input.code || "GENERIC_ERROR",
      message: input.message || "Unexpected error",
      expected: input.expected || "",
      actual: input.actual || "",
      recoverable: typeof input.recoverable === "boolean" ? input.recoverable : true,
      suggestedFix: input.suggestedFix || "",
      probableCause: input.probableCause || "",
      selectorName: input.selectorName || "",
      selector: input.selector || "",
      traceId: input.traceId || "",
      workflowId: input.workflowId || "",
      failedStage: input.failedStage || "",
      url: input.url || "",
      activeTabUrl: input.activeTabUrl || input.url || "",
      workflowStep: input.workflowStep || "",
      pageState: input.pageState || null,
      pageSummary: input.pageSummary || null,
      nextChecks: Array.isArray(input.nextChecks) ? input.nextChecks : []
    };
  }

  function createError(code, message, details) {
    return toStructuredError(Object.assign({ code: code, message: message }, details || {}));
  }

  NewSiteCore.Errors = {
    createError: createError,
    toStructuredError: toStructuredError
  };
})(globalThis);
