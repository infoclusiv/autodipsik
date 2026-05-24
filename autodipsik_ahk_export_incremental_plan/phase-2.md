# Phase 2 — Add Python writer and websocket handler for AHK file generation

## Single objective

Add a Python gateway capability that receives a completed conditional `workflowRun`, extracts the AHK code, and writes the `.ahk` file beside the selected Excel file.

This phase should make the Python gateway capable of AHK generation even before the extension JavaScript calls it.

## Expected behavior

When the gateway receives a new message type such as `SAVE_DEEPSEEK_WORKFLOW_AHK_FILE`, it should:

1. Verify there is a selected file in `FileStore`.
2. Verify the request `fileId` matches the selected file.
3. Verify the request includes `traceId`, `workflowId`, and `workflowRun`.
4. Extract the AHK code from the workflow run using the Phase 1 utility.
5. Write the file to `selected_file.path.with_suffix(".ahk")`.
6. Return a response envelope such as `DEEPSEEK_WORKFLOW_AHK_FILE_SAVED`.
7. Include output metadata: `status`, `outputPath`, `fileName`, `bytesWritten`, and optionally `overwritten`.

## Files/components involved

Primary files:

- `app-python/autodipsik_gateway/files/response_writer.py`
- `app-python/autodipsik_gateway/websocket/handlers.py`

Possible supporting files, depending on current structure:

- `app-python/autodipsik_gateway/websocket/errors.py`
- existing Python tests under `app-python/tests/`

Do not change extension JavaScript in this phase.

## Implementation notes

In `response_writer.py`, add a function similar to:

```python
def write_deepseek_workflow_ahk_file(
    selected_file: StoredFile,
    payload: dict,
) -> dict:
    ...
```

Recommended behavior:

- Use exact filename stem from selected Excel: `selected_file.path.with_suffix(".ahk")`.
- Do not add timestamp to the `.ahk` file because the user explicitly requested the same name as the Excel file.
- Write UTF-8 text.
- Normalize line endings only if necessary; otherwise preserve extracted code as much as possible.
- It is acceptable to overwrite the existing `.ahk` file because the requested output has one deterministic filename. Return `overwritten: true/false` so the behavior is observable.
- Validate `payload["fileId"] == selected_file.file_id`.
- Validate `traceId` and `workflowId` are non-empty.
- Validate `workflowRun` is a dict.

In `handlers.py`:

- Import the new writer.
- Add a new branch for `SAVE_DEEPSEEK_WORKFLOW_AHK_FILE`.
- Reuse the existing selected file mismatch and structured error style.
- Log:
  - `python_gateway.deepseek_workflow_ahk_file.save_requested`
  - `python_gateway.deepseek_workflow_ahk_file.save_completed`
  - `python_gateway.deepseek_workflow_ahk_file.save_failed`

## Success criteria

- A direct handler call with a valid selected file and workflowRun writes `<excel-stem>.ahk` in the same folder.
- The file content equals the extracted AHK code only, with no wrapper tags and no surrounding explanation.
- The response envelope type is `DEEPSEEK_WORKFLOW_AHK_FILE_SAVED`.
- The response payload includes `status`, `outputPath`, `fileName`, `bytesWritten`, and `overwritten`.
- Missing selected file returns a structured gateway `ERROR`.
- File ID mismatch returns a structured gateway `ERROR`.
- Missing tags returns a structured gateway `ERROR` with `AHK_CODE_TAGS_MISSING`.
- Empty code returns a structured gateway `ERROR` with `AHK_CODE_EMPTY`.
- Existing JSON save behavior remains unchanged.

## How to verify

Run Python tests.

Add or run a handler-level test with a temporary `.xlsx` file:

1. Create a temporary Excel-like file, for example `student.xlsx`.
2. Set it as the selected file through `FileStore.set_selected_path(...)`.
3. Send a fake websocket message:

```python
{
    "id": "test_1",
    "type": "SAVE_DEEPSEEK_WORKFLOW_AHK_FILE",
    "payload": {
        "fileId": stored.file_id,
        "traceId": "trace_test",
        "workflowId": "workflow_test",
        "workflowRun": {
            "status": "completed",
            "turns": [
                {
                    "nodeId": "prompt_pregrado",
                    "response": {
                        "text": "<<<archivo ahk>>>\n#SingleInstance force\nSend, ABC{Tab}123\n<<</archivo ahk>>>"
                    }
                }
            ]
        }
    }
}
```

Expected result:

- `student.ahk` exists.
- Its content starts with `#SingleInstance force`.
- Its content does not contain `<<<archivo ahk>>>`.
- Handler response type is `DEEPSEEK_WORKFLOW_AHK_FILE_SAVED`.

## Observable failure signals

- Gateway logs show `python_gateway.deepseek_workflow_ahk_file.save_failed`.
- Handler returns `UNKNOWN_ERROR` for the new message type.
- `.ahk` is written with timestamped JSON naming.
- `.ahk` is written to a downloads folder instead of the Excel folder.
- `.ahk` contains wrapper tags or natural-language explanation.
- Existing JSON save tests or behavior break.

## Preconditions before implementation

- Phase 1 is implemented and verified.
- `GatewayHandlers.handle(...)` still dispatches by `message["type"]`.
- `FileStore.get_selected_file()` still returns the selected file used by JSON saving.
- Existing JSON save handler branches still work and should be used as implementation examples.

## Stop conditions if the plan does not match the real codebase

Stop if:

- The Python gateway no longer has centralized message handling in `handlers.py`.
- File writing has moved out of `response_writer.py`.
- The selected file cannot be resolved when the save request arrives.
- The gateway protocol has been refactored into typed classes or generated schemas requiring a different integration point.
