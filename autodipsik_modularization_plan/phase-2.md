# Phase 2 — Extract shared conditional workflow sample and draft helpers

## Objective

Remove duplicated conditional workflow sample/draft logic from `Automation Tester` and `Workflow Lab` by introducing a shared browser-side module.

## Expected behavior

- Automation Tester still loads, saves, restores, and runs the conditional workflow JSON draft.
- Workflow Lab still loads, saves, restores, and runs the same shared draft.
- `Load sample workflow` produces the same JSON in both surfaces.
- Invalid JSON remains preserved across reopen/reload exactly as before.

## Success criteria

- The sample workflow definition exists in one shared module.
- Shared draft helper logic is available through a stable namespace.
- `automationTester.controller.js` no longer owns a private copy of the sample workflow object.
- `workflowLab.controller.js` no longer owns a private copy of the same sample workflow object.
- Both surfaces still use the existing `ConditionalWorkflowDraftStorage`.
- No storage key changes.

## How to verify

1. Load the extension.
2. Open Automation Tester.
3. Click `Load sample workflow`.
4. Confirm the JSON text matches prior sample structure:
   - `workflowId: "mvp_tipo_flow"`
   - `startNodeId: "prompt_1"`
   - prompt, regex, condition, and end nodes still exist.
5. Close/reopen side panel and confirm the draft remains.
6. Open Workflow Lab and confirm it loads the same draft.
7. Edit the draft in Workflow Lab, reopen Automation Tester, and confirm the edit is visible.
8. Paste invalid JSON and confirm it is preserved after reopening.
9. Run the manual checklist section:
   - `Conditional Workflow Draft Persistence`
   - `Cross-Surface Persistence`

## Observable failure signals

- `SAMPLE_CONDITIONAL_WORKFLOW is not defined`.
- `ConditionalWorkflowDraftStorage` is undefined.
- Automation Tester and Workflow Lab diverge in sample JSON.
- Draft text resets unexpectedly.
- Sidepanel or Workflow Lab throws null-binding errors.
- Existing JSON parse error display stops working.

## Files/components involved

- New file, suggested: `core/workflow/conditionalWorkflowSamples.js`
- New file, suggested: `core/workflow/conditionalWorkflowDraftSession.js`
- `sidepanel/sidepanel.html`
- `workflowLab/workflowLab.html`
- `sidepanel/automationTester/automationTester.controller.js`
- `workflowLab/workflowLab.controller.js`
- Existing: `core/workflow/conditionalWorkflowDraftStorage.js`

## Preconditions before implementation

- Confirm both controllers still duplicate `SAMPLE_CONDITIONAL_WORKFLOW`.
- Confirm both controllers still use `ConditionalWorkflowDraftStorage`.
- Confirm `workflowLab/workflowLab.html` loads core scripts before `workflowLab.controller.js`.

## Implementation guidance

- Use IIFE/global style.
- Suggested exports:
  - `NewSiteCore.ConditionalWorkflowSamples.getSampleTipoFlow()`
  - `NewSiteCore.ConditionalWorkflowDraftSession.create(options)`
- Keep draft debounce timing at `250ms`.
- Keep session-version guard semantics.
- Add new script tags before both controllers that consume the shared module.
- Do not change workflow JSON schema or sample node IDs.

## Stop conditions if the plan does not match the real codebase

Stop if:

- Automation Tester and Workflow Lab no longer share the same draft storage.
- The sample workflow has already been moved.
- `workflowLab/workflowLab.html` does not exist or does not use script tags.
- The shared module would need asynchronous loading or bundling.
