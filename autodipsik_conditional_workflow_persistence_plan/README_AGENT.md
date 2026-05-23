# README_AGENT — Autodipsik Conditional Workflow Persistence Plan

## Purpose

This archive contains an AI-safe incremental implementation plan for `infoclusiv/autodipsik`.

The requested product direction is:

1. Remove the legacy single-prompt run path from the user-facing extension workflow.
2. Make conditional workflow JSON persist across side panel reloads, extension reloads, Chrome close/reopen, and Workflow Lab close/reopen.
3. Keep the existing conditional workflow execution architecture intact and avoid regressions.

## Repository architecture summary observed before planning

The repository is a Chrome Manifest V3 extension with a DeepSeek automation flow and a local gateway bridge.

Important current components:

- `manifest.json`
  - Declares MV3, `storage`, `tabs`, `sidePanel`, `scripting`, `downloads`, `alarms`, `notifications`, and `activeTab` permissions.
  - Registers `background-main.js` as the service worker.
  - Registers content scripts for `https://example.com/*` and `https://chat.deepseek.com/*`.
  - Uses `sidepanel/sidepanel.html` as the side panel entry point.

- `background-main.js`
  - Loads core modules, gateway modules, conditional workflow modules, DeepSeek workflow modules, message handlers, the message router, and bootstrap code with `importScripts(...)`.
  - Currently imports both conditional workflow code and legacy one-click workflow code.

- `core/storage.js`
  - Provides `NewSiteCore.Storage` with `getValue`, `setValue`, and `removeValue` wrappers over `chrome.storage.local`.
  - Namespaces keys using `NewSiteCore.EXTENSION_CONFIG.storageNamespace`, currently `newsite`.

- `core/constants/storageKeys.js`
  - Defines existing storage keys for profiles, telemetry, diagnostics, runtime status, and gateway state.
  - Does not currently define a persisted conditional workflow draft key.

- `sidepanel/sidepanel.html`
  - Loads core modules, storage, messaging, profile editor, automation tester, diagnostics, and sidepanel bootstrap.

- `sidepanel/automationTester/automationTester.store.js`
  - Stores `conditionalWorkflowText` only in JavaScript memory.
  - Also stores legacy `promptText` and legacy one-click state.

- `sidepanel/automationTester/automationTester.render.js`
  - Renders a legacy single prompt section and a legacy `Run automation` button.
  - Also renders the conditional workflow JSON textarea and `Run conditional workflow` button.

- `sidepanel/automationTester/automationTester.controller.js`
  - Contains the sample conditional workflow JSON.
  - Reads the conditional workflow textarea when running the conditional workflow.
  - Does not currently load or save conditional workflow text to persistent storage.
  - Contains legacy single prompt functions: `runAutomation`, `runAutomationOneClick`, and related bindings.

- `sidepanel/automationTester/automationRunOrchestrator.js`
  - Sends legacy `AUTOMATION_ONE_CLICK_RUN` messages for one-click single-prompt automation.
  - Sends `CONDITIONAL_WORKFLOW_RUN` messages for conditional workflows.

- `workflowLab/workflowLab.html`
  - Separate full-window workflow runner.
  - Loads `core/config.js`, `messageTypes`, `storageKeys`, `telemetryEvents`, `constants`, `errors`, DeepSeek config, and workflow lab modules.
  - Does not currently load `core/storage.js`.

- `workflowLab/workflowLab.store.js`
  - Stores `conditionalWorkflowText` only in JavaScript memory.

- `workflowLab/workflowLab.controller.js`
  - Loads a sample conditional workflow.
  - Runs conditional workflows through `CONDITIONAL_WORKFLOW_RUN`.
  - Does not currently persist conditional workflow JSON.

- `background/workflows/deepseekConditionalWorkflow.js`
  - Validates conditional workflow definitions.
  - Ensures gateway connection.
  - Selects a file only when at least one prompt node has `attachFile: true`.
  - Ensures the DeepSeek tab, detects page state, runs the conditional workflow engine, and saves workflow run JSON through the gateway when possible.

- `core/workflow/conditionalWorkflowEngine.js`
  - Executes `prompt`, `regex_extract`, `condition`, and `end` nodes.
  - Depends on `runPromptTurn` for each prompt node.

- `background/workflows/deepseekPromptTurnRunner.js`
  - Runs one prompt turn as an internal primitive for conditional workflow prompt nodes.
  - This is not the same as the legacy user-facing one-click single-prompt feature.
  - Do not remove this module unless the real implementation has changed and conditional prompt nodes no longer depend on it.

- `background/workflows/deepseekOneClickWorkflow.js`
  - Implements the legacy user-facing one-click single-prompt workflow.
  - This is the executable path to remove after the UI no longer depends on it.

- `scripts/verify-cleanup.ps1`
  - Verifies referenced files exist in `manifest.json`, `sidepanel/sidepanel.html`, `background-main.js`, and DeepSeek fallback injection references.

## Execution rules for the implementation agent

Read this file first.

Then execute the phase files in order:

1. `phase-1.md`
2. `phase-2.md`
3. `phase-3.md`
4. `phase-4.md`
5. `phase-5.md`
6. `phase-6.md`

Implement only one phase at a time.

Before coding each phase:

- Read the phase document completely.
- Analyze the repository and fully understand the related architecture and affected components.
- Validate that the proposed implementation matches the real root cause and current codebase behavior.
- Confirm that files, functions, globals, message types, and script loading order still match this plan.
- If the repository has changed, adapt only within the same objective and scope.

During implementation:

- Follow the phase scope strictly.
- Avoid unrelated refactors or unnecessary changes.
- Preserve existing functionality and minimize regression risk.
- Do not remove low-level primitives used by conditional workflows.
- Do not install npm packages. Use existing plain JavaScript patterns already present in the extension.
- Do not hardcode secrets, API keys, personal data, or machine-specific paths.

After implementation:

- Verify all success criteria defined in the current phase document.
- Confirm observable signals and expected behavior.
- Report inconsistencies, architectural conflicts, missing information, or signs that the proposed plan may be incorrect before continuing.
- Do not move to the next phase until the current phase is implemented and verified.

## Critical guardrail

The user wants to remove the legacy **user-facing single-prompt workflow**, not the internal ability for a conditional workflow prompt node to send a prompt to DeepSeek.

Therefore:

- It is safe to remove the UI and message path for `AUTOMATION_ONE_CLICK_RUN` after verification.
- It is not safe to remove `MESSAGE_TYPES.RUN_AUTOMATION`, `background/workflows/deepseekPromptTurnRunner.js`, `sites/deepseek/chatAutomator.js`, or DeepSeek response capture logic unless the real codebase proves conditional workflows no longer depend on them.

## Recommended verification baseline before Phase 1

From the repository root on Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-cleanup.ps1
```

Also manually load the unpacked extension in Chrome and confirm:

- The side panel opens.
- Automation Tester renders without console errors.
- Workflow Lab opens from the side panel.
- Existing conditional workflow execution reaches the background handler when valid JSON is supplied.
