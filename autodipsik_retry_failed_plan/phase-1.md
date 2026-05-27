# Phase 1 — Make batch runs continue after per-file failures from the sidepanel

## Single objective

Change the sidepanel batch execution path so that when more than one Excel file is selected, the batch workflow runs with `continueOnError: true`.

## Repository alignment

Relevant current behavior found in the repo:

- `background/workflows/deepseekBatchConditionalWorkflow.js` normalizes input with `continueOnError: false` by default.
- In the same file, when an item fails and `input.continueOnError` is false, the batch returns immediately with `status: "failed"`.
- `sidepanel/automationTester/automationRunOrchestrator.js` forwards `continueOnError` only if `input.continueOnError === true`.
- `sidepanel/automationTester/automationTester.controller.js` calls `orchestrator.runConditionalWorkflowBatch({ definition, selectedFiles })` without passing `continueOnError`.

## Expected behavior

When the user selects multiple Excel files and starts the workflow:

- If one file fails, processing continues with the next selected file.
- The final batch result includes all attempted files in `results`.
- `completedCount` and `failedCount` reflect the whole batch.
- The final status may remain `failed` when at least one file failed, but the run should not stop early.

## Success criteria

- `runConditionalWorkflowBatch` is called with `continueOnError: true` from the normal multi-file sidepanel run path.
- Existing single-file workflow behavior is unchanged.
- Existing batch background logic remains mostly unchanged unless a tiny guard is needed.
- A batch with 3 files where file 2 fails still attempts file 3.
- The batch summary shows `totalCount: 3`, `results.length: 3`, and `failedCount: 1`.

## How to verify

Manual verification:

1. Start the Python gateway.
2. Open the extension sidepanel Automation Tester.
3. Select multiple Excel files.
4. Use a workflow or test condition likely to fail for one file.
5. Run the conditional workflow.
6. Confirm the batch summary lists every selected file, not only files before the first error.
7. Confirm a toast/message does not imply the user must reload the extension to continue.

Code-level verification:

- Inspect `sidepanel/automationTester/automationTester.controller.js` and confirm the batch call passes `continueOnError: true`.
- Inspect `sidepanel/automationTester/automationRunOrchestrator.js` and confirm the flag is forwarded to `CONDITIONAL_WORKFLOW_BATCH_RUN`.
- Inspect `background/workflows/deepseekBatchConditionalWorkflow.js` and confirm the loop continues after failed item results when `continueOnError` is true.

## Observable failure signals

- Batch result contains fewer `results` than selected files when one item fails.
- Toast says the batch stopped on first failure.
- `failedCount` increments but later files are not attempted.
- Telemetry emits `CONDITIONAL_WORKFLOW_BATCH_FAILED` immediately after the first item failure even though the sidepanel intended a continue-on-error batch.

## Files/components involved

Primary:

- `sidepanel/automationTester/automationTester.controller.js`
- `sidepanel/automationTester/automationRunOrchestrator.js`
- `background/workflows/deepseekBatchConditionalWorkflow.js`

Secondary for verification only:

- `sidepanel/automationTester/automationTester.sections.js`
- `background/workflows/deepseekBatchItemRunner.js`

## Preconditions before implementation

- Confirm the current sidepanel still determines batch mode with `selectedFiles.length > 1`.
- Confirm `continueOnError` still exists in `DeepSeekBatchConditionalWorkflow.normalizeInput`.
- Confirm the orchestrator still has `runConditionalWorkflowBatch(input)`.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- `continueOnError` no longer exists in the background batch workflow.
- Batch execution has moved out of `deepseekBatchConditionalWorkflow.js`.
- The sidepanel no longer calls `runConditionalWorkflowBatch` from `automationTester.controller.js`.
- The real failure is caused by browser tab/window teardown that prevents later items from opening, not by `continueOnError` being false.
