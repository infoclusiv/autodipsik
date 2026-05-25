# Phase 4 — Split Automation Tester render into section renderers

## Objective

Modularize `automationTester.render.js` by extracting section-level rendering helpers while preserving identical output structure and element IDs.

## Expected behavior

Automation Tester UI should look and behave the same. All buttons and textareas must retain their existing IDs so `automationTester.controller.js` event binding remains valid.

## Success criteria

- `automationTester.render.js` becomes a composition function.
- Section rendering functions live in a separate module or submodule.
- Existing DOM IDs are unchanged:
  - `automation-select-file`
  - `automation-select-files`
  - `open-workflow-lab`
  - `automation-export-causal-report`
  - `conditional-workflow-json`
  - `load-sample-conditional-workflow`
  - `run-conditional-workflow`
  - `automation-connect-gateway`
  - `automation-disconnect-gateway`
  - `open-target-site`
  - `detect-page-state`
- No controller changes beyond import/load-order adjustments unless necessary.
- Escaping behavior remains centralized and safe.

## How to verify

1. Open Automation Tester.
2. Confirm every card/section still renders:
   - top metrics
   - conditional workflow editor
   - batch run summary
   - selected batch
   - selected file
   - last run summary
   - runtime snapshot
   - execution timeline
   - advanced actions
3. Click each button and confirm event binding works.
4. Type in workflow textarea and confirm draft persistence still works.
5. Confirm no unescaped raw HTML appears from workflow/user values.

## Observable failure signals

- Controller cannot find button IDs after rerender.
- Buttons throw `Cannot set properties of null`.
- Workflow textarea loses text after rerender.
- Batch summary no longer appears.
- Selected files do not render.
- HTML escaping regression appears.

## Files/components involved

- New file, suggested: `sidepanel/automationTester/automationTester.sections.js`
- `sidepanel/automationTester/automationTester.render.js`
- `sidepanel/sidepanel.html`
- `sidepanel/automationTester/automationTester.controller.js`

## Preconditions before implementation

- Confirm `automationTester.render.js` is still one large string renderer.
- Confirm the controller relies on static element IDs after every `render(rootNode)`.
- Confirm no tests depend on exact whitespace of generated HTML.

## Implementation guidance

- Keep `NewSiteSidepanel.AutomationTesterRender.render(root)` as the public entrypoint.
- Suggested namespace: `NewSiteSidepanel.AutomationTesterSections`.
- Extract section functions gradually:
  - `renderHeaderCard`
  - `renderConditionalWorkflowCard`
  - `renderBatchSummaryCard`
  - `renderSelectedBatchCard`
  - `renderSelectedFileCard`
  - `renderLastRunSummaryCard`
  - `renderRuntimeSnapshotCard`
  - `renderExecutionTimelineCard`
  - `renderAdvancedActionsCard`
- Keep `escapeHtml`, `formatDate`, and `renderCompactJson` either in the section module or a tiny shared render utility.
- Do not change CSS class names or DOM IDs.

## Stop conditions if the plan does not match the real codebase

Stop if:

- A later refactor has replaced string rendering with DOM builders.
- DOM IDs have already changed and controller binding was updated elsewhere.
- A section extraction would require changing UI semantics.
