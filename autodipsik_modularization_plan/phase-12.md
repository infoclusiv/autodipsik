# Phase 12 — Extract Python gateway file-message handlers and finalize architecture docs

## Objective

Complete low-risk Python gateway modularization by moving file selection/content message handling out of `GatewayHandlers`, then update architecture documentation to reflect the new module boundaries.

## Expected behavior

Gateway protocol behavior remains unchanged for:
- `HELLO`
- `PING`
- `FILE_PICKER_OPEN_REQUEST`
- `FILE_PICKER_OPEN_MULTIPLE_REQUEST`
- `FILE_SELECT_BY_ID_REQUEST`
- `FILE_CONTENT_REQUEST`
- `FILE_CONTENT_BY_PATH_REQUEST`

File selection and serialization behavior remains unchanged.

## Success criteria

- A new Python file-message handler module owns file picker, select-by-id, content-by-id, and content-by-path behavior.
- `GatewayHandlers.handle(...)` is reduced to clear dispatch plus small handshake/ping logic or delegates those too if trivial.
- Existing Python tests pass.
- Existing extension gateway flows still work.
- Architecture documentation is updated to describe the new JS and Python module boundaries.
- Manual regression checklist remains valid or is updated with any new verification note.

## How to verify

Run:

```powershell
cd app-python
python -m pytest autodipsik_gateway/tests
```

Manual gateway checks:

1. Start gateway.
2. Connect from sidepanel.
3. Select one file.
4. Select multiple files.
5. Activate a file by id through batch workflow.
6. Request file content through a conditional workflow.
7. Cancel picker and confirm structured error still returns.
8. Confirm `.xlsx`, `.xls`, and `.csv` validation behavior remains unchanged.

Documentation checks:

1. Open `docs/architecture/current-modularization-map.md`.
2. Update it or add a new architecture note reflecting:
   - shared workflow sample/draft module
   - sidepanel adapter/section modules
   - gateway persistence service
   - conditional workflow support/item runner modules
   - DeepSeek content handlers
   - ChatAutomator readiness/step modules
   - Python save/file handler modules
3. Confirm documentation does not describe removed or inactive modules as active runtime owners.

## Observable failure signals

- File picker no longer opens.
- Multi-file picker returns wrong selected file.
- Select-by-id returns `UNKNOWN_SELECTED_FILE_ID` for a valid selected file.
- File content request fails after selecting a file.
- Cancel picker crashes gateway or extension UI.
- Python tests fail.
- Documentation claims a module exists but it is not loaded by runtime.

## Files/components involved

- New file, suggested: `app-python/autodipsik_gateway/websocket/file_handlers.py`
- `app-python/autodipsik_gateway/websocket/handlers.py`
- `app-python/autodipsik_gateway/files/file_picker.py`
- `app-python/autodipsik_gateway/files/file_store.py`
- `app-python/autodipsik_gateway/files/serializers.py`
- `app-python/autodipsik_gateway/files/validators.py`
- `app-python/autodipsik_gateway/tests/test_handlers.py`
- `docs/architecture/current-modularization-map.md`
- `docs/testing/manual-regression-checklist.md`

## Preconditions before implementation

- Phase 11 completed and verified.
- Python tests pass before this phase.
- File selection/content logic still lives in `GatewayHandlers.handle(...)`.
- Manual gateway file selection currently works.

## Implementation guidance

- Suggested class: `GatewayFileHandlers`.
- Inject:
  - `settings`
  - `file_store`
  - `logger`
- Preserve `_validate_or_raise` behavior or move it into a shared helper used by file handlers.
- Preserve exact response envelope types:
  - `FILE_SELECTED`
  - `FILES_SELECTED`
  - `FILE_CONTENT_RESPONSE`
  - `ERROR`
- Keep `GatewayHandlers` as a readable dispatcher, not a large business-logic owner.
- Update docs only after runtime verification passes.

## Stop conditions if the plan does not match the real codebase

Stop if:

- File handler logic has already been moved.
- Existing gateway tests fail before refactor.
- File picker behavior is platform-specific and cannot be manually verified.
- Documentation update would be speculative rather than aligned with implemented code.
