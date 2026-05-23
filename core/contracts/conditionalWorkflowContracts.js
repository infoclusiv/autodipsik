(function initConditionalWorkflowContracts(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const Errors = NewSiteCore.Errors;

  const SUPPORTED_NODE_TYPES = ["prompt", "regex_extract", "condition", "end"];
  const CONTRACT_FILE = "core/contracts/conditionalWorkflowContracts.js";

  function createValidationError(message, expected, actual, context) {
    return Errors.createError("CONTRACT_VALIDATION_FAILED", message, {
      expected: expected,
      actual: actual,
      messageType: context && context.messageType ? context.messageType : "",
      workflowId: context && context.workflowId ? context.workflowId : "",
      probableCause: CONTRACT_FILE
    });
  }

  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function ensureObject(value, context) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw createValidationError(
        "Conditional workflow definition must be an object.",
        "A non-null workflow definition object.",
        "Received " + describeValue(value) + ".",
        context
      );
    }
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

  function ensureNodeExists(nodeMap, nodeId, relationLabel, context) {
    if (!isNonEmptyString(nodeId)) {
      throw createValidationError(
        relationLabel + " must reference a non-empty node ID.",
        relationLabel + " should be set to an existing node ID.",
        relationLabel + " was " + String(nodeId) + ".",
        context
      );
    }

    if (!nodeMap[nodeId]) {
      throw createValidationError(
        relationLabel + " must reference an existing node.",
        relationLabel + " should match one of the declared node IDs.",
        relationLabel + " referenced missing node ID \"" + nodeId + "\".",
        context
      );
    }
  }

  function normalizePattern(pattern) {
    return {
      name: typeof pattern.name === "string" ? pattern.name.trim() : pattern.name,
      regex: typeof pattern.regex === "string" ? pattern.regex : pattern.regex,
      groupIndex: pattern.groupIndex,
      required: typeof pattern.required === "boolean" ? pattern.required : false
    };
  }

  function normalizeBranch(branch) {
    return {
      equals: typeof branch.equals === "string" ? branch.equals : branch.equals,
      nextNodeId: typeof branch.nextNodeId === "string" ? branch.nextNodeId.trim() : branch.nextNodeId
    };
  }

  function normalizeNode(node) {
    const normalized = Object.assign({}, node, {
      id: typeof node.id === "string" ? node.id.trim() : node.id,
      type: typeof node.type === "string" ? node.type.trim() : node.type
    });

    if (typeof normalized.promptText === "string") {
      normalized.promptText = normalized.promptText;
    }

    if (typeof normalized.nextNodeId === "string") {
      normalized.nextNodeId = normalized.nextNodeId.trim();
    }

    if (typeof normalized.sourceNodeId === "string") {
      normalized.sourceNodeId = normalized.sourceNodeId.trim();
    }

    if (typeof normalized.variable === "string") {
      normalized.variable = normalized.variable.trim();
    }

    if (typeof normalized.fallbackNextNodeId === "string") {
      normalized.fallbackNextNodeId = normalized.fallbackNextNodeId.trim();
    }

    if (Array.isArray(node.patterns)) {
      normalized.patterns = node.patterns.map(normalizePattern);
    }

    if (Array.isArray(node.branches)) {
      normalized.branches = node.branches.map(normalizeBranch);
    }

    return normalized;
  }

  function normalizeConditionalWorkflowDefinition(definition) {
    const safeDefinition = definition && typeof definition === "object" && !Array.isArray(definition)
      ? definition
      : {};

    return {
      flowVersion: safeDefinition.flowVersion,
      workflowId: typeof safeDefinition.workflowId === "string" ? safeDefinition.workflowId.trim() : safeDefinition.workflowId,
      startNodeId: typeof safeDefinition.startNodeId === "string" ? safeDefinition.startNodeId.trim() : safeDefinition.startNodeId,
      nodes: Array.isArray(safeDefinition.nodes) ? safeDefinition.nodes.map(normalizeNode) : []
    };
  }

  function getNodeById(definition, nodeId) {
    if (!definition || !Array.isArray(definition.nodes)) {
      return null;
    }

    return definition.nodes.find(function findNode(node) {
      return node && node.id === nodeId;
    }) || null;
  }

  function validateFlowVersion(definition, context) {
    if (definition.flowVersion !== 1) {
      throw createValidationError(
        "flowVersion must be 1 for the MVP conditional workflow contract.",
        "flowVersion should equal 1.",
        "flowVersion was " + String(definition.flowVersion) + ".",
        context
      );
    }
  }

  function validateWorkflowId(definition, context) {
    if (!isNonEmptyString(definition.workflowId)) {
      throw createValidationError(
        "workflowId is required.",
        "workflowId should be a non-empty string.",
        "workflowId was " + String(definition.workflowId) + ".",
        context
      );
    }
  }

  function validateNodeShape(node, index, context) {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      throw createValidationError(
        "Each workflow node must be an object.",
        "nodes[" + index + "] should be a non-null object.",
        "nodes[" + index + "] was " + describeValue(node) + ".",
        context
      );
    }

    if (!isNonEmptyString(node.id)) {
      throw createValidationError(
        "Each workflow node requires a non-empty id.",
        "nodes[" + index + "].id should be a non-empty string.",
        "nodes[" + index + "].id was " + String(node.id) + ".",
        context
      );
    }

    if (SUPPORTED_NODE_TYPES.indexOf(node.type) === -1) {
      throw createValidationError(
        "Unsupported workflow node type.",
        "nodes[" + index + "].type should be one of: " + SUPPORTED_NODE_TYPES.join(", ") + ".",
        "nodes[" + index + "].type was " + String(node.type) + ".",
        context
      );
    }
  }

  function validatePromptNode(node, context) {
    if (!isNonEmptyString(node.promptText)) {
      throw createValidationError(
        "prompt nodes require promptText.",
        "Node \"" + node.id + "\" should include a non-empty promptText string.",
        "promptText was " + String(node.promptText) + ".",
        context
      );
    }

    if (typeof node.attachFile !== "undefined" && typeof node.attachFile !== "boolean") {
      throw createValidationError(
        "prompt.attachFile must be a boolean when provided.",
        "Node \"" + node.id + "\" attachFile should be true or false.",
        "attachFile was " + String(node.attachFile) + ".",
        context
      );
    }

    if (typeof node.waitForResponse !== "undefined" && typeof node.waitForResponse !== "boolean") {
      throw createValidationError(
        "prompt.waitForResponse must be a boolean when provided.",
        "Node \"" + node.id + "\" waitForResponse should be true or false.",
        "waitForResponse was " + String(node.waitForResponse) + ".",
        context
      );
    }
  }

  function validateRegexExtractNode(node, context) {
    if (!isNonEmptyString(node.sourceNodeId)) {
      throw createValidationError(
        "regex_extract nodes require sourceNodeId.",
        "Node \"" + node.id + "\" should reference the source prompt node ID.",
        "sourceNodeId was " + String(node.sourceNodeId) + ".",
        context
      );
    }

    if (!Array.isArray(node.patterns) || !node.patterns.length) {
      throw createValidationError(
        "regex_extract nodes require at least one pattern.",
        "Node \"" + node.id + "\" should include a non-empty patterns array.",
        "patterns was " + describeValue(node.patterns) + ".",
        context
      );
    }

    node.patterns.forEach(function validatePattern(pattern, patternIndex) {
      if (!pattern || typeof pattern !== "object" || Array.isArray(pattern)) {
        throw createValidationError(
          "regex_extract patterns must be objects.",
          "Node \"" + node.id + "\" patterns[" + patternIndex + "] should be an object.",
          "patterns[" + patternIndex + "] was " + describeValue(pattern) + ".",
          context
        );
      }

      if (!isNonEmptyString(pattern.name)) {
        throw createValidationError(
          "regex_extract pattern name is required.",
          "Node \"" + node.id + "\" patterns[" + patternIndex + "].name should be a non-empty string.",
          "patterns[" + patternIndex + "].name was " + String(pattern.name) + ".",
          context
        );
      }

      if (!isNonEmptyString(pattern.regex)) {
        throw createValidationError(
          "regex_extract pattern regex is required.",
          "Node \"" + node.id + "\" patterns[" + patternIndex + "].regex should be a non-empty string.",
          "patterns[" + patternIndex + "].regex was " + String(pattern.regex) + ".",
          context
        );
      }

      if (!Number.isInteger(pattern.groupIndex) || pattern.groupIndex < 0) {
        throw createValidationError(
          "regex_extract pattern groupIndex is invalid.",
          "Node \"" + node.id + "\" patterns[" + patternIndex + "].groupIndex should be an integer greater than or equal to 0.",
          "patterns[" + patternIndex + "].groupIndex was " + String(pattern.groupIndex) + ".",
          context
        );
      }

      if (typeof pattern.required !== "undefined" && typeof pattern.required !== "boolean") {
        throw createValidationError(
          "regex_extract pattern required must be a boolean when provided.",
          "Node \"" + node.id + "\" patterns[" + patternIndex + "].required should be true or false.",
          "patterns[" + patternIndex + "].required was " + String(pattern.required) + ".",
          context
        );
      }
    });
  }

  function validateConditionNode(node, context) {
    if (!isNonEmptyString(node.variable)) {
      throw createValidationError(
        "condition nodes require variable.",
        "Node \"" + node.id + "\" should include a non-empty variable name.",
        "variable was " + String(node.variable) + ".",
        context
      );
    }

    if (!Array.isArray(node.branches) || !node.branches.length) {
      throw createValidationError(
        "condition nodes require at least one branch.",
        "Node \"" + node.id + "\" should include a non-empty branches array.",
        "branches was " + describeValue(node.branches) + ".",
        context
      );
    }

    node.branches.forEach(function validateBranch(branch, branchIndex) {
      if (!branch || typeof branch !== "object" || Array.isArray(branch)) {
        throw createValidationError(
          "condition branches must be objects.",
          "Node \"" + node.id + "\" branches[" + branchIndex + "] should be an object.",
          "branches[" + branchIndex + "] was " + describeValue(branch) + ".",
          context
        );
      }

      if (!isNonEmptyString(branch.equals)) {
        throw createValidationError(
          "condition branch equals is required.",
          "Node \"" + node.id + "\" branches[" + branchIndex + "].equals should be a non-empty string.",
          "branches[" + branchIndex + "].equals was " + String(branch.equals) + ".",
          context
        );
      }

      if (!isNonEmptyString(branch.nextNodeId)) {
        throw createValidationError(
          "condition branch nextNodeId is required.",
          "Node \"" + node.id + "\" branches[" + branchIndex + "].nextNodeId should be a non-empty string.",
          "branches[" + branchIndex + "].nextNodeId was " + String(branch.nextNodeId) + ".",
          context
        );
      }
    });
  }

  function validateEndNode(node, context) {
    if (typeof node.reason !== "undefined" && typeof node.reason !== "string") {
      throw createValidationError(
        "end.reason must be a string when provided.",
        "Node \"" + node.id + "\" reason should be a string.",
        "reason was " + String(node.reason) + ".",
        context
      );
    }
  }

  function validateNodeConfig(node, context) {
    if (node.type === "prompt") {
      validatePromptNode(node, context);
      return;
    }

    if (node.type === "regex_extract") {
      validateRegexExtractNode(node, context);
      return;
    }

    if (node.type === "condition") {
      validateConditionNode(node, context);
      return;
    }

    validateEndNode(node, context);
  }

  function validateNodeReferences(definition, nodeMap, context) {
    ensureNodeExists(nodeMap, definition.startNodeId, "startNodeId", context);

    definition.nodes.forEach(function validateNodeReferencesForNode(node) {
      if (isNonEmptyString(node.nextNodeId)) {
        ensureNodeExists(nodeMap, node.nextNodeId, "nextNodeId for node \"" + node.id + "\"", context);
      }

      if (node.type === "regex_extract") {
        ensureNodeExists(nodeMap, node.sourceNodeId, "sourceNodeId for node \"" + node.id + "\"", context);
      }

      if (node.type === "condition") {
        node.branches.forEach(function validateBranchTarget(branch, branchIndex) {
          ensureNodeExists(nodeMap, branch.nextNodeId, "branches[" + branchIndex + "].nextNodeId for node \"" + node.id + "\"", context);
        });

        if (typeof node.fallbackNextNodeId !== "undefined" && node.fallbackNextNodeId !== null && node.fallbackNextNodeId !== "") {
          ensureNodeExists(nodeMap, node.fallbackNextNodeId, "fallbackNextNodeId for node \"" + node.id + "\"", context);
        }
      }
    });
  }

  function validateConditionalWorkflowDefinition(definition, context) {
    ensureObject(definition, context);

    const normalized = normalizeConditionalWorkflowDefinition(definition);
    const scopedContext = Object.assign({}, context || {}, {
      workflowId: normalized.workflowId || (context && context.workflowId ? context.workflowId : "")
    });

    validateFlowVersion(normalized, scopedContext);
    validateWorkflowId(normalized, scopedContext);

    if (!isNonEmptyString(normalized.startNodeId)) {
      throw createValidationError(
        "startNodeId is required.",
        "startNodeId should be a non-empty string that matches a declared node ID.",
        "startNodeId was " + String(normalized.startNodeId) + ".",
        scopedContext
      );
    }

    if (!Array.isArray(normalized.nodes) || !normalized.nodes.length) {
      throw createValidationError(
        "nodes is required.",
        "nodes should be a non-empty array of workflow node definitions.",
        "nodes was " + describeValue(normalized.nodes) + ".",
        scopedContext
      );
    }

    const nodeMap = {};

    normalized.nodes.forEach(function validateNode(node, index) {
      validateNodeShape(node, index, scopedContext);

      if (nodeMap[node.id]) {
        throw createValidationError(
          "Workflow node IDs must be unique.",
          "Each node id should appear only once in nodes[].",
          "Duplicate node id \"" + node.id + "\" was found.",
          scopedContext
        );
      }

      nodeMap[node.id] = node;
      validateNodeConfig(node, scopedContext);
    });

    validateNodeReferences(normalized, nodeMap, scopedContext);

    return normalized;
  }

  NewSiteCore.ConditionalWorkflowContracts = {
    SUPPORTED_NODE_TYPES: SUPPORTED_NODE_TYPES.slice(),
    getNodeById: getNodeById,
    normalizeConditionalWorkflowDefinition: normalizeConditionalWorkflowDefinition,
    validateConditionalWorkflowDefinition: validateConditionalWorkflowDefinition
  };
})(globalThis);
