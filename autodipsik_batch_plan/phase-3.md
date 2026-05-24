# Phase 3 — Add sidepanel multi-file selection UI without batch execution

## Single objective

Expose multi-file selection in the active Automation Tester sidepanel and render the selected batch, without changing the existing Run conditional workflow behavior.

## Expected behavior

- The sidepanel still shows and supports the existing single selected file.
- The sidepanel adds a small, clear way to select multiple Excel files from the gateway.
- After multi-file selection, the UI displays the number of selected files and a compact list of file names.
- The existing **Run conditional workflow** button still runs only the current single selected file in this phase.
- No new DeepSeek tabs are opened by this phase.

## Success criteria

- `AutomationTesterStore.state` includes `selectedFiles: []` and any minimal batch fields needed for display.
- `automationTester.controller.js` can call the new `GATEWAY_SELECT_FILES` message.
- `automationTester.render.js` displays selected batch metadata without breaking the existing selected-file card.
- Existing single-file selection still updates `selectedFile` and selected-file card.
- Multi-file selection updates both:
  - `selectedFiles`
  - active `selectedFile` as the first selected file
- The current **Run conditional workflow** button still calls the existing single-workflow path.

## How to verify

1. Reload the extension.
2. Start the Python gateway.
3. Open the sidepanel.
4. Click existing **Select Excel File** and confirm one file still renders.
5. Click the new multi-select control and choose 2–3 Excel files from the same folder.
6. Confirm:
   - the sidepanel shows the correct count
   - file names are listed in selected order
   - active selected file is the first file
7. Click **Run conditional workflow** with only one selected file and confirm existing behavior is unchanged.
8. Do not verify batch behavior in this phase because it must not exist yet.

## Observable failure signals

- UI re-render removes event bindings after selecting files.
- `selectedFiles` is shown but `selectedFile` becomes `null`.
- Existing single-file selection no longer works.
- Clicking **Run conditional workflow** after multi-file selection unexpectedly tries to run all files in this phase.
- The sidepanel crashes because old status objects do not contain `selectedFiles`.

## Files/components involved

Primary files:

- `sidepanel/automationTester/automationTester.store.js`
- `sidepanel/automationTester/automationTester.controller.js`
- `sidepanel/automationTester/automationTester.render.js`

Supporting files:

- `sidepanel/automationTester/automationRunOrchestrator.js`
- `sidepanel/sidepanel.html` if script order needs updates, though this should not usually be necessary for this phase.

## Implementation guidance

### Store

Add conservative state fields:

```js
selectedFiles: [],
batchSelectionResult: null,
batchRunResult: null,
isSelectingFiles: false,
isRunningBatchConditionalWorkflow: false
```

Do not remove existing `selectedFile` or `fileSelectionResult`.

### Controller

Add a function similar to the current `selectExcelFile()`:

```js
async function selectExcelFiles() {
  store.isSelectingFiles = true;
  const response = await messaging.sendMessage({ type: MESSAGE_TYPES.GATEWAY_SELECT_FILES });
  store.isSelectingFiles = false;
  if (!applyResponse(response)) return;
  store.gatewayStatus = response.gatewayStatus || null;
  store.selectedFiles = response.files || (store.gatewayStatus ? store.gatewayStatus.selectedFiles || [] : []);
  store.selectedFile = response.selectedFile || (store.gatewayStatus ? store.gatewayStatus.selectedFile : null);
  store.batchSelectionResult = response;
  store.lastError = null;
  rerender();
  Toast.showToast(store.selectedFiles.length ? `${store.selectedFiles.length} Excel files selected.` : "File selection cancelled.");
}
```

Use string concatenation instead of template strings if matching the existing code style is preferred.

### Render

Add a button near the existing file selection button, for example:

```html
<button id='automation-select-files'>Select Multiple Excel Files</button>
```

Render a compact selected-batch section:

- count
- ordered filenames
- active selected file

Keep the existing selected-file card unchanged.

## Preconditions before implementation

- Phase 2 is implemented and verified.
- The new extension runtime message for multi-file selection exists.
- The sidepanel still uses `AutomationTesterController`, `AutomationTesterStore`, and `AutomationTesterRender`.

## Stop conditions if the plan does not match the real codebase

Stop before coding if:

- `automationTester.controller.js` no longer owns sidepanel event binding.
- `automationTester.render.js` no longer renders the Automation Tester DOM via `root.innerHTML`.
- Another UI module has replaced `sidepanel/automationTester/*` for active DeepSeek workflows.
