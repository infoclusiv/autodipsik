# Manual Regression Checklist

Date: 2026-05-15

Use this checklist after each refactor phase. The goal is to confirm that modularization preserved behavior, diagnostics, and script loading order.

## Extension Load

- [ ] Load the unpacked extension successfully in `chrome://extensions`.
- [ ] Confirm the MV3 service worker starts without load errors.
- [ ] Confirm the side panel opens from the toolbar action.
- [ ] Confirm `Site Profile` renders.
- [ ] Confirm `Automation Tester` renders.
- [ ] Confirm `Diagnostics` renders.

## Runtime Status

- [ ] Open the side panel and confirm runtime status loads.
- [ ] Confirm the active tab URL is displayed.
- [ ] Confirm the current site switches to `deepseek` when the active tab is `https://chat.deepseek.com/*`.

## Gateway

- [ ] Run `python app-python/run_gateway.py`.
- [ ] Confirm the gateway starts on `ws://127.0.0.1:8765`.
- [ ] In the side panel, click connect and confirm gateway status becomes connected.
- [ ] Click disconnect and confirm gateway status becomes disconnected.
- [ ] Click select file and confirm the native picker opens.
- [ ] Choose a valid `.xlsx`, `.xls`, or `.csv` file and confirm selected file metadata appears.
- [ ] Cancel the picker once and confirm the UI handles cancellation without crashing.

## DeepSeek Tab Health

- [ ] Open or focus DeepSeek through the current flow.
- [ ] Confirm `AUTODIPSIK_DEEPSEEK_TAB_ENSURE` still returns a completed response.
- [ ] Confirm the DeepSeek content script still responds to `AUTODIPSIK_DEEPSEEK_CONTENT_SCRIPT_PING`.
- [ ] Confirm no content-script initialization loop happens on repeated page loads.

## Page State and Selectors

- [ ] Run `Detect Page State` from the side panel on DeepSeek.
- [ ] Confirm a completed response includes `pageState`.
- [ ] Confirm selector testing still works for a single selector.
- [ ] Confirm `Test All` still returns selector health entries.

## Automation Workflows

### `AUTOMATION_ONE_CLICK_RUN`

- [ ] Enter a prompt and run the one-click flow.
- [ ] If no file is selected, confirm the file picker opens when auto-select is enabled.
- [ ] Confirm the flow connects to the gateway when needed.
- [ ] Confirm the flow ensures the DeepSeek tab is ready.
- [ ] Confirm the flow runs preflight when enabled.
- [ ] Confirm the real run attaches the file.
- [ ] Confirm the prompt is inserted.
- [ ] Confirm the send button is found.
- [ ] Confirm the send button is clicked on non-dry runs.
- [ ] Confirm the workflow waits for the final DeepSeek assistant response after submit.
- [ ] Confirm the final response is captured only after the visible text stabilizes.
- [ ] Confirm a `.deepseek-response.<timestamp>.json` file is created beside the selected Excel file.
- [ ] Confirm the side panel shows `DeepSeek response JSON saved: <filename>` after success.

### `RUN_AUTOMATION`

- [ ] Run a dry-run and confirm it does not require a file payload.
- [ ] Run a real automation and confirm it still requires a gateway-selected Excel file.
- [ ] Confirm the response still includes workflow details and errors in the same shape.
- [ ] Confirm dry run skips response capture with reason `dry_run`.
- [ ] Confirm real automation includes `wait_for_deepseek_response_complete` in the workflow results when `waitForResponse` is true.

## Diagnostics

- [ ] Run `Export Diagnostics`.
- [ ] Confirm the JSON download starts.
- [ ] Confirm the package includes `traceId`.
- [ ] Confirm a workflow run includes `workflowId`.
- [ ] Confirm errors include `failedStage`.
- [ ] Confirm errors include both `expected` and `actual`.
- [ ] Confirm the exported package does not contain raw file `contentBase64`.
- [ ] Confirm sensitive local file paths remain redacted where applicable.
- [ ] Run the readiness-gates scenarios in [deepseek-readiness-gates-regression.md](C:/Users/carlo/Downloads/extensions/autodipsik/docs/testing/deepseek-readiness-gates-regression.md).

## Failure Scenarios

- [ ] Try running automation without a prompt and confirm a structured validation error is returned.
- [ ] Try running automation without selecting a file and confirm the expected error still appears.
- [ ] Temporarily disconnect the gateway and confirm connection failures remain structured.
- [ ] Force a DeepSeek content-script failure and confirm the error still includes:
  - [ ] `failedStage`
  - [ ] `expected`
  - [ ] `actual`
  - [ ] `messageType`
  - [ ] `activeTabUrl`

## Python Gateway

- [ ] Run existing Python tests after Python refactors.
- [ ] Confirm protocol tests still pass.
- [ ] Confirm file validation tests still pass.
- [ ] Confirm serialization tests still pass.
- [ ] Confirm response writer tests pass.
- [ ] Open a saved response JSON and confirm UTF-8 characters are preserved without ASCII escaping.

## Completion Gate

Do not advance to the next refactor phase unless:

- [ ] extension load is healthy
- [ ] one-click flow still works or fails with the same structured diagnostics
- [ ] DeepSeek content ping still works
- [ ] diagnostics export still works
