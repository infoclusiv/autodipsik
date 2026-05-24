# Phase 3 — Add extension-side gateway protocol, contracts, and service method

## Single objective

Teach the browser extension how to request AHK file generation from the Python gateway, without yet changing the conditional workflow execution path.

## Expected behavior

The extension should expose a background service method such as:

```javascript
GatewayFileService.saveDeepSeekWorkflowAhkFile({
  traceId,
  workflowId,
  fileId,
  selectedFile,
  workflowRun
})
```

The method should validate its request, send `SAVE_DEEPSEEK_WORKFLOW_AHK_FILE` to the gateway, validate `DEEPSEEK_WORKFLOW_AHK_FILE_SAVED`, emit telemetry, and return the gateway response payload.

## Files/components involved

Primary files:

- `core/gatewayProtocol.js`
- `core/contracts/gatewayContracts.js`
- `core/constants/telemetryEvents.js`
- `background/services/gatewayFileService.js`

Possibly:

- `background-main.js` only if a new file is introduced. Prefer not to add a new file in this phase.

Do not change:

- `background/workflows/deepseekConditionalWorkflow.js`
- `sidepanel/automationTester/automationTester.render.js`
- `app-python/...` files in this phase

## Implementation notes

In `core/gatewayProtocol.js`, add message types:

- `SAVE_DEEPSEEK_WORKFLOW_AHK_FILE`
- `DEEPSEEK_WORKFLOW_AHK_FILE_SAVED`

In `core/contracts/gatewayContracts.js`, add validators similar to the workflow JSON save validators:

- `validateSaveDeepSeekWorkflowAhkFileRequest(input, context)`
- `validateSaveDeepSeekWorkflowAhkFileResponse(input, context)`

Request required fields:

- `fileId`
- `traceId`
- `workflowId`
- `workflowRun`

Response required fields:

- `status`
- `outputPath`
- `fileName`
- `bytesWritten`

Optional response fields:

- `overwritten`

In `core/constants/telemetryEvents.js`, add gateway telemetry event constants:

- `DEEPSEEK_WORKFLOW_AHK_FILE_SAVE_STARTED`
- `DEEPSEEK_WORKFLOW_AHK_FILE_SAVE_COMPLETED`
- `DEEPSEEK_WORKFLOW_AHK_FILE_SAVE_FAILED`

In `background/services/gatewayFileService.js`, add:

- `saveDeepSeekWorkflowAhkFile(input)`

The method should mirror `saveDeepSeekWorkflowRunJson(...)` as closely as possible.

Telemetry should include:

- `traceId`
- `workflowId`
- `fileId`
- `selectedFile.name`
- workflow status
- bytes written on success
- expected vs actual on failure

## Success criteria

- The new gateway message types are available through `NewSiteCore.GatewayProtocol.GATEWAY_MESSAGE_TYPES`.
- The new validators reject missing `fileId`, `traceId`, `workflowId`, or `workflowRun`.
- The new service method sends the new gateway message type.
- The service method validates the gateway response before returning.
- Existing `saveDeepSeekWorkflowRunJson(...)` behavior remains unchanged.
- `background-main.js` import order remains valid if no new file is added.

## How to verify

Use the browser extension console or a small harness after loading the extension:

```javascript
NewSiteCore.GatewayProtocol.GATEWAY_MESSAGE_TYPES.SAVE_DEEPSEEK_WORKFLOW_AHK_FILE
```

should return:

```text
SAVE_DEEPSEEK_WORKFLOW_AHK_FILE
```

Contract smoke check:

```javascript
NewSiteCore.GatewayContracts.validateSaveDeepSeekWorkflowAhkFileRequest({
  fileId: "file_1",
  traceId: "trace_1",
  workflowId: "workflow_1",
  workflowRun: { status: "completed", turns: [] }
}, { messageType: "SAVE_DEEPSEEK_WORKFLOW_AHK_FILE" });
```

Expected:

- No exception for valid payload.
- Exception for missing fields.

Gateway integration smoke check after Phase 2:

- Select an Excel file.
- Manually call the service method with a minimal workflowRun containing tagged AHK.
- Confirm it returns an AHK save result.

## Observable failure signals

- `GatewayFileService.saveDeepSeekWorkflowAhkFile` is undefined.
- Contract validation allows invalid payloads.
- Contract validation rejects valid payloads.
- Gateway responds successfully but extension rejects the response due to mismatched expected fields.
- Telemetry emits JSON save events instead of AHK save events.
- Existing JSON save flow breaks.

## Preconditions before implementation

- Phase 2 is implemented and verified.
- Existing `GatewayProtocol`, `GatewayContracts`, and `GatewayFileService` still exist.
- Existing save method `saveDeepSeekWorkflowRunJson(...)` remains the closest pattern to follow.

## Stop conditions if the plan does not match the real codebase

Stop if:

- Gateway message types are no longer centralized in `core/gatewayProtocol.js`.
- Gateway contracts are no longer centralized in `core/contracts/gatewayContracts.js`.
- `GatewayFileService` no longer owns background-to-gateway file save requests.
- Telemetry constants have been replaced by a different mechanism.
