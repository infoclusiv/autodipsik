# phase-8.md

# Phase 8 — Add a minimal JSON-based conditional workflow UI to Automation Tester

## Single objective

Expose the conditional workflow MVP through the existing Automation Tester UI using a JSON definition textarea and a run button.

This phase should not build a visual node canvas yet.

## Expected behavior

Automation Tester gains a new section, for example:

```text
Conditional Workflow MVP
[Load sample workflow]
[Run conditional workflow]
<textarea id="conditional-workflow-json"></textarea>
```

User flow:

1. User selects an Excel file using existing button.
2. User loads or pastes a conditional workflow JSON.
3. User clicks `Run conditional workflow`.
4. UI sends `MESSAGE_TYPES.CONDITIONAL_WORKFLOW_RUN`.
5. UI displays:
   - status
   - trace ID
   - workflow ID
   - visited nodes
   - extracted variables
   - decisions
   - turn count
   - saved JSON filename
   - last error if any

Existing one-click `Run automation` button must remain available and unchanged.

## Success criteria

- Store tracks conditional workflow state:
  - `conditionalWorkflowText`
  - `conditionalWorkflowResult`
  - `isRunningConditionalWorkflow`
  - `conditionalWorkflowParseError`
- Render shows:
  - workflow JSON textarea
  - load sample button
  - run conditional workflow button
  - compact result summary
- Controller binds:
  - load sample
  - run conditional workflow
- Orchestrator exposes:
  - `runConditionalWorkflow({ definition })`
- UI validates JSON parse errors before sending to background.
- Background validation still remains the source of truth.
- Existing one-click controls continue to work.
- Existing diagnostics export continues to work.

## How to verify

1. Reload the extension.
2. Open Automation Tester.
3. Confirm existing controls are still visible:
   - Select Excel File
   - Run automation
   - Export Causal Report
   - Advanced Actions
4. Confirm new conditional workflow section is visible.
5. Click `Load sample workflow`.

Expected result:

- Textarea fills with valid sample JSON.

6. Click `Run conditional workflow` with invalid JSON.

Expected result:

- UI shows parse error.
- No background message is sent.

7. Select Excel file and run sample workflow.

Expected result:

- The workflow runs.
- Result summary shows:
  - `status: completed`
  - `variables.tipo`
  - visited node IDs
  - turn count
  - saved workflow JSON filename, if Phase 7 succeeded

8. Run existing one-click automation.

Expected result:

- Existing one-click still works.

## Observable failure signals

- Automation Tester fails to render.
- Existing one-click button no longer works.
- Invalid JSON causes uncaught exception.
- UI sends conditional workflow without definition.
- UI displays stale results after a new run.
- Sidepanel loses selected file state.
- `MESSAGE_TYPES.CONDITIONAL_WORKFLOW_RUN` is undefined in sidepanel context.

## Files/components involved

Expected files to edit:

- `sidepanel/sidepanel.html`
  - Load any new core contract modules needed by sidepanel if UI wants local validation.
- `sidepanel/automationTester/automationTester.store.js`
- `sidepanel/automationTester/automationRunOrchestrator.js`
- `sidepanel/automationTester/automationTester.render.js`
- `sidepanel/automationTester/automationTester.controller.js`

Do not edit in this phase:

- Python gateway
- DeepSeek content automation
- Background workflow logic, except only if a UI integration bug reveals a clear contract mismatch.

## Preconditions before implementation

- Phase 7 is complete and verified.
- `MESSAGE_TYPES.CONDITIONAL_WORKFLOW_RUN` exists.
- Conditional workflow can be run from the service worker console.
- Sidepanel still loads `core/constants/messageTypes.js` and `core/constants.js`.
- Existing Automation Tester render/controller/store files still match the current architecture.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- Automation Tester UI has been moved out of `sidepanel/automationTester/*`.
- Sidepanel no longer uses direct HTML string rendering.
- Sidepanel messaging abstraction changed from `NewSiteSidepanel.ChromeMessaging`.
- Conditional workflow runner cannot be executed successfully from the console before adding UI.
- Adding the UI would require a major sidepanel rewrite.

## Phase scope limit

Do not build drag-and-drop nodes, canvas edges, graph editing, or a full workflow designer in this phase.
