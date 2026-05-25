# Phase 5 — Extract gateway persistence service in background

## Objective

Separate gateway file selection/payload responsibilities from DeepSeek response/workflow persistence requests currently inside `GatewayFileService`.

## Expected behavior

- Existing callers of `NewSiteBackground.GatewayFileService.saveDeepSeekResponseJson(...)` continue to work.
- Existing callers of `saveDeepSeekWorkflowRunJson(...)` continue to work.
- Existing callers of `saveDeepSeekWorkflowAhkFile(...)` continue to work.
- File selection, payload resolution, and gateway connection behavior remain unchanged.
- Telemetry events and diagnostic snapshots keep the same names and payload semantics.

## Success criteria

- A new background service owns persistence-specific gateway calls.
- `GatewayFileService` remains backward-compatible through delegating methods.
- `background-main.js` loads the new service before any workflow that uses it.
- Conditional workflow output JSON and AHK save still works.
- No gateway protocol message type changes.

## How to verify

1. Load extension and service worker.
2. Start Python gateway.
3. Select an Excel file.
4. Run a conditional workflow that produces AHK tags.
5. Confirm:
   - workflow run JSON is saved
   - `.ahk` file is saved
   - `GatewayFileService.saveDeepSeekWorkflowRunJson` still exists
   - `GatewayFileService.saveDeepSeekWorkflowAhkFile` still exists
6. Export diagnostics and confirm save-related events remain present.

## Observable failure signals

- `NewSiteBackground.GatewayPersistenceService` is undefined.
- `GatewayFileService.saveDeepSeekWorkflowRunJson is not a function`.
- Save requests return `UNKNOWN_ERROR`.
- Saved file output no longer appears beside Excel file.
- Telemetry events for save started/completed/failed disappear.
- AHK output stops being written.

## Files/components involved

- New file, suggested: `background/services/gatewayPersistenceService.js`
- `background/services/gatewayFileService.js`
- `background-main.js`
- `background/workflows/deepseekConditionalWorkflow.js`
- `core/contracts/gatewayContracts.js`
- `core/gatewayProtocol.js`

## Preconditions before implementation

- Confirm `gatewayFileService.js` still contains:
  - `saveDeepSeekResponseJson`
  - `saveDeepSeekWorkflowRunJson`
  - `saveDeepSeekWorkflowAhkFile`
- Confirm these methods are used by `deepseekConditionalWorkflow.js`.
- Confirm `background-main.js` can load a new service before `gatewayFileService.js` or before workflows.

## Implementation guidance

- Move the three save methods and shared request/telemetry helper logic into `GatewayPersistenceService`.
- Keep `GatewayFileService` delegating wrappers:
  - `saveDeepSeekResponseJson(input) { return GatewayPersistenceService.saveDeepSeekResponseJson(input); }`
  - equivalent for workflow JSON and AHK.
- Preserve exact validation calls:
  - `GatewayContracts.validateSaveDeepSeekResponseJsonRequest`
  - `GatewayContracts.validateSaveDeepSeekWorkflowRunJsonRequest`
  - `GatewayContracts.validateSaveDeepSeekWorkflowAhkFileRequest`
- Preserve exact gateway protocol message types.
- Preserve same `DiagnosticStore.recordGatewaySnapshot(...)` stages.

## Stop conditions if the plan does not match the real codebase

Stop if:

- Save methods have already moved.
- Workflows no longer call save through `GatewayFileService`.
- The new service would need to alter gateway protocol envelopes.
- Validation contract methods are missing or renamed.
