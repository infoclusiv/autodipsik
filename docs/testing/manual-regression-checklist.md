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

## Conditional Workflow Draft Persistence

### Automation Tester

- [ ] Open `Automation Tester` and confirm the conditional workflow textarea renders.
- [ ] Paste valid JSON into the conditional workflow textarea.
- [ ] Close and reopen the side panel and confirm the exact JSON text is preserved.
- [ ] Reload the extension in `chrome://extensions` and confirm the same JSON text is preserved.
- [ ] Fully close Chrome, reopen it, and confirm the same JSON text is preserved.
- [ ] Paste intentionally invalid JSON and confirm it is still preserved after closing and reopening the side panel.
- [ ] Click `Load sample workflow` and confirm the sample JSON remains after closing and reopening the side panel.

### Workflow Lab

- [ ] Open `Workflow Lab` from the side panel and confirm the conditional workflow textarea renders.
- [ ] Confirm Workflow Lab loads the same persisted draft shown in Automation Tester.
- [ ] Edit the Workflow Lab draft and close the window.
- [ ] Reopen Workflow Lab and confirm the exact edited text is preserved.
- [ ] Reload the extension and confirm Workflow Lab still restores the same draft.
- [ ] Paste intentionally invalid JSON in Workflow Lab and confirm it is preserved after close and reopen.
- [ ] Click `Load sample workflow` in Workflow Lab and confirm the sample JSON remains after reopening the window.

### Cross-Surface Persistence

- [ ] Save a unique draft in Automation Tester and then open Workflow Lab.
- [ ] Confirm Workflow Lab shows the same draft text.
- [ ] Change the draft in Workflow Lab, close it, and reopen the side panel.
- [ ] Confirm Automation Tester shows the updated Workflow Lab draft.
- [ ] Confirm both surfaces use the same persisted storage-backed draft instead of separate keys.

## Conditional-Only UI

- [ ] Confirm Automation Tester does not show the legacy prompt textarea.
- [ ] Confirm Automation Tester does not show a `Run automation` button.
- [ ] Confirm Automation Tester does not show a `Run dry run` button.
- [ ] Confirm Automation Tester still shows:
  - [ ] `Select Excel File`
  - [ ] `Open Workflow Lab`
  - [ ] `Export Causal Report`
  - [ ] `Load sample workflow`
  - [ ] `Run conditional workflow`
- [ ] Confirm the side panel console does not show null-binding errors after opening the Automation Tester tab.

## Conditional Workflow Execution

- [ ] Load the sample conditional workflow from Automation Tester.
- [ ] Select an Excel file when the workflow includes a prompt node with `attachFile: true`.
- [ ] Run the conditional workflow and confirm the result area shows:
  - [ ] status
  - [ ] trace id
  - [ ] workflow id
  - [ ] visited nodes
  - [ ] variables
  - [ ] decisions
- [ ] Confirm Workflow Lab can also run the same conditional workflow successfully.
- [ ] Confirm workflow run JSON can still be saved through the gateway when a selected file is present.

## Internal Prompt Turn Primitive

- [ ] Confirm `RUN_AUTOMATION` is still treated as an internal low-level primitive for conditional prompt nodes.
- [ ] Confirm no user-facing UI depends on directly invoking `RUN_AUTOMATION`.
- [ ] Confirm conditional prompt nodes still execute through `DeepSeekPromptTurnRunner`.

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

- [ ] Try running a conditional workflow with invalid JSON and confirm a parse error appears without losing the draft text.
- [ ] Try running a file-attaching conditional workflow without selecting a file and confirm the expected error still appears.
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
- [ ] conditional workflow draft persistence is healthy in Automation Tester
- [ ] conditional workflow draft persistence is healthy in Workflow Lab
- [ ] conditional-only UI is confirmed
- [ ] conditional workflow execution smoke test passes
- [ ] DeepSeek content ping still works
- [ ] diagnostics export still works
