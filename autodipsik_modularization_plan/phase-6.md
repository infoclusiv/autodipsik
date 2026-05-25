# Phase 6 — Extract DeepSeek conditional workflow support helpers

## Objective

Reduce `deepseekConditionalWorkflow.js` size by moving support helpers into a dedicated module without changing the `run(message)` orchestration contract.

## Expected behavior

- `NewSiteBackground.DeepSeekConditionalWorkflow.run(message)` behaves exactly as before.
- Single conditional workflow execution still validates definition, ensures gateway, selects file when needed, ensures DeepSeek tab, detects page state, runs prompt turns, saves workflow JSON, and saves AHK output.
- Failure results still include `status: "failed"`, `traceId`, `workflowId`, `stage`, `gatewayStatus`, `selectedFile`, `pageState`, `workflowRun`, and structured `error`.

## Success criteria

- Helper responsibilities are moved out of the main workflow file:
  - `workflowRequiresFileAttachment`
  - definition summary builder
  - input normalization
  - stage runner/telemetry support, if feasible
  - persistence helper wrappers, if not already covered by Phase 5
- `deepseekConditionalWorkflow.js` remains the orchestration owner.
- No changes to `DeepSeekConditionalWorkflow.run(...)` external API.
- Existing batch workflow can still delegate into single-run workflow.

## How to verify

1. Load the extension.
2. Run one valid conditional workflow.
3. Confirm:
   - workflow status completed
   - visited nodes render
   - variables render
   - decisions render
   - workflow JSON save still works
   - AHK save still works when tagged response exists
4. Run a workflow with invalid definition and confirm structured failure.
5. Run a file-attaching workflow without selecting a file and confirm the expected structured error.

## Observable failure signals

- `DeepSeekConditionalWorkflow.run` undefined.
- Batch workflow fails because single workflow run signature changed.
- Workflow ID missing in telemetry or output.
- `failedStage` becomes less precise.
- `workflowRunJsonSave` or `workflowAhkFileSave` disappears.
- Errors lose `expected` or `actual`.

## Files/components involved

- New file, suggested: `background/workflows/deepseekConditionalWorkflowSupport.js`
- `background/workflows/deepseekConditionalWorkflow.js`
- `background-main.js`
- `background/workflows/deepseekBatchConditionalWorkflow.js`
- `background/workflows/deepseekPromptTurnRunner.js`

## Preconditions before implementation

- Confirm `deepseekConditionalWorkflow.js` still owns a public `run(message)` method.
- Confirm batch workflow still calls `DeepSeekConditionalWorkflow.run(...)`.
- Confirm `background-main.js` load order can place support module before `deepseekConditionalWorkflow.js`.

## Implementation guidance

- Use namespace: `NewSiteBackground.DeepSeekConditionalWorkflowSupport`.
- Extract helpers first; keep orchestration logic readable in the original file.
- Do not split `run(message)` itself in this phase unless extraction is trivial and low-risk.
- Keep `MODULE_FILE` attribution meaningful. If helper errors now originate in support module, decide whether to preserve old probable cause or use support module only for helper-specific errors.

## Stop conditions if the plan does not match the real codebase

Stop if:

- `deepseekConditionalWorkflow.js` was already split.
- Support helper extraction creates circular dependency with batch or prompt-turn runner.
- The workflow currently has behavior not captured in the support helpers.
