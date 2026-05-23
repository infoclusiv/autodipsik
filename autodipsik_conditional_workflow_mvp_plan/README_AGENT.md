# README_AGENT.md

# Autodipsik Conditional Workflow MVP — Agent Execution Guide

## Purpose

This archive contains an incremental implementation plan for the first functional version of conditional multi-prompt workflows in `infoclusiv/autodipsik`.

The MVP goal is:

1. Keep the existing one-click Automation Tester working.
2. Add a declarative conditional workflow format.
3. Run prompt 1 against DeepSeek with the selected Excel file.
4. Capture the DeepSeek response.
5. Extract a variable using regex.
6. Branch to a second prompt based on the extracted value.
7. Capture the final response.
8. Save a multi-turn JSON result through the Python gateway.
9. Expose the feature through a minimal UI before building a full visual workflow canvas.

This plan intentionally avoids building a visual node editor first. The first functional version should use a JSON workflow definition UI, because that reduces scope and makes the runtime behavior testable before the workflow canvas exists.

## Repository architecture observed before creating this plan

The current architecture is already modular and should be preserved:

- `manifest.json` registers `background-main.js` as the MV3 service worker.
- `background-main.js` is the background composition root and loads core modules, site modules, background services, workflows, handlers, router, and bootstrap.
- `sidepanel/sidepanel.html` loads shared core modules, sidepanel shared helpers, `profileEditor/*`, `automationTester/*`, `diagnostics/*`, and `sidepanel/bootstrap.js`.
- `sidepanel/bootstrap.js` mounts `ProfileEditorController`, `AutomationTesterController`, and `DiagnosticsController`.
- `sidepanel/automationTester/automationTester.controller.js` currently calls `AutomationRunOrchestrator.runOneClick()`.
- `sidepanel/automationTester/automationRunOrchestrator.js` sends `MESSAGE_TYPES.AUTOMATION_ONE_CLICK_RUN`.
- `background/messageRouter.js` routes `MESSAGE_TYPES.AUTOMATION_ONE_CLICK_RUN` to `AutomationHandlers.runOneClick`.
- `background/messageHandlers/automationHandlers.js` delegates one-click execution to `DeepSeekOneClickWorkflow.run(message)`.
- `background/workflows/deepseekOneClickWorkflow.js` coordinates gateway readiness, selected file, DeepSeek tab readiness, preflight, actual automation, response capture, and JSON save.
- `sites/deepseek/chatAutomator.js` owns the actual browser-side workflow steps, including prompt insertion, send button click, response capture, and diagnostic package creation.
- `sites/deepseek/responseCapture.js` captures the latest visible assistant message after text stability.
- `background/services/gatewayFileService.js` talks to the Python gateway and currently saves single-response JSON through `SAVE_DEEPSEEK_RESPONSE_JSON`.
- `app-python/autodipsik_gateway/websocket/protocol.py`, `websocket/handlers.py`, and `files/response_writer.py` implement the Python gateway side of file selection, file serialization, and single-response JSON writing.

## Execution rules for the implementation agent

Read this file first.

Execute the phase files in strict order:

1. `phase-1.md`
2. `phase-2.md`
3. `phase-3.md`
4. `phase-4.md`
5. `phase-5.md`
6. `phase-6.md`
7. `phase-7.md`
8. `phase-8.md`
9. `phase-9.md`

Implement only one phase at a time.

Before coding each phase:

- Read the phase document completely.
- Analyze the repository and fully understand the related architecture and affected components.
- Validate that the proposed implementation matches the real current codebase behavior.
- Confirm that file paths, global namespaces, import order, message types, and runtime dependencies still match the repository.
- Do not assume this plan is correct if the code has changed.

During implementation:

- Follow the phase scope strictly.
- Avoid unrelated refactors.
- Avoid renaming existing public globals unless the phase explicitly requires it.
- Preserve the existing one-click Automation Tester behavior.
- Preserve existing single-response JSON saving.
- Preserve existing diagnostics and telemetry behavior.
- Prefer additive changes over invasive rewrites.
- Keep each phase independently testable.

After implementation:

- Verify every success criterion listed in the phase.
- Verify observable success and failure signals.
- Report any inconsistency, architectural conflict, missing information, or evidence that the plan no longer matches the codebase.
- Do not move to the next phase until the current phase is implemented and verified.

## Security and dependency rules

- Do not hardcode secrets, API keys, tokens, or local machine paths.
- Do not commit `.env` values.
- Use placeholders in `.env.example` if environment variables are needed.
- Do not add npm packages unless a later human decision explicitly approves it.
- If JavaScript package installation is ever needed, use `pnpm`, not `npm`.

## Architectural guardrails

Every phase must preserve or improve:

1. Modular Architecture
2. Explicit Component Contracts
3. Causal Contracts
4. AI-Ready Observability
5. Causal Diagnostic Layer
6. Diagnostic Package for AI Agent

## MVP definition of done

The MVP is done when a user can:

1. Open Automation Tester.
2. Select an Excel file.
3. Paste or load a sample conditional workflow JSON.
4. Run the conditional workflow.
5. Have prompt 1 sent to DeepSeek with the selected Excel file.
6. Have the response captured.
7. Have a regex extract a variable such as `tipo`.
8. Have the workflow branch to one of two follow-up prompts.
9. Have the final response captured.
10. Save a multi-turn workflow JSON file beside the selected Excel file through the Python gateway.
11. Still run the existing one-click automation unchanged.
