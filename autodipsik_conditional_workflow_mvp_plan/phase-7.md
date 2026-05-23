# phase-7.md

# Phase 7 — Add Python gateway saving for multi-turn workflow run JSON

## Single objective

Add a new gateway save path for the full conditional workflow run result, without changing the existing single-response JSON save path.

## Expected behavior

The conditional workflow runner can send a new gateway message:

```js
GatewayProtocol.GATEWAY_MESSAGE_TYPES.SAVE_DEEPSEEK_WORKFLOW_RUN_JSON
```

The Python gateway writes a schema version 2 JSON file beside the selected Excel file.

Expected output filename pattern:

```text
<excel-stem>.deepseek-workflow-run.<timestamp>.json
```

Expected JSON payload shape:

```json
{
  "schemaVersion": 2,
  "source": "deepseek",
  "workflowType": "conditional_prompt_flow",
  "savedAt": "...",
  "traceId": "...",
  "workflowId": "mvp_tipo_flow",
  "sourceFile": {
    "fileId": "...",
    "name": "...",
    "extension": ".xlsx",
    "sizeBytes": 123
  },
  "definitionSummary": {
    "flowVersion": 1,
    "startNodeId": "prompt_1",
    "nodeCount": 7
  },
  "execution": {
    "status": "completed",
    "visitedNodeIds": [],
    "variables": {},
    "turns": [],
    "extractions": [],
    "decisions": [],
    "finalNodeId": "end"
  }
}
```

The existing `SAVE_DEEPSEEK_RESPONSE_JSON` behavior and schema version 1 writer must remain unchanged.

## Success criteria

- Extension gateway protocol adds message types:
  - `SAVE_DEEPSEEK_WORKFLOW_RUN_JSON`
  - `DEEPSEEK_WORKFLOW_RUN_JSON_SAVED`
- Python gateway protocol allows:
  - `SAVE_DEEPSEEK_WORKFLOW_RUN_JSON`
- Gateway contracts validate:
  - save request has `fileId`, `traceId`, `workflowId`, and `workflowRun`
  - save response has `status`, `outputPath`, `fileName`, `bytesWritten`
- `background/services/gatewayFileService.js` exposes:
  - `saveDeepSeekWorkflowRunJson(input)`
- Python `response_writer.py` adds:
  - `build_workflow_run_output_path(...)`
  - `build_workflow_run_output_payload(...)`
  - `write_deepseek_workflow_run_json(...)`
- Python `websocket/handlers.py` routes:
  - `SAVE_DEEPSEEK_WORKFLOW_RUN_JSON`
- The new writer does not modify:
  - `write_deepseek_response_json(...)`
  - schema version 1 response JSON output
- `DeepSeekConditionalWorkflow` calls `saveDeepSeekWorkflowRunJson(...)` after a completed or failed workflow run if enough data exists.
- The result returned to sidepanel includes:
  - `workflowRunJsonSave`

## How to verify

1. Run Python compile check:

```powershell
python -m compileall app-python/autodipsik_gateway
```

Expected result:

- No syntax errors.

2. Run existing one-click automation.

Expected result:

- Existing single-response JSON is still saved with `schemaVersion: 1`.

3. Run conditional workflow.

Expected result:

- A new file is written beside the selected Excel file.
- Filename includes:
  - `.deepseek-workflow-run.`
- JSON has:
  - `schemaVersion: 2`
  - `workflowType: "conditional_prompt_flow"`
  - `execution.turns.length >= 2`
  - extracted variables
  - decisions
  - visited node IDs
  - final status

4. Check returned response:

```js
result.workflowRunJsonSave.fileName
```

Expected result:

- Non-empty filename ending in `.json`.

## Observable failure signals

- Existing one-click JSON saving breaks.
- Python gateway rejects the new message as unsupported.
- Extension gateway client times out waiting for save response.
- New JSON is saved with schema version 1.
- New writer overwrites the selected Excel or existing response JSON.
- The output file lacks turns, variables, decisions, or final status.
- `bytesWritten` is missing or zero.
- Python logs contain `deepseek_workflow_run_json.save_failed`.

## Files/components involved

Expected files to edit:

- JavaScript:
  - `core/gatewayProtocol.js`
  - `core/contracts/gatewayContracts.js`
  - `background/services/gatewayFileService.js`
  - `background/workflows/deepseekConditionalWorkflow.js`
  - `core/constants/telemetryEvents.js`
- Python:
  - `app-python/autodipsik_gateway/websocket/protocol.py`
  - `app-python/autodipsik_gateway/websocket/handlers.py`
  - `app-python/autodipsik_gateway/files/response_writer.py`

Do not edit in this phase:

- Sidepanel UI
- Existing single-response writer behavior, except to share helper functions safely.

## Preconditions before implementation

- Phase 6 is complete and verified.
- Conditional workflow runner returns a complete workflow run result.
- Existing single-response JSON save works before changes.
- Python gateway can be run locally.
- Confirm `FileStore` selected file metadata is still available in Python handlers.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- Python gateway has moved away from `websocket/protocol.py` and `websocket/handlers.py`.
- `response_writer.py` has been replaced by another persistence layer.
- Existing JSON writer tests exist and require a different test approach.
- The selected file is no longer stored in `FileStore`.
- A multi-turn writer already exists with a different schema.

## Phase scope limit

Do not add or redesign the UI in this phase. Only add persistence for workflow run results.
