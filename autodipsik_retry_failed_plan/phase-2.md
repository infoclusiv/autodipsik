# Phase 2 — Add a failed-file queue derived from batch results

## Single objective

Persist the failed files from the most recent batch result in sidepanel state so the UI can later retry only those files.

## Expected behavior

After a multi-file batch finishes:

- The sidepanel state contains a list of failed files derived from `batchRunResult.results`.
- Each failed item retains enough metadata to rerun it: at minimum `fileId`, `name`, `extension`, and original batch `index` when available.
- The failed-file queue is cleared when a new file selection happens or a new full batch starts.
- Successful files are not included in the failed-file queue.

## Success criteria

- `AutomationTesterStore.state` includes a dedicated field such as `failedBatchFiles` or `retryableFailedFiles` initialized to `[]`.
- `automationTester.controller.js` computes failed files after receiving a batch result.
- Failed files are extracted only from result items where `item.status === "failed"` and `item.selectedFile` exists.
- Selecting a new single file or a new batch of files clears the failed-file queue.
- Starting a new full batch clears the previous failed-file queue before the new response is applied.

## How to verify

Manual verification:

1. Run a batch with at least one failing file and at least one successful file.
2. Inspect the sidepanel state through DevTools or temporary logs if needed.
3. Confirm the failed-file queue contains only failed files.
4. Select a new batch of files.
5. Confirm the failed-file queue resets to empty.

Code-level verification:

- Confirm state initialization exists in `sidepanel/automationTester/automationTester.store.js`.
- Confirm the controller has a small helper function that derives failed files from `response.results`.
- Confirm no background or Python code was changed in this phase.

## Observable failure signals

- Retry queue includes successful files.
- Retry queue is empty after a failed batch even though `failedCount > 0`.
- Retry queue persists after selecting a different file batch.
- Queue items lack `fileId`, making retry impossible without reopening the file picker.

## Files/components involved

Primary:

- `sidepanel/automationTester/automationTester.store.js`
- `sidepanel/automationTester/automationTester.controller.js`

Secondary:

- `sidepanel/automationTester/automationTester.sections.js` only if minimal UI visibility is needed, but avoid adding the retry button in this phase unless necessary for verification.

## Preconditions before implementation

- Confirm batch results still have shape `{ results: [{ status, selectedFile, error, index }] }` from `background/workflows/deepseekBatchConditionalWorkflow.js`.
- Confirm `automationTester.controller.js` still receives the batch response and assigns it to `store.batchRunResult`.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- Batch result items do not include `selectedFile`.
- `selectedFile.fileId` is not stable after the batch completes.
- The sidepanel store has been replaced by a different state management pattern.
- The failed-file list must survive extension reloads; persistence is out of scope for this phase and should be planned separately.
