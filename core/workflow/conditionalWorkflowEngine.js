(function initConditionalWorkflowEngine(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const Errors = NewSiteCore.Errors;
  const ConditionalWorkflowContracts = NewSiteCore.ConditionalWorkflowContracts;
  const RegexExtractor = NewSiteCore.RegexExtractor;
  const ConditionEvaluator = NewSiteCore.ConditionEvaluator;

  const MODULE_FILE = "core/workflow/conditionalWorkflowEngine.js";
  const DEFAULT_MAX_NODES = 25;

  function createValidationError(message, expected, actual, context) {
    return Errors.createError("CONTRACT_VALIDATION_FAILED", message, {
      expected: expected,
      actual: actual,
      traceId: context && context.traceId ? context.traceId : "",
      workflowId: context && context.workflowId ? context.workflowId : "",
      messageType: context && context.messageType ? context.messageType : "",
      probableCause: MODULE_FILE
    });
  }

  function createWorkflowError(code, message, expected, actual, context, failedNodeId) {
    return Errors.createError(code, message, {
      expected: expected,
      actual: actual,
      traceId: context && context.traceId ? context.traceId : "",
      workflowId: context && context.workflowId ? context.workflowId : "",
      messageType: context && context.messageType ? context.messageType : "",
      workflowStep: failedNodeId || "",
      probableCause: MODULE_FILE
    });
  }

  function ensureRunOptions(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw createValidationError(
        "ConditionalWorkflowEngine.run requires an options object.",
        "An object with definition and runPromptTurn.",
        "Received " + describeValue(options) + ".",
        {}
      );
    }

    if (typeof options.runPromptTurn !== "function") {
      throw createValidationError(
        "ConditionalWorkflowEngine.run requires runPromptTurn.",
        "runPromptTurn should be an async function.",
        "runPromptTurn was " + describeValue(options.runPromptTurn) + ".",
        {
          traceId: options.traceId || "",
          workflowId: options.definition && options.definition.workflowId ? options.definition.workflowId : ""
        }
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

  async function invokeHook(hook, payload) {
    if (typeof hook === "function") {
      await hook(payload);
    }
  }

  function createExecutionState(definition, options) {
    return {
      traceId: options.traceId || "",
      workflowId: definition.workflowId,
      definition: definition,
      input: Object.assign({}, options.input || {}),
      visitedNodeIds: [],
      turns: [],
      turnsByNodeId: {},
      variables: {},
      extractions: {},
      decisions: {},
      finalNodeId: "",
      status: "running",
      error: null
    };
  }

  function finalizeFailure(state, error, failedNodeId) {
    const structured = Errors.toStructuredError(error);
    structured.traceId = structured.traceId || state.traceId;
    structured.workflowId = structured.workflowId || state.workflowId;
    if (structured.workflowStep && failedNodeId && structured.workflowStep !== failedNodeId) {
      structured.failedPatternName = structured.workflowStep;
    }
    structured.workflowStep = failedNodeId || structured.workflowStep || "";
    structured.failedNodeId = failedNodeId || structured.failedNodeId || "";
    structured.probableCause = structured.probableCause || MODULE_FILE;

    state.status = "failed";
    state.finalNodeId = failedNodeId || state.finalNodeId || "";
    state.error = structured;

    return {
      traceId: state.traceId,
      workflowId: state.workflowId,
      visitedNodeIds: state.visitedNodeIds.slice(),
      turns: state.turns.slice(),
      turnsByNodeId: Object.assign({}, state.turnsByNodeId),
      variables: Object.assign({}, state.variables),
      extractions: Object.assign({}, state.extractions),
      decisions: Object.assign({}, state.decisions),
      finalNodeId: state.finalNodeId,
      status: "failed",
      error: structured
    };
  }

  function finalizeSuccess(state, finalNodeId) {
    state.status = "completed";
    state.finalNodeId = finalNodeId;
    state.error = null;

    return {
      traceId: state.traceId,
      workflowId: state.workflowId,
      visitedNodeIds: state.visitedNodeIds.slice(),
      turns: state.turns.slice(),
      turnsByNodeId: Object.assign({}, state.turnsByNodeId),
      variables: Object.assign({}, state.variables),
      extractions: Object.assign({}, state.extractions),
      decisions: Object.assign({}, state.decisions),
      finalNodeId: finalNodeId,
      status: "completed",
      error: null
    };
  }

  function getNode(definition, nodeId, state) {
    const node = ConditionalWorkflowContracts.getNodeById(definition, nodeId);
    if (!node) {
      throw createWorkflowError(
        "WORKFLOW_NODE_NOT_FOUND",
        "The workflow engine could not resolve the next node.",
        "Node ID \"" + nodeId + "\" should exist in the validated workflow definition.",
        "Node ID \"" + nodeId + "\" could not be found at runtime.",
        state,
        nodeId
      );
    }
    return node;
  }

  function validatePromptTurnResult(result, node, state) {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw createWorkflowError(
        "PROMPT_TURN_RESULT_INVALID",
        "runPromptTurn returned an invalid result.",
        "runPromptTurn should return an object with nodeId and response metadata.",
        "The executor returned " + describeValue(result) + ".",
        state,
        node.id
      );
    }

    if (!result.response || typeof result.response !== "object" || Array.isArray(result.response)) {
      throw createWorkflowError(
        "PROMPT_TURN_RESPONSE_INVALID",
        "runPromptTurn returned a result without a valid response object.",
        "result.response should include text and textLength.",
        "The executor response was " + describeValue(result.response) + ".",
        state,
        node.id
      );
    }

    if (typeof result.response.text !== "string") {
      throw createWorkflowError(
        "PROMPT_TURN_RESPONSE_TEXT_INVALID",
        "runPromptTurn response.text must be a string.",
        "result.response.text should be a string.",
        "response.text was " + describeValue(result.response.text) + ".",
        state,
        node.id
      );
    }

    if (typeof result.response.textLength !== "number" || result.response.textLength !== result.response.text.length) {
      throw createWorkflowError(
        "PROMPT_TURN_RESPONSE_TEXT_LENGTH_INVALID",
        "runPromptTurn response.textLength is invalid.",
        "result.response.textLength should equal result.response.text.length.",
        "textLength was " + String(result.response.textLength) + " while text length was " + String(result.response.text.length) + ".",
        state,
        node.id
      );
    }
  }

  async function executePromptNode(node, state, runPromptTurn) {
    const turnResult = await runPromptTurn(node, state);
    validatePromptTurnResult(turnResult, node, state);

    const storedTurn = Object.assign({}, turnResult, {
      nodeId: node.id,
      response: Object.assign({}, turnResult.response)
    });

    state.turns.push(storedTurn);
    state.turnsByNodeId[node.id] = storedTurn;

    return node.nextNodeId || null;
  }

  function executeRegexExtractNode(node, state) {
    const sourceTurn = state.turnsByNodeId[node.sourceNodeId];
    if (!sourceTurn || !sourceTurn.response || typeof sourceTurn.response.text !== "string") {
      throw createWorkflowError(
        "WORKFLOW_EXTRACTION_SOURCE_MISSING",
        "The regex extraction source response was not available.",
        "Node \"" + node.id + "\" should read text from source node \"" + node.sourceNodeId + "\".",
        "No captured prompt response was stored for source node \"" + node.sourceNodeId + "\".",
        state,
        node.id
      );
    }

    const extractionResult = RegexExtractor.extract({
      text: sourceTurn.response.text,
      patterns: node.patterns
    }, {
      traceId: state.traceId,
      workflowId: state.workflowId,
      messageType: "CONDITIONAL_WORKFLOW_REGEX_EXTRACT"
    });

    state.extractions[node.id] = Object.assign({
      nodeId: node.id,
      sourceNodeId: node.sourceNodeId
    }, extractionResult);

    if (extractionResult.status === "failed") {
      const extractionError = extractionResult.errors && extractionResult.errors.length
        ? extractionResult.errors[0]
        : createWorkflowError(
          "WORKFLOW_EXTRACTION_FAILED",
          "Regex extraction failed.",
          "Node \"" + node.id + "\" should extract the required variables from the source text.",
          "Regex extraction returned failed status without an explicit error.",
          state,
          node.id
        );
      throw extractionError;
    }

    Object.assign(state.variables, extractionResult.variables || {});
    return node.nextNodeId || null;
  }

  function executeConditionNode(node, state) {
    const decisionResult = ConditionEvaluator.evaluate({
      variable: node.variable,
      branches: node.branches,
      fallbackNextNodeId: node.fallbackNextNodeId
    }, state.variables, {
      traceId: state.traceId,
      workflowId: state.workflowId,
      messageType: "CONDITIONAL_WORKFLOW_CONDITION_EVALUATION"
    });

    state.decisions[node.id] = Object.assign({
      nodeId: node.id
    }, decisionResult);

    if (decisionResult.status === "failed") {
      throw decisionResult.error || createWorkflowError(
        "WORKFLOW_CONDITION_FAILED",
        "Condition evaluation failed.",
        "Node \"" + node.id + "\" should select a matching branch or fallback.",
        "Condition evaluation returned failed status without an explicit error.",
        state,
        node.id
      );
    }

    return decisionResult.nextNodeId || null;
  }

  async function run(options) {
    ensureRunOptions(options);

    const definition = ConditionalWorkflowContracts.validateConditionalWorkflowDefinition(options.definition, {
      traceId: options.traceId || "",
      messageType: "CONDITIONAL_WORKFLOW_RUN"
    });
    const maxNodes = Number.isInteger(options.maxNodes) && options.maxNodes > 0
      ? options.maxNodes
      : DEFAULT_MAX_NODES;
    const state = createExecutionState(definition, options);
    let currentNodeId = definition.startNodeId;

    while (currentNodeId) {
      if (state.visitedNodeIds.length >= maxNodes) {
        return finalizeFailure(state, createWorkflowError(
          "WORKFLOW_MAX_NODES_EXCEEDED",
          "Conditional workflow execution exceeded the maximum node limit.",
          "The workflow should finish within " + String(maxNodes) + " node visits.",
          "Visited node count reached " + String(state.visitedNodeIds.length) + " before completion.",
          state,
          currentNodeId
        ), currentNodeId);
      }

      let node;
      try {
        node = getNode(definition, currentNodeId, state);
      } catch (error) {
        return finalizeFailure(state, error, currentNodeId);
      }

      state.visitedNodeIds.push(node.id);

      try {
        await invokeHook(options.onNodeStarted, {
          node: node,
          state: state
        });

        if (node.type === "prompt") {
          currentNodeId = await executePromptNode(node, state, options.runPromptTurn);
          await invokeHook(options.onNodeCompleted, {
            node: node,
            state: state,
            nextNodeId: currentNodeId
          });
          continue;
        }

        if (node.type === "regex_extract") {
          currentNodeId = executeRegexExtractNode(node, state);
          await invokeHook(options.onNodeCompleted, {
            node: node,
            state: state,
            nextNodeId: currentNodeId
          });
          continue;
        }

        if (node.type === "condition") {
          currentNodeId = executeConditionNode(node, state);
          await invokeHook(options.onNodeCompleted, {
            node: node,
            state: state,
            nextNodeId: currentNodeId
          });
          continue;
        }

        await invokeHook(options.onNodeCompleted, {
          node: node,
          state: state,
          nextNodeId: null
        });
        return finalizeSuccess(state, node.id);
      } catch (error) {
        await invokeHook(options.onNodeFailed, {
          node: node,
          state: state,
          error: error
        });
        return finalizeFailure(state, error, node.id);
      }
    }

    return finalizeFailure(state, createWorkflowError(
      "WORKFLOW_NEXT_NODE_MISSING",
      "Conditional workflow execution stopped without reaching an end node.",
      "Each non-end node should resolve to a next node or branch target.",
      "Execution reached an empty next node reference before completion.",
      state,
      state.visitedNodeIds.length ? state.visitedNodeIds[state.visitedNodeIds.length - 1] : definition.startNodeId
    ), state.visitedNodeIds.length ? state.visitedNodeIds[state.visitedNodeIds.length - 1] : definition.startNodeId);
  }

  NewSiteCore.ConditionalWorkflowEngine = {
    run: run
  };
})(globalThis);
