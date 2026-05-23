# Phase 2 — Persist and restore conditional workflow JSON in Automation Tester

## Single objective

Make the side panel Automation Tester conditional workflow textarea restore its last saved JSON draft and save changes automatically.

## Expected behavior

After this phase:

- When the Automation Tester mounts, it loads the persisted conditional workflow draft from `chrome.storage.local`.
- If a draft exists, the `Conditional Workflow MVP` textarea is populated with it.
- When the user types in the conditional workflow textarea, the latest text is saved to persistent storage.
- When the user clicks `Load sample workflow`, the sample JSON is also saved persistently.
- When the user clicks `Run conditional workflow`, the exact text being run is saved before parsing/execution.
- Closing and reopening the side panel preserves the JSON text.
- Reloading the extension preserves the JSON text.
- Closing and reopening Chrome preserves the JSON text.
- Existing conditional workflow execution behavior remains unchanged.

## Success criteria

- `sidepanel/automationTester/automationTester.controller.js` loads `NewSiteCore.ConditionalWorkflowDraftStorage` safely.
- `mount(root)` still renders without requiring callers to `await` it.
- Persisted text is loaded asynchronously and causes a rerender when available.
- The controller does not overwrite a newer in-memory user edit with an older async load result.
- The textarea input event updates `store.conditionalWorkflowText` and persists the draft.
- Persistence is debounced or otherwise safe enough to avoid excessive storage writes on every keystroke, while still saving reliably before run/sample actions.
- Invalid JSON is still saved as text. The user should not lose work just because the JSON is temporarily invalid.
- Existing `runConditionalWorkflow()` parse and execution flow still works.
- No legacy single-prompt removal is done in this phase.

## How to verify

1. Load the unpacked extension.

2. Open the side panel and go to `Automation Tester`.

3. Paste this draft into the conditional workflow textarea:

   ```json
   {
     "flowVersion": 1,
     "workflowId": "draft_persistence_test",
     "startNodeId": "end",
     "nodes": [
       { "id": "end", "type": "end" }
     ]
   }
   ```

4. Close and reopen the side panel.

   Expected: the textarea still contains the same JSON.

5. Reload the extension from `chrome://extensions` and reopen the side panel.

   Expected: the textarea still contains the same JSON.

6. Fully close Chrome, reopen it, reload/open the extension side panel.

   Expected: the textarea still contains the same JSON.

7. Paste intentionally invalid JSON, for example:

   ```json
   { "flowVersion": 1,
   ```

   Close and reopen the side panel.

   Expected: the invalid draft text is still there. It should not be discarded.

8. Click `Run conditional workflow` with invalid JSON.

   Expected: the existing parse error behavior still appears and the text remains persisted.

9. Click `Load sample workflow`, close and reopen the side panel.

   Expected: the sample workflow remains in the textarea.

10. Run:

    ```powershell
    powershell -ExecutionPolicy Bypass -File scripts/verify-cleanup.ps1
    ```

## Observable failure signals

- The textarea is empty after side panel close/reopen.
- The textarea is empty after extension reload or Chrome restart.
- The sample workflow loads visually but is not persisted.
- Invalid JSON text disappears after reload.
- The controller throws `Cannot read properties of null` because `bindEvents()` expects removed/missing elements.
- The side panel boot sequence fails because `mount()` was converted to async in a way that bootstrap does not handle.
- Running a conditional workflow sends an older draft than the text currently visible in the textarea.

## Files/components involved

- `sidepanel/automationTester/automationTester.controller.js`
- `sidepanel/automationTester/automationTester.store.js` only if additional state flags are needed, such as `isConditionalWorkflowDraftLoaded` or `lastSavedAt`.
- `sidepanel/automationTester/automationTester.render.js` only if showing save status is required, but avoid UI changes in this phase unless necessary.
- `core/workflow/conditionalWorkflowDraftStorage.js` from Phase 1.

## Preconditions before implementation

- Phase 1 must be implemented and verified.
- The new draft storage module must be loaded before `automationTester.controller.js` in `sidepanel/sidepanel.html`.
- `automationTester.controller.js` must still have access to `store`, `render`, `Toast`, `messaging`, and `orchestrator` as currently designed.
- The conditional workflow textarea id must still be `conditional-workflow-json`.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- The Automation Tester has been converted to a framework or no longer uses `root.innerHTML` rendering.
- The conditional workflow textarea id has changed and there is no equivalent text input.
- The side panel no longer uses `AutomationTesterController.mount(...)`.
- A separate draft persistence feature already exists and would conflict with the new storage key.

## Suggested implementation notes

A low-risk approach:

1. Add a module-level flag such as `hasLoadedConditionalWorkflowDraft = false`.
2. In `mount(root)`, render as today, then asynchronously call a new `loadConditionalWorkflowDraft()` function.
3. In `loadConditionalWorkflowDraft()`, read the draft from storage. If the user has not already typed in the current session, set `store.conditionalWorkflowText` and rerender.
4. In `bindEvents()`, attach an `input` listener to `conditional-workflow-json`:
   - update `store.conditionalWorkflowText`
   - debounce `saveConditionalWorkflowDraft(store.conditionalWorkflowText)`
5. In `loadSampleConditionalWorkflow()`, save the sample text immediately after updating the store.
6. In `runConditionalWorkflow()`, save the collected text immediately before parsing.

Do not parse or normalize the text before saving. Preserve exact user formatting.
