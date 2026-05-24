# Phase 6 — Implement background batch conditional workflow orchestration

## Single objective

Add a background-level batch workflow orchestrator that sequentially runs the existing conditional workflow once per selected Excel file and opens a fresh DeepSeek tab in the same browser window for each file after the first.

This phase should be callable by message but does not need final sidepanel UX polish yet.

## Expected behavior

- A new background workflow receives:
  - conditional workflow definition
  - ordered `selectedFiles`
  - batch options
- It validates that at least one selected file exists when the workflow requires file attachment.
- It processes files sequentially, never concurrently.
- For the first file:
  - use an existing ready DeepSeek tab if available, or open one if needed
- For every file after the first:
  - open a new `https://chat.deepseek.com/` tab in the same browser window
  - run the full workflow in that new tab
- Before each file run:
  - activate the gateway file by `fileId`
  - pass the active file and `targetTabId` into the single workflow runner
- After each file run:
  - collect result metadata, including `.ahk` save result
- If a file fails:
  - stop the batch by default
  - return a structured batch result with completed and failed counts
  - preserve the failing file metadata and error

## Success criteria

- New background module exists, for example:

  ```text
  background/workflows/deepseekBatchConditionalWorkflow.js
  ```

- `background-main.js` imports this module before `automationHandlers.js`.
- New runtime message type exists, for example:

  ```js
  CONDITIONAL_WORKFLOW_BATCH_RUN: "AUTODIPSIK_CONDITIONAL_WORKFLOW_BATCH_RUN"
  ```

- `background/messageRouter.js` routes the new message.
- `background/messageHandlers/automationHandlers.js` delegates the new message to the batch orchestrator.
- Batch result shape includes:

  ```js
  {
    status: "completed" | "failed",
    traceId,
    workflowId,
    batchId,
    totalCount,
    completedCount,
    failedCount,
    results: [
      {
        index,
        selectedFile,
        tabId,
        status,
        traceId,
        workflowRunJsonSave,
        workflowAhkFileSave,
        error
      }
    ],
    error
  }
  ```

- The implementation reuses `DeepSeekConditionalWorkflow.run()` rather than duplicating conditional workflow engine logic.
- Manual testing can process two selected Excel files and create two `.ahk` files beside the respective Excel files.

## How to verify

1. Select two Excel files through the Phase 3 UI.
2. From the service worker console or a temporary controlled sidepanel call, send the new batch runtime message with the current workflow definition and selected files.
3. Confirm:
   - first file completes
   - first `.ahk` is saved beside first Excel
   - a new DeepSeek tab opens in the same browser window
   - second file completes in the new tab
   - second `.ahk` is saved beside second Excel
   - returned batch result includes two successful item results
4. Repeat with a workflow response missing `<<<archivo ahk>>>` tags for one file and confirm batch stops with structured failure.

## Observable failure signals

- Second file opens in a new browser window instead of a new tab.
- Second file is processed in the first file's DeepSeek tab.
- `.ahk` for the second file overwrites the first file's `.ahk`.
- Batch starts all files concurrently.
- Batch reports completed even when an item failed.
- Failure result lacks file index, file name, file id, failed stage, or trace id.
- Existing single-file run fails after adding the batch module.

## Files/components involved

Primary files:

- `background/workflows/deepseekBatchConditionalWorkflow.js` (new)
- `background-main.js`
- `core/constants/messageTypes.js`
- `core/constants/telemetryEvents.js`
- `background/messageHandlers/automationHandlers.js`
- `background/messageRouter.js`
- `background/services/deepseekTabService.js`
- `background/services/gatewayFileService.js`
- `background/workflows/deepseekConditionalWorkflow.js`

Supporting files:

- `core/contracts/conditionalWorkflowContracts.js`
- `core/errors.js`
- `core/telemetry.js`
- `core/diagnosticStore.js`

## Implementation guidance

### Batch module

Create a new module rather than expanding `deepseekConditionalWorkflow.js` into a large file.

Recommended public API:

```js
NewSiteBackground.DeepSeekBatchConditionalWorkflow = {
  run: run
};
```

### Sequential loop

Use a plain `for` loop with `await`, not `Promise.all`.

Pseudo-flow:

```js
for (let index = 0; index < selectedFiles.length; index += 1) {
  const selectedFile = selectedFiles[index];

  await GatewayFileService.selectFileById(itemTraceId, selectedFile.fileId);

  const tab = index === 0
    ? await DeepSeekTabService.ensureReady(itemTraceId)
    : await DeepSeekTabService.openFreshReady(itemTraceId, { windowId: baseWindowId });

  if (index === 0) {
    baseWindowId = tab.windowId;
  }

  const itemResult = await DeepSeekConditionalWorkflow.run({
    traceId: itemTraceId,
    input: {
      definition,
      autoConnectGateway: false,
      autoOpenDeepSeek: false,
      autoSelectFileIfMissing: false,
      fileId: selectedFile.fileId,
      selectedFile,
      targetTabId: tab.id,
      targetWindowId: tab.windowId
    }
  });

  // collect result, stop on failure by default
}
```

### Avoid creating a new window

`openFreshReady` should pass the known `baseWindowId` to `chrome.tabs.create`. If `baseWindowId` is missing, fallback to Chrome's current window behavior but record this in diagnostics.

### Failure policy

Default to fail-fast for low regression risk:

```js
continueOnError: false
```

A future phase can add continue-on-error UX if desired.

## Preconditions before implementation

- Phase 5 is implemented and verified.
- The single workflow runner can target a specific file and tab.
- The gateway can activate files by `fileId`.
- The sidepanel can select multiple files and store their metadata.

## Stop conditions if the plan does not match the real codebase

Stop before coding if:

- `DeepSeekConditionalWorkflow.run()` cannot be safely reused for one item.
- Tab creation cannot be constrained to the same window.
- Gateway active-file switching is not reliable.
- There is no way to manually trigger the batch message for verification before UI wiring.
