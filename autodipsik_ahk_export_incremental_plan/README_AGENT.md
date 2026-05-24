# README_AGENT — Autodipsik AHK Export Implementation Plan

## Purpose

This archive contains an incremental, AI-safe implementation plan for adding AutoHotkey (`.ahk`) file generation after a DeepSeek conditional workflow completes.

The user’s workflow expects the final DeepSeek response to contain AutoHotkey code wrapped exactly between:

```text
<<<archivo ahk>>>
[AUTOHOTKEY CODE]
<<</archivo ahk>>>
```

The implementation must extract only the code between those tags from the captured conditional workflow result, then write a `.ahk` file beside the selected Excel file. The `.ahk` filename must use the same basename as the selected Excel file.

Example:

```text
Selected Excel:
C:\Users\carlo\Downloads\student-file.xlsx

Generated AHK:
C:\Users\carlo\Downloads\student-file.ahk
```

## Repository alignment summary

Before implementing, confirm these observations against the real current codebase:

- The browser extension is a Chrome Manifest V3 extension.
- `manifest.json` loads `background-main.js` as the service worker.
- `background-main.js` imports the core workflow modules, gateway modules, DeepSeek modules, and background handlers.
- Conditional workflows are run by `background/workflows/deepseekConditionalWorkflow.js`.
- The workflow graph is executed by `core/workflow/conditionalWorkflowEngine.js`.
- Prompt turns are delegated through `background/workflows/deepseekPromptTurnRunner.js`.
- Captured DeepSeek responses are stored in `workflowRun.turns[*].response.text`.
- The existing workflow run JSON is saved after successful conditional workflow completion through `GatewayFileService.saveDeepSeekWorkflowRunJson(...)`.
- The local Python gateway already writes the workflow run JSON beside the selected Excel file through `write_deepseek_workflow_run_json(...)` in `app-python/autodipsik_gateway/files/response_writer.py`.
- The gateway protocol currently has message types for JSON saves but not for `.ahk` generation.
- The side panel currently displays the workflow run JSON save result, but not an AHK save result.

## Mandatory execution rules

Read this file first.

Execute the phase `.md` files in order:

1. `phase-1.md`
2. `phase-2.md`
3. `phase-3.md`
4. `phase-4.md`
5. `phase-5.md`

Implement only one phase at a time.

Before coding each phase:

- Read the phase document completely.
- Analyze the repository and fully understand the related architecture and affected components.
- Validate that the proposed implementation matches the real root cause and current codebase behavior.
- Confirm that the files and functions named in the phase still exist and still have the expected responsibilities.
- Confirm that the selected Excel file metadata available in Python still includes a real filesystem path through `StoredFile.path`.

During implementation:

- Follow the phase scope strictly.
- Avoid unrelated refactors or unnecessary changes.
- Preserve existing functionality and minimize regression risk.
- Keep changes small and easy to review.
- Do not change DeepSeek DOM selectors, response capture behavior, workflow graph semantics, or side panel layout beyond the phase scope.
- Do not introduce external dependencies unless the phase explicitly requires them. This plan does not require new Python or JavaScript dependencies.
- Preserve the existing AI-ready observability pattern: trace IDs, workflow IDs, expected vs actual, structured errors, gateway logs, and diagnostic snapshots.

After implementation:

- Verify all success criteria defined in the phase document.
- Confirm observable signals and expected behavior.
- Report any inconsistencies, architectural conflicts, missing information, or signs that the proposed plan may be incorrect before continuing.
- Do not move to the next phase until the current phase is implemented and verified.

## Global stop conditions

Stop before coding, or stop after the current small change, if any of these are true:

- The repository no longer has the same background/gateway/conditional workflow architecture.
- The Python gateway no longer owns writing files beside the selected Excel file.
- `StoredFile.path` is no longer available or no longer points to the selected Excel file path.
- `workflowRun.turns[*].response.text` is no longer where captured DeepSeek responses are stored.
- The final conditional workflow result is not available to the background after execution.
- The current codebase already has an AHK export implementation that satisfies the requirement.
- The implementation would require changing the DeepSeek content script response capture logic, unless a later investigation proves response capture is the root cause.
- The user’s workflow tags are different from `<<<archivo ahk>>>` and `<<</archivo ahk>>>`.

## Target behavior after all phases

When the user runs the attached conditional workflow:

1. The extension connects to the local Python gateway.
2. The user selects an Excel file.
3. The conditional workflow runs against DeepSeek.
4. The final DeepSeek response is captured.
5. The existing workflow run JSON continues to be saved beside the Excel file.
6. The new AHK export logic extracts the text between `<<<archivo ahk>>>` and `<<</archivo ahk>>>`.
7. The Python gateway writes an `.ahk` file beside the selected Excel file.
8. The `.ahk` file uses the exact same basename as the selected Excel file.
9. The side panel shows that the AHK file was generated.
10. If the tags are missing or the extracted code is empty, the failure is explicit and observable with expected vs actual diagnostics.
