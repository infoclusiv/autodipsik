# Phase 5 — Add targeted diagnostics and regression checks for continue/retry behavior

## Single objective

Improve observability and verification around batch continuation and retry behavior without changing core workflow logic.

## Expected behavior

The diagnostic trail should make it clear:

- Which batch item failed.
- Whether the batch continued because `continueOnError` was enabled.
- Which files are retryable after the batch.
- Which files were included in a retry run.

## Success criteria

- Telemetry or diagnostic data includes enough context to distinguish full-batch runs from retry-failed runs.
- Retry run data includes retry count or retry mode if a low-risk field can be added through existing input payloads.
- Existing diagnostic patterns are reused; no large logging framework is introduced.
- Manual regression checklist is documented in or near the changed files, or in a small repo doc if the repo already has a diagnostics/testing docs area.

## How to verify

Manual verification:

1. Run a batch where one file fails and later files continue.
2. Export or inspect diagnostics.
3. Confirm the diagnostic evidence shows the failed item and that processing continued.
4. Retry failed files.
5. Confirm diagnostics show a retry run and the subset of retried files.

Code-level verification:

- Inspect telemetry emitted by `deepseekBatchConditionalWorkflow.js` and ensure no misleading “stopped” event is emitted for continue-on-error expected failures.
- Confirm UI toasts and batch summary wording match the actual behavior.
- Confirm no noisy large payloads, such as base64 file contents, are logged.

## Observable failure signals

- Diagnostics say the batch failed/stopped even though later files were processed.
- Retry diagnostics do not identify that the run was a retry.
- File payload base64 or large response bodies are logged.
- Telemetry loses `batchId`, `workflowId`, `traceId`, or failed `fileId` context.

## Files/components involved

Primary candidates:

- `background/workflows/deepseekBatchConditionalWorkflow.js`
- `sidepanel/automationTester/automationTester.controller.js`
- `sidepanel/automationTester/automationTester.sections.js`

Secondary candidates:

- Existing diagnostic/telemetry constants if new event names are truly needed.
- Existing docs under `docs/` if a small manual regression checklist fits the repo conventions.

## Preconditions before implementation

- Phases 1 through 4 are implemented and verified.
- Confirm existing telemetry event constants and diagnostic store conventions before adding or modifying events.
- Prefer reusing existing `CONDITIONAL_WORKFLOW_BATCH_STARTED`, `CONDITIONAL_WORKFLOW_BATCH_COMPLETED`, and item result data before adding new event types.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- Adding diagnostics requires broad changes to telemetry contracts.
- Existing telemetry consumers would break due to new required fields.
- The diagnostic package size would increase significantly.
- The implementation agent cannot verify diagnostics locally.
