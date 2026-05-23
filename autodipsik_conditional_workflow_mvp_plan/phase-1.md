# phase-1.md

# Phase 1 — Add the conditional workflow definition contract

## Single objective

Add a repository-aligned, pure JavaScript contract for the MVP conditional workflow definition, without executing any DeepSeek automation yet.

This phase should define what a conditional workflow is and validate its structure before any runtime, UI, or gateway changes are introduced.

## Expected behavior

A new core contract module validates a declarative workflow definition like:

```json
{
  "flowVersion": 1,
  "workflowId": "mvp_tipo_flow",
  "startNodeId": "prompt_1",
  "nodes": [
    {
      "id": "prompt_1",
      "type": "prompt",
      "promptText": "Analyze the attached Excel and answer using [[TIPO: tipo_1]] or [[TIPO: tipo_2]].",
      "attachFile": true,
      "waitForResponse": true,
      "nextNodeId": "extract_tipo"
    },
    {
      "id": "extract_tipo",
      "type": "regex_extract",
      "sourceNodeId": "prompt_1",
      "patterns": [
        {
          "name": "tipo",
          "regex": "\\[\\[TIPO:\\s*(tipo_1|tipo_2)\\s*\\]\\]",
          "groupIndex": 1,
          "required": true
        }
      ],
      "nextNodeId": "decision_tipo"
    },
    {
      "id": "decision_tipo",
      "type": "condition",
      "variable": "tipo",
      "branches": [
        { "equals": "tipo_1", "nextNodeId": "prompt_tipo_1" },
        { "equals": "tipo_2", "nextNodeId": "prompt_tipo_2" }
      ],
      "fallbackNextNodeId": "end_no_match"
    },
    {
      "id": "prompt_tipo_1",
      "type": "prompt",
      "promptText": "Follow-up prompt for tipo_1.",
      "attachFile": false,
      "waitForResponse": true,
      "nextNodeId": "end"
    },
    {
      "id": "prompt_tipo_2",
      "type": "prompt",
      "promptText": "Follow-up prompt for tipo_2.",
      "attachFile": false,
      "waitForResponse": true,
      "nextNodeId": "end"
    },
    {
      "id": "end_no_match",
      "type": "end",
      "reason": "No matching branch."
    },
    {
      "id": "end",
      "type": "end"
    }
  ]
}
```

The validator should reject malformed definitions with structured errors that include expected vs actual values.

## Success criteria

- A new contract module exists, for example:
  - `core/contracts/conditionalWorkflowContracts.js`
- The module attaches to the existing global namespace:
  - `globalThis.NewSiteCore.ConditionalWorkflowContracts`
- The module exposes at least:
  - `validateConditionalWorkflowDefinition(definition, context)`
  - `normalizeConditionalWorkflowDefinition(definition)`
  - `getNodeById(definition, nodeId)`
- It validates:
  - `flowVersion`
  - `workflowId`
  - `startNodeId`
  - `nodes`
  - unique node IDs
  - supported node types: `prompt`, `regex_extract`, `condition`, `end`
  - valid `nextNodeId`, branch targets, fallback targets, and source node IDs
  - required prompt text for `prompt` nodes
  - required regex pattern configuration for `regex_extract` nodes
  - required variable and branches for `condition` nodes
- The module uses existing error infrastructure:
  - `NewSiteCore.Errors.createError(...)`
- The module is loaded by `background-main.js` before any workflow that will depend on it.
- Existing one-click automation still loads without errors.

## How to verify

1. Reload the extension.
2. Open the service worker console.
3. Verify the global exists:

```js
Boolean(globalThis.NewSiteCore.ConditionalWorkflowContracts)
```

Expected result:

```js
true
```

4. Run a valid sample through the validator:

```js
globalThis.NewSiteCore.ConditionalWorkflowContracts.validateConditionalWorkflowDefinition(sampleDefinition, {
  messageType: "manual_test"
})
```

Expected result:

- No thrown error.

5. Run an invalid sample with a missing `startNodeId` or duplicate node IDs.

Expected result:

- A structured error is thrown with:
  - `code: "CONTRACT_VALIDATION_FAILED"`
  - `expected`
  - `actual`
  - `probableCause: "core/contracts/conditionalWorkflowContracts.js"`

6. Run the existing one-click Automation Tester.

Expected result:

- Existing one-click flow starts as before.
- No new console errors related to missing globals or script load order.

## Observable failure signals

- `NewSiteCore.ConditionalWorkflowContracts` is undefined.
- Background service worker fails during `importScripts`.
- Existing `AUTOMATION_ONE_CLICK_RUN` stops routing.
- Invalid definitions are accepted silently.
- Errors do not include expected vs actual fields.
- The validator requires fields not included in the MVP schema above.

## Files/components involved

Expected files to create or edit:

- Create:
  - `core/contracts/conditionalWorkflowContracts.js`
- Edit:
  - `background-main.js`

Do not edit in this phase:

- `sites/deepseek/chatAutomator.js`
- `background/workflows/deepseekOneClickWorkflow.js`
- Python gateway files
- Sidepanel UI files

## Preconditions before implementation

- Confirm `background-main.js` still uses `importScripts(...)`.
- Confirm `core/errors.js` exposes `NewSiteCore.Errors.createError`.
- Confirm contract modules currently attach to `NewSiteCore` through IIFEs.
- Confirm no existing `ConditionalWorkflowContracts` global already exists.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- The repo has moved away from global IIFE modules to ES modules.
- `background-main.js` no longer controls service worker load order.
- `NewSiteCore.Errors` no longer exists or has a different API.
- There is already a conditional workflow contract module with a different schema.
- The current codebase already implemented this feature in another branch or module.

## Phase scope limit

Do not implement execution, regex extraction, branching, UI, message routing, or gateway saving in this phase.
