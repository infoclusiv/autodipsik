# phase-3.md

# Phase 3 — Add a pure conditional workflow engine with an injected prompt executor

## Single objective

Add a pure conditional workflow engine that can walk the MVP workflow graph using an injected `runPromptTurn` function.

This phase should prove the graph logic works before connecting it to DeepSeek.

## Expected behavior

A new engine can execute the workflow graph with a fake prompt executor:

```js
const result = await NewSiteCore.ConditionalWorkflowEngine.run({
  definition: sampleDefinition,
  traceId: "manual_trace",
  runPromptTurn: async function runPromptTurn(node, context) {
    if (node.id === "prompt_1") {
      return {
        nodeId: node.id,
        response: {
          text: "Result: [[TIPO: tipo_1]]",
          textLength: "Result: [[TIPO: tipo_1]]".length
        }
      };
    }

    return {
      nodeId: node.id,
      response: {
        text: "Final response for " + node.id,
        textLength: ("Final response for " + node.id).length
      }
    };
  }
});
```

Expected result:

- The engine visits:
  - `prompt_1`
  - `extract_tipo`
  - `decision_tipo`
  - `prompt_tipo_1`
  - `end`
- It stores:
  - `variables.tipo === "tipo_1"`
  - prompt turn results
  - extraction result
  - decision result
  - final status

## Success criteria

- A new module exists, for example:
  - `core/workflow/conditionalWorkflowEngine.js`
- The module attaches to:
  - `NewSiteCore.ConditionalWorkflowEngine`
- The engine uses:
  - `ConditionalWorkflowContracts`
  - `RegexExtractor`
  - `ConditionEvaluator`
- The engine supports MVP node types:
  - `prompt`
  - `regex_extract`
  - `condition`
  - `end`
- The engine accepts an injected async prompt executor:
  - `runPromptTurn(node, executionContext)`
- The engine tracks:
  - `traceId`
  - `workflowId`
  - `visitedNodeIds`
  - `turns`
  - `turnsByNodeId`
  - `variables`
  - `extractions`
  - `decisions`
  - `finalNodeId`
  - `status`
  - `error`
- The engine has loop protection, for example:
  - `maxNodes` defaulting to a safe value such as `25`
- The engine returns structured failure data when:
  - a regex extraction fails
  - a condition has no match and no fallback
  - a next node cannot be resolved
  - max node execution is exceeded
- Existing one-click automation remains unchanged.

## How to verify

1. Reload the extension.
2. In the service worker console, check:

```js
Boolean(NewSiteCore.ConditionalWorkflowEngine)
```

Expected result:

```js
true
```

3. Run the engine with a fake executor returning `[[TIPO: tipo_1]]`.

Expected result:

- `status === "completed"`
- `variables.tipo === "tipo_1"`
- `visitedNodeIds` includes `prompt_tipo_1`
- `visitedNodeIds` does not include `prompt_tipo_2`

4. Run the engine with fake executor returning `[[TIPO: tipo_2]]`.

Expected result:

- `status === "completed"`
- `variables.tipo === "tipo_2"`
- `visitedNodeIds` includes `prompt_tipo_2`
- `visitedNodeIds` does not include `prompt_tipo_1`

5. Run the engine with fake executor returning text without a regex match.

Expected result:

- `status === "failed"`
- error includes:
  - failed node ID
  - expected regex match
  - actual text preview or no-match explanation

## Observable failure signals

- The engine depends on Chrome APIs.
- The engine depends on DeepSeek or DOM APIs.
- A malformed graph causes an infinite loop.
- A condition branch is selected incorrectly.
- Regex extraction results are not available to condition nodes.
- Prompt turn results are overwritten or lost.
- The engine mutates the original workflow definition in unsafe ways.

## Files/components involved

Expected files to create or edit:

- Create:
  - `core/workflow/conditionalWorkflowEngine.js`
- Edit:
  - `background-main.js`

Do not edit in this phase:

- `background/messageRouter.js`
- `background/messageHandlers/automationHandlers.js`
- `sites/deepseek/*`
- Python gateway files
- Sidepanel UI files

## Preconditions before implementation

- Phase 1 is complete and verified.
- Phase 2 is complete and verified.
- Confirm core globals are loaded in this order:
  1. errors
  2. contracts
  3. regex extractor
  4. condition evaluator
  5. conditional workflow engine
- Confirm no background workflow depends on this engine yet.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- The repo already has an equivalent workflow engine.
- The existing `core/workflowRunner.js` already supports graph execution with branching and should be extended instead.
- The global load order cannot safely support a new engine module.
- The current codebase has moved to a different test/build system that changes how core modules are loaded.

## Phase scope limit

Do not connect the engine to DeepSeek in this phase. The executor must be injected and fakeable.
