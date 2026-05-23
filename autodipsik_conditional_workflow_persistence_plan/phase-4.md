# Phase 4 — Remove the legacy single-prompt UI from Automation Tester

## Single objective

Remove the user-facing legacy single-prompt controls from the side panel so the normal user workflow is conditional-workflow-only.

## Expected behavior

After this phase:

- The side panel no longer shows the legacy `Prompt` textarea.
- The side panel no longer shows the legacy `Run automation` button.
- The side panel no longer shows the legacy `Run dry run` button.
- The visible primary run action is `Run conditional workflow`.
- Conditional workflow JSON persistence from Phases 2 and 3 still works.
- Conditional workflow execution still works.
- Diagnostic and support actions that are not single-prompt execution may remain, for example:
  - Select Excel File
  - Open Workflow Lab
  - Export Causal Report
  - Connect Gateway
  - Disconnect Gateway
  - Open DeepSeek
  - Detect page state
- No background message route removal is done in this phase. That is Phase 5.

## Success criteria

- `sidepanel/automationTester/automationTester.render.js` no longer renders:
  - `automation-prompt-text`
  - `run-automation`
  - `run-dry-run`
  - the `Prompt` card
- `sidepanel/automationTester/automationTester.controller.js` no longer binds click handlers for removed DOM ids.
- The controller no longer depends on `store.promptText` for user-facing execution.
- The controller keeps the conditional workflow path intact:
  - collect visible conditional workflow text
  - parse JSON
  - send `CONDITIONAL_WORKFLOW_RUN` through `AutomationRunOrchestrator.runConditionalWorkflow(...)`
- `sidepanel/automationTester/automationRunOrchestrator.js` may remove `runOneClick(...)` from its public API if no side panel code uses it after this phase.
- Do not remove `MESSAGE_TYPES.RUN_AUTOMATION` in this phase.
- Do not remove `background/workflows/deepseekPromptTurnRunner.js` in this phase.

## How to verify

1. Load/reload the unpacked extension.

2. Open the side panel and go to Automation Tester.

3. Confirm the UI does not show:
   - Prompt text textarea
   - Run automation button
   - Run dry run button

4. Confirm the UI still shows:
   - Conditional workflow JSON textarea
   - Load sample workflow
   - Run conditional workflow
   - Select Excel File
   - Open Workflow Lab
   - Export Causal Report

5. Open DevTools console for the side panel.

   Expected: no errors such as:
   - `Cannot set properties of null (setting 'onclick')`
   - `Cannot read properties of null`

6. Paste or load a valid conditional workflow JSON and click `Run conditional workflow`.

   Expected: the controller sends `CONDITIONAL_WORKFLOW_RUN`, not `AUTOMATION_ONE_CLICK_RUN`.

7. Verify persistence still works by closing and reopening the side panel.

8. Run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/verify-cleanup.ps1
   ```

9. Search active code references:

   ```powershell
   git grep -n "runOneClick\|AUTOMATION_ONE_CLICK_RUN\|automation-prompt-text\|run-automation\|run-dry-run" -- sidepanel
   ```

   Expected: no sidepanel references to removed legacy UI paths. If `AUTOMATION_ONE_CLICK_RUN` remains in background files, that is acceptable until Phase 5.

## Observable failure signals

- Side panel is blank or partially rendered.
- Console errors appear because event binding still targets removed DOM elements.
- `Run conditional workflow` button stops responding.
- The conditional workflow textarea no longer persists.
- The side panel still exposes a single-prompt execution path.
- The implementation removes low-level `RUN_AUTOMATION` and breaks conditional prompt nodes.

## Files/components involved

- `sidepanel/automationTester/automationTester.render.js`
- `sidepanel/automationTester/automationTester.controller.js`
- `sidepanel/automationTester/automationTester.store.js`
- `sidepanel/automationTester/automationRunOrchestrator.js`
- `sidepanel/sidepanel.html` only if script references need adjustment, but avoid unnecessary changes.

## Preconditions before implementation

- Phase 1, Phase 2, and Phase 3 must be implemented and verified.
- Conditional workflow execution must work before removing legacy UI controls.
- Confirm which buttons are diagnostic/support controls versus legacy single-prompt controls.
- Confirm no other sidepanel module still calls `AutomationRunOrchestrator.runOneClick(...)`.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- The product owner still needs a single-prompt UI as a diagnostic-only tool.
- `Run automation` has already been repurposed to run conditional workflows.
- The conditional workflow UI depends on `promptText` in a way not visible in the current plan.
- Removing the Prompt card would remove configuration that conditional workflows still require.

## Suggested implementation notes

Make the smallest UI/controller change possible:

1. Remove the Prompt card markup from `automationTester.render.js`.
2. Change the top description to describe conditional workflows only.
3. Remove the legacy `Run automation` button from the main button row.
4. Remove the legacy `Run dry run` button from Advanced Actions.
5. Remove or leave unused `promptText` state only after verifying no active code needs it. Prefer removing it from store if no references remain.
6. Remove controller functions that only support the old UI:
   - `runAutomation(dryRun)`
   - `runAutomationOneClick()`
7. Simplify `collectAutomationInput()` so it only collects selected file metadata and `conditionalWorkflowText`.
8. Remove event bindings for the deleted buttons.
9. If `AutomationRunOrchestrator.runOneClick(...)` has no remaining callers, remove it from that module.

Keep `CONDITIONAL_WORKFLOW_RUN` and its orchestrator path unchanged.
