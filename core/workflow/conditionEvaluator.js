(function initConditionEvaluator(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const Errors = NewSiteCore.Errors;

  const MODULE_FILE = "core/workflow/conditionEvaluator.js";

  function createValidationError(message, expected, actual, context) {
    return Errors.createError("CONTRACT_VALIDATION_FAILED", message, {
      expected: expected,
      actual: actual,
      messageType: context && context.messageType ? context.messageType : "",
      workflowId: context && context.workflowId ? context.workflowId : "",
      probableCause: MODULE_FILE
    });
  }

  function createEvaluationError(code, message, expected, actual, context) {
    return Errors.createError(code, message, {
      expected: expected,
      actual: actual,
      messageType: context && context.messageType ? context.messageType : "",
      workflowId: context && context.workflowId ? context.workflowId : "",
      probableCause: MODULE_FILE
    });
  }

  function describeValue(value) {
    if (Array.isArray(value)) {
      return "an array";
    }

    if (value === null) {
      return "null";
    }

    return typeof value;
  }

  function ensureConditionInput(condition, context) {
    if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
      throw createValidationError(
        "ConditionEvaluator.evaluate requires a condition object.",
        "A condition object with variable and branches.",
        "Received " + describeValue(condition) + ".",
        context
      );
    }

    if (typeof condition.variable !== "string" || condition.variable.trim().length < 1) {
      throw createValidationError(
        "ConditionEvaluator.evaluate requires variable.",
        "condition.variable should be a non-empty string.",
        "condition.variable was " + String(condition.variable) + ".",
        context
      );
    }

    if (!Array.isArray(condition.branches) || !condition.branches.length) {
      throw createValidationError(
        "ConditionEvaluator.evaluate requires branches.",
        "condition.branches should be a non-empty array.",
        "condition.branches was " + describeValue(condition.branches) + ".",
        context
      );
    }

    condition.branches.forEach(function validateBranch(branch, index) {
      if (!branch || typeof branch !== "object" || Array.isArray(branch)) {
        throw createValidationError(
          "ConditionEvaluator branch must be an object.",
          "branches[" + index + "] should be an object.",
          "branches[" + index + "] was " + describeValue(branch) + ".",
          context
        );
      }

      if (typeof branch.equals !== "string") {
        throw createValidationError(
          "ConditionEvaluator branch equals must be a string.",
          "branches[" + index + "].equals should be a string.",
          "branches[" + index + "].equals was " + describeValue(branch.equals) + ".",
          context
        );
      }

      if (typeof branch.nextNodeId !== "string" || branch.nextNodeId.trim().length < 1) {
        throw createValidationError(
          "ConditionEvaluator branch nextNodeId is required.",
          "branches[" + index + "].nextNodeId should be a non-empty string.",
          "branches[" + index + "].nextNodeId was " + String(branch.nextNodeId) + ".",
          context
        );
      }
    });
  }

  function ensureVariablesInput(variables, context) {
    if (!variables || typeof variables !== "object" || Array.isArray(variables)) {
      throw createValidationError(
        "ConditionEvaluator.evaluate requires a variables object.",
        "A plain object containing extracted variable values.",
        "Received " + describeValue(variables) + ".",
        context
      );
    }
  }

  function evaluate(condition, variables, context) {
    ensureConditionInput(condition, context);
    ensureVariablesInput(variables, context);

    const scopedContext = Object.assign({}, context || {});
    const variableName = condition.variable.trim();
    const actualValue = variables[variableName];

    const matchedBranch = condition.branches.find(function findBranch(branch) {
      return branch.equals === actualValue;
    });

    if (matchedBranch) {
      return {
        status: "matched",
        variable: variableName,
        actualValue: actualValue,
        nextNodeId: matchedBranch.nextNodeId,
        reason: "variable " + variableName + " matched " + matchedBranch.equals
      };
    }

    if (typeof condition.fallbackNextNodeId === "string" && condition.fallbackNextNodeId.trim().length > 0) {
      return {
        status: "fallback",
        variable: variableName,
        actualValue: typeof actualValue === "undefined" ? null : actualValue,
        nextNodeId: condition.fallbackNextNodeId.trim(),
        reason: "no branch matched variable " + variableName + "; using fallback"
      };
    }

    return {
      status: "failed",
      variable: variableName,
      actualValue: typeof actualValue === "undefined" ? null : actualValue,
      nextNodeId: null,
      reason: "no branch matched and no fallbackNextNodeId was configured",
      error: createEvaluationError(
        "CONDITION_BRANCH_NOT_MATCHED",
        "No condition branch matched the provided variable value.",
        "Variable \"" + variableName + "\" should match one of the configured branch equals values, or a fallbackNextNodeId should be provided.",
        "Actual value was " + String(actualValue) + ".",
        scopedContext
      )
    };
  }

  NewSiteCore.ConditionEvaluator = {
    evaluate: evaluate
  };
})(globalThis);
