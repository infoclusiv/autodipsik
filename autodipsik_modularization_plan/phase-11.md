# Phase 11 — Extract Python gateway save-message handlers

## Objective

Reduce `app-python/autodipsik_gateway/websocket/handlers.py` by moving DeepSeek save-message handling into a focused Python module.

## Expected behavior

Gateway protocol behavior remains unchanged for:
- `SAVE_DEEPSEEK_RESPONSE_JSON`
- `SAVE_DEEPSEEK_WORKFLOW_RUN_JSON`
- `SAVE_DEEPSEEK_WORKFLOW_AHK_FILE`

Response envelope types remain unchanged:
- `DEEPSEEK_RESPONSE_JSON_SAVED`
- `DEEPSEEK_WORKFLOW_RUN_JSON_SAVED`
- `DEEPSEEK_WORKFLOW_AHK_FILE_SAVED`
- `ERROR` with same error codes for failure cases.

## Success criteria

- A new Python module owns save-message handlers and shared selected-file validation.
- `GatewayHandlers.handle(...)` delegates save messages to the new module.
- Existing tests in `test_handlers.py` still pass without changing expected assertions.
- Output JSON/AHK files are written exactly as before.
- Logger events remain the same.

## How to verify

Run:

```powershell
cd app-python
python -m pytest autodipsik_gateway/tests/test_handlers.py
```

Manually verify:

1. Select a valid Excel file through gateway.
2. Run workflow save path from extension.
3. Confirm workflow-run JSON is saved.
4. Confirm AHK file is saved when response contains `<<<archivo ahk>>>...<<</archivo ahk>>>`.
5. Confirm missing AHK tags still returns `AHK_CODE_TAGS_MISSING`.

## Observable failure signals

- Existing tests fail.
- Error code changes from `GATEWAY_FILE_NOT_SELECTED`, `GATEWAY_SELECTED_FILE_MISMATCH`, or `AHK_CODE_TAGS_MISSING`.
- Logger event names change unexpectedly.
- Output file path/name changes unexpectedly.
- Response payload no longer contains `outputPath`, `fileName`, `bytesWritten`.

## Files/components involved

- New file, suggested: `app-python/autodipsik_gateway/websocket/save_handlers.py`
- `app-python/autodipsik_gateway/websocket/handlers.py`
- `app-python/autodipsik_gateway/files/response_writer.py`
- `app-python/autodipsik_gateway/files/file_store.py`
- `app-python/autodipsik_gateway/tests/test_handlers.py`

## Preconditions before implementation

- Confirm save handling still lives in `GatewayHandlers.handle(...)`.
- Confirm tests pass before refactor.
- Confirm `response_writer.py` remains the output writer and should not be refactored in this phase.

## Implementation guidance

- Introduce a class or functions such as:
  - `GatewaySaveHandlers.handle_save_deepseek_response_json(message, correlation_id)`
  - `GatewaySaveHandlers.handle_save_deepseek_workflow_run_json(...)`
  - `GatewaySaveHandlers.handle_save_deepseek_workflow_ahk_file(...)`
- Inject dependencies:
  - `file_store`
  - `logger`
- Preserve exact logger event names and response types.
- Keep `GatewayHandlers` as the top-level dispatcher for now.

## Stop conditions if the plan does not match the real codebase

Stop if:

- Save logic has already been moved.
- Tests fail before refactor.
- The expected response writer functions are missing.
- The refactor would require changing `response_writer.py` behavior.
