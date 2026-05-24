# Phase 5 — Surface AHK save result in the side panel and complete end-to-end verification

## Single objective

Show the generated AHK file result in the Automation Tester UI and verify the full user workflow end to end.

## Expected behavior

After a successful conditional workflow run, the side panel should show both:

- Workflow run JSON saved: `<excel-stem>.deepseek-workflow-run.<timestamp>.json`
- AutoHotkey file saved: `<excel-stem>.ahk`

The success toast should mention the AHK file when available.

## Files/components involved

Primary files:

- `sidepanel/automationTester/automationTester.controller.js`
- `sidepanel/automationTester/automationTester.render.js`

Potentially:

- `sidepanel/automationTester/automationTester.store.js` if the current state shape needs a small addition.

Do not change:

- Python gateway writer logic
- Conditional workflow engine
- DeepSeek content scripts

## Implementation notes

In `automationTester.controller.js`:

- Preserve the current assignment:

```javascript
store.conditionalWorkflowResult = response;
store.lastRunSummary = response;
```

- Update toast logic so that if `response.workflowAhkFileSave.fileName` exists, the user sees a message such as:

```text
Conditional workflow completed. AHK saved: selected-file.ahk
```

- Preserve the existing JSON save toast fallback.

In `automationTester.render.js`:

- Read:

```javascript
const workflowAhkFileSave = conditionalWorkflowResult.workflowAhkFileSave || null;
```

- Add a small display line near the existing workflow JSON save line:

```text
AutoHotkey file saved: selected-file.ahk
```

- Optionally show output path in a compact/help text section if it does not clutter the UI.

Keep the UI small. Do not redesign the Automation Tester layout.

## Success criteria

- Existing JSON save display still appears.
- New AHK save display appears when `workflowAhkFileSave` exists.
- Success toast mentions the AHK filename when available.
- Failure toast still shows the structured error message.
- No UI regression in selected file, workflow status, variables, decisions, and execution timeline.
- The full attached workflow can generate an `.ahk` file from the final tagged DeepSeek response.

## How to verify

Manual end-to-end verification with the user’s attached workflow:

1. Start the Python gateway.
2. Load/reload the extension.
3. Open the side panel.
4. Select an Excel file.
5. Paste the conditional workflow JSON.
6. Run the workflow.
7. Wait for completion.
8. Verify the side panel shows:
   - `Conditional status: completed`
   - JSON save result
   - AHK save result
9. Open the folder where the Excel file was selected.
10. Confirm `<excel-stem>.ahk` exists.
11. Open the `.ahk` file and confirm:
   - It starts with `#SingleInstance force` when the generated DeepSeek code starts with that line.
   - It does not contain `<<<archivo ahk>>>`.
   - It does not contain `<<</archivo ahk>>>`.
   - It contains the generated `Send, ...` lines.
12. Confirm existing workflow JSON still exists and contains the full captured response.

Negative verification:

1. Run a workflow where the final response lacks the AHK tags.
2. Confirm the UI reports failure.
3. Confirm diagnostics identify the missing tags as expected vs actual.
4. Confirm the workflow run JSON remains available if it was saved before the AHK save attempt.

## Observable failure signals

- UI says completed but no AHK save result is shown.
- Toast only mentions JSON despite AHK being generated.
- UI crashes or fails to render because `workflowAhkFileSave` is null.
- Failure message is generic and does not mention missing AHK tags.
- Existing workflow timeline or variables display disappears.

## Preconditions before implementation

- Phase 4 is implemented and verified.
- The background response includes `workflowAhkFileSave` on success.
- The side panel still stores the full response object in `store.conditionalWorkflowResult`.

## Stop conditions if the plan does not match the real codebase

Stop if:

- The Automation Tester UI has been moved to different files.
- The run result is no longer stored in `store.conditionalWorkflowResult`.
- A different UI layer already displays save artifacts and should be extended instead.
- The UI cannot safely display file paths or file names due to a new privacy/security constraint.
