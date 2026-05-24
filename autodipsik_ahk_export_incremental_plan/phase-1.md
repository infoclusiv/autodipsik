# Phase 1 — Add pure Python AHK extraction and output path utilities

## Single objective

Add pure, independently testable Python utilities that can extract AutoHotkey code from captured workflow text and calculate the target `.ahk` output path beside the selected Excel file.

This phase must not modify the websocket handler or extension JavaScript.

## Expected behavior

Given a response text containing:

```text
some text
<<<archivo ahk>>>
#SingleInstance force
Send, ABC{Tab}123
<<</archivo ahk>>>
other text
```

the utility extracts exactly:

```text
#SingleInstance force
Send, ABC{Tab}123
```

The generated output path must be:

```text
selected_file.path.parent / (selected_file.path.stem + ".ahk")
```

For `C:\data\student.xlsx`, the output path must be `C:\data\student.ahk`.

## Files/components involved

Primary files:

- `app-python/autodipsik_gateway/files/response_writer.py`

Likely tests to add or update, depending on existing test structure:

- `app-python/tests/test_response_writer.py`
- or the nearest existing Python test file for `response_writer.py`

Do not change these files in this phase:

- `app-python/autodipsik_gateway/websocket/handlers.py`
- `core/gatewayProtocol.js`
- `background/services/gatewayFileService.js`
- `background/workflows/deepseekConditionalWorkflow.js`

## Implementation notes

Add small functions to `response_writer.py`, for example:

- `extract_ahk_code_from_text(text: str) -> str`
- `find_ahk_code_in_workflow_run(workflow_run: dict) -> str`
- `build_ahk_output_path(selected_file: StoredFile) -> Path`

Recommended extraction behavior:

- Match literal opening tag `<<<archivo ahk>>>`.
- Match literal closing tag `<<</archivo ahk>>>`.
- Support multiline code with `re.DOTALL`.
- Preserve internal code exactly.
- Trim only surrounding whitespace/newlines outside the code block.
- If multiple tagged blocks exist, prefer the last one found in the workflow run because the final branch response is the intended output.
- Search `workflow_run["turns"]` in reverse order.
- In each turn, read `turn["response"]["text"]`.
- Raise a structured `ValueError` string compatible with the existing `_split_error(...)` pattern when tags are missing or extracted code is empty.

Suggested error codes:

- `AHK_CODE_TAGS_MISSING`
- `AHK_CODE_EMPTY`
- `DEEPSEEK_WORKFLOW_RUN_MISSING`

The ValueError message should follow the existing pipe-delimited pattern used by `response_writer.py`:

```text
CODE|message|expected|actual
```

## Success criteria

- `extract_ahk_code_from_text(...)` returns only the code between the tags.
- The extraction works when the code spans multiple lines.
- The extraction preserves AutoHotkey content such as `#SingleInstance force`, `{Tab}`, `{Down}`, comments, quotes, commas, and backslashes.
- Missing tags raise a deterministic error.
- Empty tagged content raises a deterministic error.
- `find_ahk_code_in_workflow_run(...)` can find the final tagged response from a `workflowRun` object with multiple turns.
- `build_ahk_output_path(...)` returns the same folder and same Excel basename with `.ahk`.

## How to verify

Run the Python tests for the gateway package.

If the repo has no current test runner, create minimal tests and run them directly, for example:

```bash
cd app-python
python -m unittest discover
```

or, if pytest is already present in the repo:

```bash
cd app-python
python -m pytest
```

Also run a direct smoke test in Python:

```python
from pathlib import Path
from autodipsik_gateway.files.response_writer import extract_ahk_code_from_text

text = "prefix\n<<<archivo ahk>>>\n#SingleInstance force\nSend, ABC{Tab}123\n<<</archivo ahk>>>\nsuffix"
assert extract_ahk_code_from_text(text) == "#SingleInstance force\nSend, ABC{Tab}123"
```

## Observable failure signals

- Tests fail because the extraction includes the wrapper tags.
- Tests fail because the extraction drops AutoHotkey special tokens such as `{Tab}`.
- Missing tag test does not raise `AHK_CODE_TAGS_MISSING`.
- Empty block test does not raise `AHK_CODE_EMPTY`.
- Output path includes timestamp text or `.json` instead of exact `.ahk`.
- Output path writes outside `selected_file.path.parent`.

## Preconditions before implementation

- Confirm `response_writer.py` still exists.
- Confirm `StoredFile` still exposes `path: Path`.
- Confirm the current JSON writer pattern still uses `ValueError("CODE|message|expected|actual")` for structured gateway errors.

## Stop conditions if the plan does not match the real codebase

Stop if:

- The gateway no longer writes output files in `response_writer.py`.
- The selected file model no longer has a real filesystem path.
- The final workflow response is not represented as `workflowRun.turns[*].response.text`.
- There is already an existing AHK extraction utility that fully satisfies this requirement.
