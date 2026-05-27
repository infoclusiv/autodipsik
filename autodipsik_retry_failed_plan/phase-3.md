# Phase 3 — Show failed files and add a Retry Failed Files button

## Single objective

Expose the failed-file queue in the Automation Tester UI and add a button that the user can click to retry failed files.

## Expected behavior

After a batch completes with failures:

- The Batch Run Summary card clearly shows which files failed.
- A `Retry failed files` button appears only when there are retryable failed files and no workflow is currently running.
- The button is disabled or hidden while a workflow/batch retry is running.
- The UI does not ask the user to reload the extension or reselect files.

## Success criteria

- `sidepanel/automationTester/automationTester.sections.js` renders a retry button inside or near the Batch Run Summary card.
- The button has a stable ID, for example `automation-retry-failed-files`.
- The button is only available when `store.failedBatchFiles.length > 0` or equivalent.
- The failed files are visibly listed using existing `timeline-item`, `stack-blocks`, or similar UI patterns.
- Existing batch summary metrics remain intact.

## How to verify

Manual verification:

1. Run a multi-file batch with at least one failure.
2. Confirm failed files are visible in the Batch Run Summary.
3. Confirm the `Retry failed files` button appears.
4. Run a batch with no failures.
5. Confirm the retry button does not appear.
6. Start a batch run and confirm the retry button is unavailable while running.

Code-level verification:

- Confirm UI rendering reads from the store field created in Phase 2.
- Confirm HTML escaping uses the existing `escapeHtml` helper.
- Confirm the button ID is bound in the controller only after Phase 4, or guarded so missing elements do not throw.

## Observable failure signals

- Button appears when there are no failed files.
- Button remains clickable during a running batch.
- Rendering throws because the button is missing in some states.
- Failed file names are inserted without escaping.

## Files/components involved

Primary:

- `sidepanel/automationTester/automationTester.sections.js`

Secondary:

- `sidepanel/automationTester/automationTester.controller.js` only for guarded binding preparation if needed.
- `sidepanel/automationTester/automationTester.store.js` only if the Phase 2 field name needs adjustment.

## Preconditions before implementation

- Phase 2 is implemented and verified.
- The store has a reliable failed-file queue.
- Existing rendering still uses `AutomationTesterSections.renderBatchSummaryCard(viewModel)`.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- The batch summary card is no longer rendered from `automationTester.sections.js`.
- The view model does not expose the store or failed-file queue.
- A separate UI framework has replaced the string-based rendering approach.
