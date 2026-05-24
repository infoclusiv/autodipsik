# Phase 7 — Wire the existing Run conditional workflow button to batch mode when multiple files are selected

## Single objective

Update the active sidepanel so the existing **Run conditional workflow** button runs batch mode when multiple Excel files are selected, while preserving single-file behavior when only one file is selected.

## Expected behavior

- If zero files are selected and the workflow requires an attachment, the current auto-select behavior remains available.
- If one file is selected, clicking **Run conditional workflow** runs the existing single workflow behavior.
- If multiple files are selected, clicking **Run conditional workflow** runs the new batch orchestrator.
- The UI shows batch progress/result summary after completion or failure.
- Each selected Excel produces its own `.ahk` file beside the source Excel when the DeepSeek response includes the required AHK tags.
- A new DeepSeek tab opens in the same browser window for every item after the first.

## Success criteria

- `automationRunOrchestrator.js` exposes a batch call, for example `runConditionalWorkflowBatch(input)`.
- `automationTester.controller.js` decides between single and batch based on `selectedFiles.length > 1`.
- Existing button id remains `run-conditional-workflow`.
- Existing conditional workflow JSON parsing and draft saving remains unchanged.
- `AutomationTesterStore` records `batchRunResult` and `lastRunSummary` clearly.
- `automationTester.render.js` displays:
  - batch status
  - total count
  - completed count
  - failed count
  - per-file file name and status
  - saved `.ahk` filename when available
  - failing file and error when failed
- Toast message communicates batch completion or first failure.
- Single-file behavior remains unchanged.

## How to verify

### Single-file regression

1. Start Python gateway.
2. Select one Excel file.
3. Paste a valid conditional workflow JSON.
4. Click **Run conditional workflow**.
5. Confirm exactly the current behavior:
   - one workflow runs
   - `.ahk` saved beside the selected Excel
   - no unexpected extra DeepSeek tab is opened after completion

### Multi-file batch happy path

1. Select 2–3 Excel files from the same folder.
2. Paste the same valid conditional workflow JSON.
3. Click **Run conditional workflow**.
4. Confirm:
   - first Excel is processed completely
   - after it completes, a new DeepSeek tab opens in the same window
   - second Excel is processed completely in the new tab
   - the pattern repeats for every selected Excel
   - every Excel has its corresponding `.ahk` file beside it
   - UI shows completed count equal to total count

### Multi-file failure path

1. Use a workflow or test response that fails AHK tag extraction for one item.
2. Confirm:
   - batch stops on the failing file by default
   - UI shows the failing file name and error
   - completed prior files keep their `.ahk` outputs
   - unprocessed later files are not reported as completed

## Observable failure signals

- Button click always runs single mode even with multiple files selected.
- Button click always runs batch mode even with one file selected.
- UI says batch completed but not all `.ahk` files exist.
- DeepSeek tabs open as new windows.
- Batch result loses the original per-file order.
- `selectedFiles` becomes stale after selecting a new single file.
- Toast says success when `failedCount > 0`.

## Files/components involved

Primary files:

- `sidepanel/automationTester/automationRunOrchestrator.js`
- `sidepanel/automationTester/automationTester.controller.js`
- `sidepanel/automationTester/automationTester.render.js`
- `sidepanel/automationTester/automationTester.store.js`

Supporting files:

- `core/constants/messageTypes.js`
- `background/workflows/deepseekBatchConditionalWorkflow.js`
- `background/messageRouter.js`

## Implementation guidance

### Orchestrator

Add a batch function:

```js
async function runConditionalWorkflowBatch(input) {
  return messaging.sendMessage({
    type: MESSAGE_TYPES.CONDITIONAL_WORKFLOW_BATCH_RUN,
    input: {
      definition: input.definition || null,
      selectedFiles: input.selectedFiles || [],
      autoConnectGateway: true,
      autoOpenDeepSeek: true,
      continueOnError: false
    }
  });
}
```

Preserve existing `runConditionalWorkflow(input)`.

### Controller

In `runConditionalWorkflow()` after JSON parsing:

```js
const selectedFiles = Array.isArray(store.selectedFiles) ? store.selectedFiles : [];
const shouldRunBatch = selectedFiles.length > 1;

const response = shouldRunBatch
  ? await orchestrator.runConditionalWorkflowBatch({ definition, selectedFiles })
  : await orchestrator.runConditionalWorkflow({ definition });
```

Use separate flags if necessary:

- `isRunningConditionalWorkflow`
- `isRunningBatchConditionalWorkflow`

Avoid duplicate clicks while running.

### Render

Keep the existing conditional workflow result section for single runs.

Add a batch summary section only when `batchRunResult` exists:

- `status`
- `totalCount`
- `completedCount`
- `failedCount`
- ordered per-file list

Keep the display compact so the sidepanel remains usable.

## Preconditions before implementation

- Phase 6 is implemented and verified through a manual batch message.
- Sidepanel multi-file selection from Phase 3 works.
- Single-file workflow from Phase 5 still works.

## Stop conditions if the plan does not match the real codebase

Stop before coding if:

- The sidepanel no longer owns the Run conditional workflow button.
- Batch message from Phase 6 is not manually verifiable.
- The UI cannot reliably distinguish one selected file from multiple selected files.
- Existing conditional workflow JSON draft behavior has moved to a different module.
