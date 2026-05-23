# Phase 3 — Persist and restore conditional workflow JSON in Workflow Lab

## Single objective

Apply the same persistent conditional workflow draft behavior to `workflowLab`, using the same storage key as Automation Tester.

## Expected behavior

After this phase:

- Workflow Lab loads the same persisted conditional workflow JSON draft used by Automation Tester.
- Workflow Lab saves textarea edits to the same persistent storage key.
- Closing and reopening Workflow Lab preserves the JSON text.
- Reloading the extension and reopening Workflow Lab preserves the JSON text.
- A draft saved in Automation Tester appears in Workflow Lab when Workflow Lab is opened afterward.
- A draft saved in Workflow Lab appears in Automation Tester when the side panel is opened afterward.
- Existing Workflow Lab conditional run behavior remains unchanged.

## Success criteria

- `workflowLab/workflowLab.html` loads all required storage scripts in the correct order.
- `workflowLab/workflowLab.controller.js` safely uses `NewSiteCore.ConditionalWorkflowDraftStorage`.
- The `workflow-lab-json` textarea is hydrated from storage on mount.
- The textarea input event updates `store.conditionalWorkflowText` and persists the draft.
- `loadSampleWorkflow()` persists the sample JSON immediately.
- `runConditionalWorkflow()` persists the visible text before parsing and sending.
- No live two-window sync is required in this phase; persistence on open/reopen is enough.
- No legacy single-prompt removal is done in this phase.

## How to verify

1. Open the side panel Automation Tester.

2. Paste a unique draft into the conditional workflow textarea:

   ```json
   {
     "flowVersion": 1,
     "workflowId": "cross_surface_sidepanel_to_lab",
     "startNodeId": "end",
     "nodes": [
       { "id": "end", "type": "end" }
     ]
   }
   ```

3. Open Workflow Lab from the side panel.

   Expected: Workflow Lab shows the same draft text.

4. Change the Workflow Lab textarea to a different unique `workflowId`, for example `cross_surface_lab_to_sidepanel`.

5. Close Workflow Lab.

6. Close and reopen the side panel.

   Expected: Automation Tester shows the updated Workflow Lab draft.

7. Reload the extension and open Workflow Lab directly from the side panel.

   Expected: the updated draft remains available.

8. Click `Load sample workflow` in Workflow Lab, close and reopen Workflow Lab.

   Expected: the sample workflow remains in the textarea.

9. Run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/verify-cleanup.ps1
   ```

## Observable failure signals

- Workflow Lab console shows `NewSiteCore.Storage is undefined`.
- Workflow Lab console shows `NewSiteCore.ConditionalWorkflowDraftStorage is undefined`.
- Workflow Lab renders but the textarea is empty after reopening.
- Workflow Lab saves a different key than Automation Tester, so drafts do not carry across surfaces.
- The run button sends stale JSON after the user edits the textarea.
- The existing gateway buttons or run result display stop working.

## Files/components involved

- `workflowLab/workflowLab.html`
- `workflowLab/workflowLab.controller.js`
- `workflowLab/workflowLab.store.js` only if extra draft-related state is needed.
- `workflowLab/workflowLab.render.js` only if showing save status is necessary; avoid UI changes if not needed.
- `core/workflow/conditionalWorkflowDraftStorage.js` from Phase 1.

## Preconditions before implementation

- Phase 1 and Phase 2 must be implemented and verified.
- `workflowLab/workflowLab.html` must include `../core/config.js` before `../core/storage.js`.
- The workflow lab textarea id must still be `workflow-lab-json`.
- `WorkflowLab.Controller.mount(...)` must still be called from `workflowLab/bootstrap.js`.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- Workflow Lab has been removed or replaced by a different editor.
- Workflow Lab is no longer intended to share drafts with Automation Tester.
- The workflow lab controller no longer has a clear mount lifecycle where hydration can be added.
- Script loading order prevents safely using `NewSiteCore.Storage` without larger architecture changes.

## Suggested implementation notes

Mirror the Automation Tester implementation, but keep it local to Workflow Lab:

- Add a small `loadConditionalWorkflowDraft()` function.
- Add a small `saveConditionalWorkflowDraft(text)` function.
- Add a module-level debounce timer for textarea input.
- Save immediately in `loadSampleWorkflow()` and `runConditionalWorkflow()`.
- Do not parse or format the draft before saving.

Avoid introducing a cross-window live sync listener unless a real requirement appears. Live sync is higher-risk and not required to satisfy persistence after close/reopen.
