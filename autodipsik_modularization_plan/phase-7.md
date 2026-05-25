# Phase 7 — Extract batch conditional workflow item runner

## Objective

Move per-file batch item execution out of `deepseekBatchConditionalWorkflow.js` into a focused item-runner module.

## Expected behavior

Batch execution remains sequential and unchanged:
- First file uses an ensured ready DeepSeek tab.
- Later files open fresh ready tabs in the same/base window when possible.
- Each file is activated through gateway select-by-id before running.
- Each item delegates into `DeepSeekConditionalWorkflow.run(...)`.
- `continueOnError` behavior remains unchanged.

## Success criteria

- `deepseekBatchConditionalWorkflow.js` owns batch-level validation, counts, events, and final response.
- New item runner owns one selected-file execution.
- Response shape remains unchanged:
  - `status`
  - `traceId`
  - `workflowId`
  - `batchId`
  - `totalCount`
  - `completedCount`
  - `failedCount`
  - `results`
  - `error`
- Item result shape remains unchanged:
  - `index`
  - `selectedFile`
  - `tabId`
  - `status`
  - `traceId`
  - `workflowRunJsonSave`
  - `workflowAhkFileSave`
  - `error`

## How to verify

1. Select two or more Excel files.
2. Run a batch conditional workflow.
3. Confirm:
   - first file executes
   - second file opens/uses a fresh ready tab
   - results array contains one entry per file
   - completed/failed counts are correct
4. Force one item failure with `continueOnError: false` and confirm batch stops.
5. Force one item failure with `continueOnError: true` if UI/path supports it and confirm batch continues.

## Observable failure signals

- Batch only processes first file.
- All files use the wrong selected file.
- `UNKNOWN_SELECTED_FILE_ID`.
- `results[index].selectedFile` missing.
- `failedCount` or `completedCount` incorrect.
- Fresh DeepSeek tabs fail to open after first item.
- `batchId` missing from telemetry/result.

## Files/components involved

- New file, suggested: `background/workflows/deepseekBatchItemRunner.js`
- `background/workflows/deepseekBatchConditionalWorkflow.js`
- `background-main.js`
- `background/services/gatewayFileService.js`
- `background/services/deepseekTabService.js`
- `background/workflows/deepseekConditionalWorkflow.js`

## Preconditions before implementation

- Confirm current batch loop is still inside `deepseekBatchConditionalWorkflow.js`.
- Confirm `DeepSeekConditionalWorkflow.run(...)` signature remains stable.
- Confirm `GatewayFileService.selectFileById(...)` still returns active selected file metadata.
- Confirm `DeepSeekTabService.ensureReady(...)` and `openFreshReady(...)` still exist.

## Implementation guidance

- Suggested export: `NewSiteBackground.DeepSeekBatchItemRunner.runItem(options)`.
- Options should include:
  - `index`
  - `sourceSelectedFile`
  - `workflowDefinition`
  - `workflowId`
  - `input`
  - `baseWindowId`
  - `isFirstItem`
- Return:
  - item result
  - updated `baseWindowId`
  - raw workflow result
  - error if failed
- Keep batch-level telemetry in batch module unless the item runner already has clear item telemetry requirements.
- Do not change batch execution from sequential to parallel.

## Stop conditions if the plan does not match the real codebase

Stop if:

- Batch execution is no longer sequential.
- The item execution logic already lives in another module.
- The extraction would require changing `DeepSeekConditionalWorkflow.run(...)`.
- Tab service APIs have changed.
