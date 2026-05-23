# phase-6.md

# Phase 6 — Add the real conditional workflow background runner and message route

## Single objective

Expose a new background message that runs a conditional workflow definition against DeepSeek by combining the pure engine with `DeepSeekPromptTurnRunner`.

This phase makes the multi-prompt conditional workflow executable, but it does not yet add final multi-turn JSON saving through the Python gateway.

## Expected behavior

The sidepanel or console can send:

```js
chrome.runtime.sendMessage({
  type: NewSiteCore.MESSAGE_TYPES.CONDITIONAL_WORKFLOW_RUN,
  input: {
    definition: sampleDefinition,
    autoConnectGateway: true,
    autoOpenDeepSeek: true,
    autoSelectFileIfMissing: true
  }
});
```

Expected runtime flow:

1. Validate workflow definition.
2. Ensure gateway connected.
3. Ensure selected Excel file exists if any prompt node requires `attachFile: true`.
4. Ensure DeepSeek tab is ready.
5. Detect page state.
6. Run the pure conditional workflow engine.
7. For each `prompt` node:
   - call `DeepSeekPromptTurnRunner.runTurn(...)`
   - attach file only when the node says `attachFile: true`
   - wait for response when `waitForResponse !== false`
8. For `regex_extract` nodes:
   - extract variables from the referenced prompt response.
9. For `condition` nodes:
   - pick the next node based on variables.
10. Return a structured multi-turn result.

Expected output shape:

```js
{
  "status": "completed",
  "traceId": "...",
  "workflowId": "mvp_tipo_flow",
  "stage": "completed",
  "gatewayStatus": { },
  "selectedFile": { },
  "pageState": { },
  "workflowRun": {
    "status": "completed",
    "visitedNodeIds": ["prompt_1", "extract_tipo", "decision_tipo", "prompt_tipo_1", "end"],
    "variables": { "tipo": "tipo_1" },
    "turns": [ ],
    "extractions": [ ],
    "decisions": [ ]
  },
  "error": null
}
```

## Success criteria

- New message type exists in `core/constants/messageTypes.js`:
  - `CONDITIONAL_WORKFLOW_RUN: "AUTODIPSIK_CONDITIONAL_WORKFLOW_RUN"`
- `core/constants.js` still merges the new type into `NewSiteCore.MESSAGE_TYPES`.
- New background workflow exists, for example:
  - `background/workflows/deepseekConditionalWorkflow.js`
- The workflow attaches to:
  - `NewSiteBackground.DeepSeekConditionalWorkflow`
- `background-main.js` loads:
  - `background/workflows/deepseekPromptTurnRunner.js`
  - `background/workflows/deepseekConditionalWorkflow.js`
  before message handlers.
- `background/messageHandlers/automationHandlers.js` exposes:
  - `runConditionalWorkflow(message)`
- `background/messageRouter.js` routes:
  - `MESSAGE_TYPES.CONDITIONAL_WORKFLOW_RUN`
- The runner reuses existing services:
  - `GatewayClient`
  - `GatewayFileService`
  - `DeepSeekTabService`
  - `ConditionalWorkflowEngine`
  - `DeepSeekPromptTurnRunner`
- The runner does not duplicate the entire one-click workflow implementation.
- The runner emits telemetry for:
  - conditional workflow started
  - node started
  - node completed
  - node failed
  - conditional workflow completed
  - conditional workflow failed
- Existing one-click automation still works.

## How to verify

1. Reload the extension.
2. Check service worker globals:

```js
Boolean(NewSiteBackground.DeepSeekConditionalWorkflow)
```

Expected result:

```js
true
```

3. Check message type:

```js
NewSiteCore.MESSAGE_TYPES.CONDITIONAL_WORKFLOW_RUN
```

Expected result:

```js
"AUTODIPSIK_CONDITIONAL_WORKFLOW_RUN"
```

4. Run a full conditional workflow manually through `chrome.runtime.sendMessage(...)` using the sample definition.

Use a first prompt that forces an easy deterministic regex response, for example:

```text
Analyze the Excel briefly. At the end, include exactly one marker: [[TIPO: tipo_1]]
```

Expected result:

- `status === "completed"`
- `workflowRun.variables.tipo === "tipo_1"`
- `workflowRun.visitedNodeIds` includes `prompt_tipo_1`
- `workflowRun.visitedNodeIds` does not include `prompt_tipo_2`
- At least two prompt turns have captured responses.

5. Run the same workflow but make the first prompt instruct DeepSeek to output `[[TIPO: tipo_2]]`.

Expected result:

- `workflowRun.variables.tipo === "tipo_2"`
- `workflowRun.visitedNodeIds` includes `prompt_tipo_2`
- `workflowRun.visitedNodeIds` does not include `prompt_tipo_1`

6. Run existing one-click automation.

Expected result:

- No regression.

## Observable failure signals

- New message type is undefined in sidepanel or background.
- Message router returns `UNSUPPORTED_MESSAGE`.
- Workflow fails before prompt 1 with missing gateway selection even though prompt 1 does not require attachment.
- Workflow re-attaches the Excel for every follow-up prompt when nodes set `attachFile: false`.
- Regex extraction cannot find the previous prompt response.
- Branching always follows fallback despite a valid extraction.
- One-click automation breaks after adding the new route.

## Files/components involved

Expected files to create or edit:

- Create:
  - `background/workflows/deepseekConditionalWorkflow.js`
- Edit:
  - `core/constants/messageTypes.js`
  - `core/constants/telemetryEvents.js`
  - `background-main.js`
  - `background/messageHandlers/automationHandlers.js`
  - `background/messageRouter.js`

Expected dependencies to use:

- `core/contracts/conditionalWorkflowContracts.js`
- `core/workflow/conditionalWorkflowEngine.js`
- `background/workflows/deepseekPromptTurnRunner.js`
- `background/services/gatewayFileService.js`
- `background/services/deepseekTabService.js`

Do not edit in this phase:

- Sidepanel UI
- Python gateway writer
- Existing `deepseekOneClickWorkflow.js`, unless only adding shared constants or non-invasive compatibility.

## Preconditions before implementation

- Phase 5 is complete and verified.
- `DeepSeekPromptTurnRunner.runTurn(...)` works for both:
  - file-attached turn
  - prompt-only turn
- Existing one-click automation works.
- Confirm the message router handler map still lives in `background/messageRouter.js`.
- Confirm automation handlers still live in `background/messageHandlers/automationHandlers.js`.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- Message routing has been replaced by a different architecture.
- The runner cannot access `ConditionalWorkflowEngine` from background.
- The prompt turn runner cannot reliably capture responses.
- The repo already has a conditional workflow runner with a different API.
- DeepSeek requires a new chat per prompt and cannot support follow-up prompt-only turns in the same conversation.

## Phase scope limit

Do not implement multi-turn JSON saving in this phase. Return the full workflow result to the caller only.
