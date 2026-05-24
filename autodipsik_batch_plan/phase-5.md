# Phase 5 — Make one conditional workflow run file- and tab-targetable

## Single objective

Refactor the existing single conditional workflow path so it can run against an explicit selected file and explicit DeepSeek tab, while preserving the current default single-file behavior.

This phase prepares the existing workflow runner for batch orchestration but still does not loop over multiple files.

## Expected behavior

- Current sidepanel single-file **Run conditional workflow** still works with no behavior change.
- A caller can run `DeepSeekConditionalWorkflow.run(...)` with:
  - `input.selectedFile` or `input.fileId`
  - `input.targetTabId`
  - `input.autoSelectFileIfMissing: false`
- If `fileId` is provided, the background asks the gateway to activate that file before resolving payloads or saving outputs.
- All prompt turns within the same workflow use the same target DeepSeek tab.
- `save_workflow_ahk_file` still saves beside the active selected Excel file.

## Success criteria

- Existing single-file conditional workflow still passes manual verification.
- `DeepSeekConditionalWorkflow.run()` can accept a selected file from the caller without opening a file picker.
- `DeepSeekConditionalWorkflow.run()` can accept a `targetTabId` and all `PAGE_STATE_DETECT` and `RUN_AUTOMATION` messages go to that tab.
- `DeepSeekPromptTurnRunner.runTurn()` can forward to `targetTabId` when provided.
- Gateway active file switching occurs before any file payload resolution or save request.
- Existing telemetry still records the same major stages.

## How to verify

1. Run single-file behavior from the sidepanel exactly as before.
2. Select multiple files using Phase 3 UI, but manually activate only one later file by `fileId` using the Phase 2 message.
3. Run a single conditional workflow and confirm the `.ahk` output is saved beside the activated file, not always beside the first file.
4. Manually create a fresh tab using Phase 4 support, then run one workflow with `targetTabId` through a temporary controlled message or service worker console path.
5. Confirm all prompt turns happen in that tab.

## Observable failure signals

- First prompt turn uses the requested tab but follow-up conditional prompt uses a different DeepSeek tab.
- `.ahk` output is saved beside the wrong Excel file.
- `FILE_CONTENT_REQUEST` fails with `FILE_NOT_SELECTED` or file id mismatch.
- `SAVE_DEEPSEEK_WORKFLOW_AHK_FILE` fails with `GATEWAY_SELECTED_FILE_MISMATCH`.
- The current single-file UI path now requires fields that the UI does not send.

## Files/components involved

Primary files:

- `background/workflows/deepseekConditionalWorkflow.js`
- `background/workflows/deepseekPromptTurnRunner.js`
- `background/services/gatewayFileService.js`
- `background/services/deepseekTabService.js`

Supporting files:

- `core/contracts/deepseekWorkflowContracts.js`
- `core/contracts/conditionalWorkflowContracts.js`
- `core/constants/telemetryEvents.js`

## Implementation guidance

### Normalize workflow input

Extend `normalizeInput()` in `deepseekConditionalWorkflow.js` conservatively:

```js
const input = Object.assign({
  definition: null,
  autoConnectGateway: true,
  autoOpenDeepSeek: true,
  autoSelectFileIfMissing: true,
  selectedFile: null,
  fileId: "",
  targetTabId: null,
  targetWindowId: null
}, message.input || {});
```

### Active file selection

In `ensure_file_selected` stage:

1. If `input.fileId` exists, call `GatewayFileService.selectFileById(traceId, input.fileId)` first.
2. Then call `GatewayClient.getStatus()`.
3. Prefer the gateway active `selectedFile` because Python save handlers depend on it.
4. If no file is required, preserve existing no-file behavior.

### Target tab

When `input.targetTabId` is present:

- skip `ensureReady()` for reuse logic
- send `PAGE_STATE_DETECT` through `DeepSeekTabService.forwardToTab(input.targetTabId, message)`
- pass `targetTabId` into `DeepSeekPromptTurnRunner.runTurn(...)`

When `input.targetTabId` is not present:

- preserve current behavior through `DeepSeekTabService.forward(...)`

### Prompt turn runner

Extend `normalizeInput()` and use the specific tab if provided:

```js
const forwardMessage = { type: MESSAGE_TYPES.RUN_AUTOMATION, ... };
const automationResult = input.targetTabId
  ? await NewSiteBackground.DeepSeekTabService.forwardToTab(input.targetTabId, forwardMessage)
  : await NewSiteBackground.DeepSeekTabService.forward(forwardMessage);
```

## Preconditions before implementation

- Phase 4 is implemented and verified.
- Phase 2 active-file switching exists and works.
- `DeepSeekConditionalWorkflow.run()` still owns the single workflow stages.
- `DeepSeekPromptTurnRunner.runTurn()` still owns file payload resolution and content-script forwarding.

## Stop conditions if the plan does not match the real codebase

Stop before coding if:

- Prompt turns are no longer executed through `DeepSeekPromptTurnRunner`.
- Save requests no longer require active gateway selected file compatibility.
- DeepSeek tab forwarding already accepts a target tab in a different shape.
