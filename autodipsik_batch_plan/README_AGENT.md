# README_AGENT — Autodipsik Multi-Excel Conditional Workflow Plan

## Purpose

This archive contains an incremental, AI-safe implementation plan for adding multi-Excel batch execution to `infoclusiv/autodipsik`.

Target behavior:

1. The user can select multiple Excel files from the same local folder through the existing Python gateway flow.
2. When the user clicks the existing **Run conditional workflow** button, the extension processes the selected Excel files sequentially using the current conditional workflow JSON.
3. The first Excel runs through the full conditional workflow and saves its `.ahk` output beside that Excel file.
4. After the first workflow completes, the extension opens a new `https://chat.deepseek.com/` tab in the same browser window and processes the second Excel with the same conditional workflow JSON.
5. The same pattern repeats until all selected Excel files have been processed.
6. Existing single-file behavior remains preserved.

## Repository alignment summary

The current active runtime is modular and should not be replaced with a monolithic implementation.

The active flow is:

```text
sidepanel/automationTester/automationTester.controller.js
  -> sidepanel/automationTester/automationRunOrchestrator.js
  -> chrome.runtime.sendMessage(...)
  -> background/messageRouter.js
  -> background/messageHandlers/automationHandlers.js
  -> background/workflows/deepseekConditionalWorkflow.js
  -> background/workflows/deepseekPromptTurnRunner.js
  -> background/services/gatewayFileService.js
  -> core/gatewayClient.js
  -> app-python/autodipsik_gateway/websocket/handlers.py
  -> sites/deepseek/content.js
  -> sites/deepseek/chatAutomator.js
```

Important current constraints discovered from the codebase:

- `manifest.json` registers `background-main.js` as the MV3 service worker and loads DeepSeek content scripts for `https://chat.deepseek.com/*`.
- `background-main.js` currently imports `background/workflows/deepseekConditionalWorkflow.js` and `background/workflows/deepseekPromptTurnRunner.js`.
- `sidepanel/automationTester/automationTester.controller.js` currently exposes **Select Excel File** and **Run conditional workflow**.
- `sidepanel/automationTester/automationRunOrchestrator.js` currently sends one `CONDITIONAL_WORKFLOW_RUN` message with `autoSelectFileIfMissing: true`.
- `background/workflows/deepseekConditionalWorkflow.js` currently resolves a single selected gateway file, runs one conditional workflow, then saves JSON and `.ahk` output.
- `background/services/deepseekTabService.js` currently calls `TabManager.ensureTab(...)`, which reuses an existing DeepSeek tab when one exists.
- `core/tabManager.js` currently finds a tab by URL pattern and updates it active, or creates a new tab if none exists.
- `app-python/autodipsik_gateway/files/file_picker.py` currently uses `filedialog.askopenfilename`, which selects only one file.
- `app-python/autodipsik_gateway/files/file_store.py` currently stores only one `_selected_file`.
- `app-python/autodipsik_gateway/websocket/handlers.py` currently validates save requests against the single current selected file.
- `app-python/autodipsik_gateway/files/response_writer.py` writes `.ahk` output beside the selected Excel using the Excel basename.

## Execution rules for the implementation agent

Read this file first.

Then execute the phase `.md` files in order:

1. `phase-1.md`
2. `phase-2.md`
3. `phase-3.md`
4. `phase-4.md`
5. `phase-5.md`
6. `phase-6.md`
7. `phase-7.md`

Implement only one phase at a time.

Before coding each phase:

- Read the phase document completely.
- Analyze the repository and fully understand the related architecture and affected components.
- Validate that the proposed implementation matches the real root cause and current codebase behavior.
- Confirm that file names, globals, message types, and import order still match the current repository.
- Confirm that the phase is still the smallest safe change needed.

During implementation:

- Follow the phase scope strictly.
- Avoid unrelated refactors or unnecessary changes.
- Preserve existing functionality and minimize regression risk.
- Do not rename existing public globals unless the phase explicitly requires it.
- Do not break the current single-file conditional workflow.
- Do not change DeepSeek selector heuristics unless a phase explicitly calls for it.
- Do not change `.ahk` generation logic except where a phase explicitly requires batch compatibility.

After implementation:

- Verify all success criteria defined in the phase document.
- Confirm observable signals and expected behavior.
- Run the smallest relevant automated checks available in the repo.
- Manually verify the extension behavior when a browser/DeepSeek step is required.
- Report any inconsistencies, architectural conflicts, missing information, or signs that the proposed plan may be incorrect before continuing.

Do not move to the next phase until the current phase is implemented and verified.

## Global stop conditions

Stop and report before coding if any of the following are true:

- `background-main.js` no longer imports `deepseekConditionalWorkflow.js` or `deepseekPromptTurnRunner.js`.
- `CONDITIONAL_WORKFLOW_RUN` is no longer routed through `background/messageRouter.js` and `background/messageHandlers/automationHandlers.js`.
- The active sidepanel is no longer `sidepanel/automationTester/*`.
- The Python gateway no longer uses `GatewayHandlers.handle()` for file picker and save requests.
- The repository has already implemented multi-file selection or batch conditional workflow execution in a different architecture.
- DeepSeek tab management has already been replaced with an explicit tab/session router.
- There are no reliable tests or manual verification paths for the current phase.

## Recommended verification commands

Use the commands that actually exist in the repo. Do not invent missing scripts. Based on the current repository, likely useful checks include:

```powershell
# From repository root, if the Python environment is already prepared:
python -m pytest app-python/autodipsik_gateway/tests

# Existing cleanup verification mentioned in README.md:
powershell -ExecutionPolicy Bypass -File scripts/verify-cleanup.ps1
```

If a command is missing or fails due to environment setup, report the exact error and continue only when the phase can still be manually verified.
