# Phase 3 — Extract Automation Tester response/input adapters

## Objective

Reduce `automationTester.controller.js` responsibility by moving pure response/state normalization helpers into a small adapter module.

## Expected behavior

Automation Tester UI behavior remains unchanged:
- Gateway connect/disconnect state updates correctly.
- Single file selection updates selected file and gateway status.
- Multiple file selection updates selected files and active selected file.
- Conditional workflow run input is built exactly as before.
- Failed responses still populate `store.lastError` and show toast messages.

## Success criteria

- A new adapter module owns pure state/input helpers.
- Controller still owns event binding and high-level orchestration.
- Existing public UI controls still work.
- No change to background message payload shapes.
- No change to `AutomationRunOrchestrator`.

## How to verify

1. Load sidepanel and Automation Tester.
2. Connect/disconnect gateway.
3. Select one file.
4. Select multiple files.
5. Confirm:
   - gateway status pill updates
   - selected file name updates
   - selected batch list updates
6. Run a conditional workflow smoke test if DeepSeek is available.
7. Trigger invalid JSON and confirm parse error still appears.
8. Trigger a gateway failure and confirm `lastError` still renders.

## Observable failure signals

- Buttons stop responding.
- `store.gatewayStatus`, `store.selectedFile`, or `store.selectedFiles` becomes stale.
- Toasts disappear for errors.
- Conditional workflow sends missing `definition`.
- Batch mode fails to trigger when more than one file is selected.
- Console errors caused by missing adapter exports.

## Files/components involved

- New file, suggested: `sidepanel/automationTester/automationTester.adapters.js`
- `sidepanel/sidepanel.html`
- `sidepanel/automationTester/automationTester.controller.js`
- `sidepanel/automationTester/automationTester.store.js`
- `sidepanel/automationTester/automationRunOrchestrator.js`

## Preconditions before implementation

- Confirm controller still contains helper-like logic:
  - `applyResponse`
  - `collectAutomationInput`
  - repeated gateway response state assignment
- Confirm render module still reads from the same store object.
- Confirm `sidepanel/sidepanel.html` can load a new script between store/orchestrator and controller.

## Implementation guidance

- Suggested namespace: `NewSiteSidepanel.AutomationTesterAdapters`.
- Extract only pure or near-pure logic first:
  - `applyGatewayStatusToStore(store, response)`
  - `applyFileSelectionToStore(store, response)`
  - `applyBatchSelectionToStore(store, response)`
  - `buildConditionalWorkflowInput(store)`
  - `getSelectedFile(store)`
- Keep controller responsible for:
  - sending messages
  - toasts
  - rerender calls
  - DOM event binding
- Avoid modifying `AutomationRunOrchestrator` in this phase.

## Stop conditions if the plan does not match the real codebase

Stop if:

- The controller has already been refactored and these helper responsibilities no longer exist.
- State mutations are spread into the render file.
- The adapter would need to call Chrome APIs directly.
- The phase would require changing background message contracts.
