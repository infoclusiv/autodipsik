# Phase 1 — Add Python gateway multi-file selection and active-file switching foundation

## Single objective

Extend the Python gateway file subsystem so it can remember multiple selected Excel files while preserving the existing single selected-file contract.

This phase must not change the extension UI and must not change conditional workflow execution yet.

## Expected behavior

- Existing single-file selection through `FILE_PICKER_OPEN_REQUEST` still works exactly as before.
- A new gateway request can open a multi-file picker and return an ordered list of selected Excel files.
- All selected files are validated with the existing file validation rules.
- The gateway keeps an in-memory batch registry keyed by `fileId`.
- The gateway can set any previously selected batch file as the current active selected file by `fileId`.
- Existing save handlers still work because they continue to read `file_store.get_selected_file()`.

## Success criteria

- `FileStore` supports:
  - one current active selected file
  - a list of selected files
  - lookup by `fileId`
  - activating a selected file by `fileId`
- Existing `set_selected_path()`, `get_selected_file()`, and `get_selected_file_or_raise()` behavior remains compatible.
- `open_file_picker()` remains compatible and still returns one file.
- A new multi-file picker function returns multiple `Path` values.
- New gateway message handling exists for:
  - selecting multiple files
  - activating one selected file by `fileId`
- The gateway returns structured errors when:
  - the multi-file picker is cancelled
  - no selected files are found
  - any selected file fails validation
  - an unknown `fileId` is requested for activation
- Automated Python tests cover the new `FileStore` behavior and at least the pure-Python parts of multi-file handling.

## How to verify

1. Run existing Python tests:

   ```powershell
   python -m pytest app-python/autodipsik_gateway/tests
   ```

2. Add focused tests such as:

   - `test_file_store_tracks_multiple_selected_files`
   - `test_file_store_selects_active_file_by_id`
   - `test_file_store_rejects_unknown_active_file_id`
   - `test_single_selected_path_remains_backward_compatible`

3. Manually inspect that existing response-writer tests still pass, especially `.ahk` output beside the selected Excel file.

## Observable failure signals

- Existing single-file tests fail because `FileStore.get_selected_file()` no longer returns a `StoredFile`.
- Save requests start failing with `GATEWAY_SELECTED_FILE_MISMATCH` after single-file selection.
- New multi-file selection returns paths but no public `fileId` metadata.
- Activating a file by `fileId` does not update the selected file used by save handlers.
- Gateway logs do not show enough detail to diagnose selected file count, active file id, or validation failures.

## Files/components involved

Primary files:

- `app-python/autodipsik_gateway/files/file_store.py`
- `app-python/autodipsik_gateway/files/file_picker.py`
- `app-python/autodipsik_gateway/websocket/handlers.py`
- `app-python/autodipsik_gateway/tests/*`

Potential supporting files:

- `app-python/autodipsik_gateway/contracts.py`
- `app-python/autodipsik_gateway/files/validators.py`
- `app-python/autodipsik_gateway/websocket/errors.py`

## Implementation guidance

### FileStore

Add minimal batch-aware methods without removing the single-file API:

```python
class FileStore:
    def set_selected_path(self, path: Path) -> StoredFile: ...  # keep behavior
    def set_selected_paths(self, paths: list[Path]) -> list[StoredFile]: ...
    def get_selected_files(self) -> list[StoredFile]: ...
    def get_file_by_id(self, file_id: str) -> StoredFile | None: ...
    def set_active_file_id(self, file_id: str) -> StoredFile: ...
```

Recommended behavior:

- `set_selected_path(path)` should reset the batch registry to only that file, then set it active.
- `set_selected_paths(paths)` should reset the batch registry, create a `StoredFile` for each path, store them in order, and set the first file active.
- `set_active_file_id(file_id)` should update the current active file only if that file exists in the registry.

### File picker

Preserve the current function:

```python
open_file_picker(...)
```

Add a new function, for example:

```python
open_multi_file_picker(...)
```

Use `filedialog.askopenfilenames(...)` and return a new dataclass result with `paths: list[Path]`.

### Gateway handlers

Add new message types on the Python side first, even before the extension sends them:

- `FILE_PICKER_OPEN_MULTIPLE_REQUEST`
- `FILES_SELECTED`
- `FILE_SELECT_BY_ID_REQUEST`
- `FILE_SELECTED`

For `FILE_PICKER_OPEN_MULTIPLE_REQUEST`:

- Open the multi-file picker.
- Validate every selected path with `_validate_or_raise`.
- Store all files in `FileStore`.
- Return a payload like:

```json
{
  "files": [/* public payloads */],
  "selectedFile": {/* first active file */},
  "count": 3
}
```

For `FILE_SELECT_BY_ID_REQUEST`:

- Read `payload.fileId`.
- Activate that file in `FileStore`.
- Return `FILE_SELECTED` with the active file public payload.

## Preconditions before implementation

- Confirm `file_store.py` still has a single `_selected_file` implementation.
- Confirm `file_picker.py` still uses `askopenfilename`, not `askopenfilenames`.
- Confirm `handlers.py` still routes `FILE_PICKER_OPEN_REQUEST`, `FILE_CONTENT_REQUEST`, `SAVE_DEEPSEEK_WORKFLOW_RUN_JSON`, and `SAVE_DEEPSEEK_WORKFLOW_AHK_FILE` through `FileStore`.
- Confirm `response_writer.py` still writes `.ahk` using `selected_file.path.parent / f"{selected_file.path.stem}.ahk"`.

## Stop conditions if the plan does not match the real codebase

Stop before coding if:

- The gateway already has multi-file selection support.
- Save handlers no longer depend on `FileStore.get_selected_file()`.
- File selection is no longer implemented with Tkinter.
- The gateway is no longer synchronous request/response over the current WebSocket handler.
