# Phase 4 — Implement retry execution for failed files only

## Single objective

Wire the `Retry failed files` button so it reruns the same conditional workflow definition only for files stored in the failed-file queue.

## Expected behavior

When the user clicks `Retry failed files`:

- The current workflow JSON is read from the textarea/store, parsed, and saved using the same draft behavior as the normal run path.
- The retry run calls `runConditionalWorkflowBatch` with `selectedFiles` equal only to the failed-file queue.
- The retry run uses `continueOnError: true` so if one retry fails again, remaining retry files are still attempted.
- The extension does not open the file picker again.
- The new batch result replaces or clearly updates `store.batchRunResult`.
- The failed-file queue is recomputed from the retry result, so files that succeed disappear and files that fail again remain retryable.

## Success criteria

- `automationTester.controller.js` has a dedicated function such as `retryFailedBatchFiles()`.
- The retry function reuses existing JSON validation and draft-save patterns as much as possible without large refactoring.
- The retry function guards against empty failed-file queue.
- The retry function sets `store.isRunningBatchConditionalWorkflow = true` while running and resets it afterward.
- The retry function updates `store.batchRunResult`, `store.lastRunSummary`, `store.lastError`, and gateway status snapshot consistently with normal batch runs.
- Toast messages distinguish retry completion from full-batch completion.

## How to verify

Manual verification:

1. Select 3 Excel files.
2. Run the batch and cause 1 or 2 files to fail.
3. Confirm failed files are listed and retry button appears.
4. Click `Retry failed files`.
5. Confirm only failed files are retried.
6. Confirm successful retried files are removed from the failed-file queue.
7. Confirm still-failing retried files remain available for another retry.
8. Confirm no file picker appears during retry.

Code-level verification:

- Confirm the retry call passes only failed files.
- Confirm `continueOnError: true` is passed to the orchestrator.
- Confirm the controller binds `automation-retry-failed-files` safely.
- Confirm single-file normal run remains unchanged.

## Observable failure signals

- Retry processes all originally selected files instead of only failed files.
- Retry opens the file picker.
- Retry stops on the first failed retry item.
- Retry uses stale workflow JSON after the user edits the textarea.
- `isRunningBatchConditionalWorkflow` remains true after an exception.
- Failed-file queue does not update after retry.

## Files/components involved

Primary:

- `sidepanel/automationTester/automationTester.controller.js`
- `sidepanel/automationTester/automationRunOrchestrator.js`

Secondary:

- `sidepanel/automationTester/automationTester.sections.js`
- `sidepanel/automationTester/automationTester.store.js`

## Preconditions before implementation

- Phases 1, 2, and 3 are implemented and verified.
- Failed files have valid gateway `fileId` values.
- The Python gateway still has the selected files in memory; this phase does not add persistence across extension or gateway restarts.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- Retrying by `fileId` fails because the Python gateway loses selected-file state after the first batch.
- The current workflow JSON is not available from the textarea/store at retry time.
- The existing controller structure makes adding a retry function require large refactoring.
- Product requirement changes to persist failed files across reloads; that is outside this phase.
