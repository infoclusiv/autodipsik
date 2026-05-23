# phase-9.md

# Phase 9 — Add a full-window Workflow Lab shell without replacing the stable sidepanel path

## Single objective

Add a full-window Workflow Lab entry point for the conditional workflow MVP while preserving the existing sidepanel Automation Tester.

This phase prepares the future visual workflow experience without forcing a large UI rewrite.

## Expected behavior

A user can open a full-window extension page for workflow execution.

Recommended MVP behavior:

- Add a button in Automation Tester:
  - `Open Workflow Lab`
- The button opens:
  - `workflowLab/workflowLab.html`
- The new page uses the full browser window or a maximized popup.
- The Workflow Lab page initially exposes the same JSON-based conditional workflow MVP from Phase 8.
- It does not need visual node editing yet.

Suggested opening logic:

```js
chrome.windows.create({
  url: chrome.runtime.getURL("workflowLab/workflowLab.html"),
  type: "popup",
  state: "maximized",
  focused: true
});
```

Avoid replacing the sidepanel tab click behavior until the full-window page is stable. After this phase is verified, a later enhancement may change the `Automation Tester` tab click to open the full-window Workflow Lab directly.

## Success criteria

- New files exist, for example:
  - `workflowLab/workflowLab.html`
  - `workflowLab/workflowLab.css`
  - `workflowLab/workflowLab.store.js`
  - `workflowLab/workflowLab.render.js`
  - `workflowLab/workflowLab.controller.js`
  - `workflowLab/bootstrap.js`
- The page loads required core and shared modules in correct order:
  - message type constants
  - constants facade
  - errors/contracts if local validation is used
  - shared Chrome messaging helper or equivalent
- The page can send:
  - `MESSAGE_TYPES.CONDITIONAL_WORKFLOW_RUN`
- Automation Tester includes an `Open Workflow Lab` button.
- Clicking the button opens a full-window or maximized extension page.
- Running a conditional workflow from Workflow Lab works the same as from sidepanel.
- Existing sidepanel Automation Tester remains usable.

## How to verify

1. Reload the extension.
2. Open sidepanel Automation Tester.
3. Click `Open Workflow Lab`.

Expected result:

- A new extension window opens.
- It is focused.
- It has a wide/full-window layout.

4. Paste or load the sample workflow JSON.
5. Run conditional workflow.

Expected result:

- Same behavior as Phase 8:
  - workflow runs
  - variables display
  - turns display
  - saved workflow JSON filename displays

6. Return to sidepanel and run existing one-click automation.

Expected result:

- Sidepanel still works.

## Observable failure signals

- `chrome.windows.create` is undefined or blocked.
- The new page fails to load scripts due to wrong relative paths.
- `NewSiteCore.MESSAGE_TYPES` is undefined in Workflow Lab.
- Workflow Lab can render but cannot send messages.
- Sidepanel Automation Tester stops mounting.
- Existing Automation Tester tab is replaced before Workflow Lab is stable.

## Files/components involved

Expected files to create:

- `workflowLab/workflowLab.html`
- `workflowLab/workflowLab.css`
- `workflowLab/workflowLab.store.js`
- `workflowLab/workflowLab.render.js`
- `workflowLab/workflowLab.controller.js`
- `workflowLab/bootstrap.js`

Expected files to edit:

- `sidepanel/automationTester/automationTester.render.js`
- `sidepanel/automationTester/automationTester.controller.js`

Potentially edit only if needed:

- `manifest.json`
  - Usually extension pages do not need to be listed as web-accessible resources when opened by the extension itself.
  - Validate this against the actual Chrome extension behavior before changing the manifest.

Do not edit in this phase:

- Background conditional workflow runtime
- Python gateway
- DeepSeek content automation

## Preconditions before implementation

- Phase 8 is complete and verified.
- Conditional workflow can run from sidepanel.
- The extension has permission/API access needed to call `chrome.windows.create`.
- Confirm the project does not have a CSP issue with the new HTML file and script layout.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- Chrome blocks opening the extension page in a new window due to manifest/CSP/runtime constraints.
- The extension UI has been moved to a framework/build system.
- Sidepanel modules cannot be reused or copied without major refactoring.
- Full-window launch would break sidepanel stability.
- The user explicitly decides the MVP should replace the sidepanel tab click immediately instead of adding a safe launch button.

## Phase scope limit

Do not build the visual workflow canvas in this phase. This phase is only the full-window shell for the already functional JSON-based workflow MVP.
