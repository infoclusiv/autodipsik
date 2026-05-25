# Repository Analysis — autodipsik

## Purpose

This repository is a Chrome MV3 automation lab for DeepSeek workflows backed by a local Python WebSocket gateway. The active product flow lets the side panel select Excel files through the local gateway, open/target DeepSeek, execute conditional multi-prompt workflows, capture DeepSeek responses, and save JSON/AHK outputs beside the selected source file.

## Current architecture observed

### Extension entrypoints

- `manifest.json`
  - Registers `background-main.js` as the MV3 service worker.
  - Registers content-script chains for:
    - `https://example.com/*` using `sites/newsite/*`
    - `https://chat.deepseek.com/*` using `sites/deepseek/*`
  - Registers `sidepanel/sidepanel.html` as the side panel.
- `background-main.js`
  - Uses `importScripts(...)`.
  - Acts as the service-worker composition root.
  - Loads core constants/contracts/storage/diagnostics, gateway protocol/client, site profiles, background services, workflows, message handlers, router, and bootstrap.
  - Starts with `NewSiteBackground.BackgroundBootstrap.start()`.
- `sidepanel/sidepanel.html`
  - Loads core modules and sidepanel modules through ordered `<script>` tags.
  - Mounts `ProfileEditorController`, `AutomationTesterController`, and `DiagnosticsController` through `sidepanel/bootstrap.js`.
- `workflowLab/workflowLab.html`
  - Separate popup/tooling surface for workflow JSON drafting and execution.
  - Shares the same conditional workflow draft storage concept as Automation Tester.

### Background runtime

- `background/bootstrap.js`
  - Hydrates telemetry.
  - Configures side panel behavior.
  - Updates runtime status.
  - Registers Chrome lifecycle and runtime-message listeners.
- `background/messageRouter.js`
  - Validates base messages.
  - Adds trace IDs.
  - Emits background message telemetry.
  - Routes message types into `background/messageHandlers/*`.
- `background/messageHandlers/*`
  - `automationHandlers.js`: delegates conditional workflow and low-level automation.
  - `gatewayHandlers.js`: delegates gateway connect/select/execute operations.
  - `tabHandlers.js`: DeepSeek tab/page-state forwarding.
  - `diagnosticsHandlers.js`: diagnostics exports.
  - `profileHandlers.js`: profile CRUD.
- `background/services/*`
  - `gatewayFileService.js` is currently a large mixed-responsibility module:
    - gateway connection
    - single and multi-file selection
    - select-by-id
    - content payload resolution
    - response/workflow/AHK persistence requests
  - `deepseekTabService.js` controls tab readiness and forwarding.
  - `runtimeStatusService.js`, `activeTabForwarder.js`, and `siteProfileResolver.js` support routing/status/profile behavior.
- `background/workflows/*`
  - `deepseekConditionalWorkflow.js` orchestrates one conditional workflow run.
  - `deepseekBatchConditionalWorkflow.js` sequentially executes multiple selected files.
  - `deepseekPromptTurnRunner.js` is the internal prompt-turn primitive used by conditional workflow prompt nodes.

### Core runtime

- `core/constants/messageTypes.js`, `storageKeys.js`, and `telemetryEvents.js` define domain-specific constants.
- `core/constants.js` merges domain constants into compatibility facades such as `NewSiteCore.MESSAGE_TYPES`.
- `core/gatewayProtocol.js` defines extension-side gateway envelope and message type helpers.
- `core/gatewayClient.js` owns WebSocket connection lifecycle, reconnect, heartbeat, pending requests, gateway status persistence, and selected file state.
- `core/workflow/conditionalWorkflowEngine.js` is a pure-ish workflow engine for node traversal:
  - `prompt`
  - `regex_extract`
  - `condition`
  - `end`/unknown finalization behavior
- `core/workflow/regexExtractor.js` and `conditionEvaluator.js` support workflow logic.
- `core/workflow/conditionalWorkflowDraftStorage.js` persists the shared workflow JSON draft.

### DeepSeek content runtime

- `sites/deepseek/content.js`
  - Owns singleton guard.
  - Registers `chrome.runtime.onMessage`.
  - Handles selector tests, page-state detection, run automation, content ping, diagnostics, and file attach.
- `sites/deepseek/chatAutomator.js`
  - Very large workflow implementation.
  - Contains helper functions, readiness gate logic, send-button heuristics, file attachment, workflow step definitions, response capture, failure diagnostic package creation, and selector testing.
- `sites/deepseek/diagnostics/deepseekComposerProbe.js`
  - Encapsulates much of the observable state probing used by readiness gates.
- `sites/deepseek/responseCapture.js`
  - Waits for final assistant response and stable text.

### Sidepanel runtime

- `sidepanel/automationTester/automationTester.controller.js`
  - Large controller owning UI event binding, gateway connect/disconnect, single/multi-file selection, workflow JSON parse/draft persistence, run logic, state updates, and toasts.
- `sidepanel/automationTester/automationTester.render.js`
  - Large HTML string renderer.
  - Mixes many independent sections: header metrics, workflow editor, result metrics, batch summary, selected files, selected file details, last run summary, runtime snapshot, timeline, advanced actions.
- `sidepanel/automationTester/automationRunOrchestrator.js`
  - Thin messaging adapter for conditional single/batch workflow runs.
- `workflowLab/workflowLab.controller.js`
  - Duplicates the sample conditional workflow and draft persistence logic found in Automation Tester.

### Python gateway

- `app-python/run_gateway.py` -> `autodipsik_gateway/main.py` -> `websocket/server.py`.
- `websocket/server.py`
  - Creates `FileStore`, `JsonlLogger`, and `GatewayHandlers`.
  - Accepts WebSocket messages, parses JSON, delegates to handlers, and sends envelopes.
- `websocket/handlers.py`
  - Currently monolithic.
  - Handles:
    - `HELLO`
    - `PING`
    - `FILE_PICKER_OPEN_REQUEST`
    - `FILE_PICKER_OPEN_MULTIPLE_REQUEST`
    - `FILE_SELECT_BY_ID_REQUEST`
    - `FILE_CONTENT_REQUEST`
    - `FILE_CONTENT_BY_PATH_REQUEST`
    - `SAVE_DEEPSEEK_RESPONSE_JSON`
    - `SAVE_DEEPSEEK_WORKFLOW_RUN_JSON`
    - `SAVE_DEEPSEEK_WORKFLOW_AHK_FILE`
- `files/file_store.py`
  - Tracks selected file and selected batch.
- `files/response_writer.py`
  - Writes response JSON, workflow-run JSON, and AHK file outputs.
- `tests/test_handlers.py`
  - Existing Python tests cover AHK save, missing file, missing tags, multi-file picker, select-by-id, and unknown file id.

## Key constraints for implementation

1. Do not introduce a bundler, TypeScript, ESM, React, or npm/pnpm dependency unless a later explicit decision is made.
2. Preserve MV3 script-load order. New browser-side modules must be loaded before modules that consume their globals.
3. Preserve global namespace patterns:
   - `NewSiteCore`
   - `NewSiteBackground`
   - `NewSiteSidepanel`
   - `DeepSeekAutomation`
   - `WorkflowLab`
4. Preserve public API compatibility during extraction phases. Existing call sites should continue to work even if implementation moves behind delegating facades.
5. Do not change message type strings, storage keys, telemetry event names, or gateway protocol envelopes during modularization.
6. Keep the manual regression checklist as the gate after every refactor phase.
7. Use the existing Python tests after every Python gateway phase.
8. Prioritize extraction of pure helpers and delegated submodules before moving orchestration code.

## High-risk areas

- `background-main.js` and `manifest.json` script order.
- `sidepanel/sidepanel.html` and `workflowLab/*.html` script order.
- Any module that depends on globals created by earlier scripts.
- `GatewayFileService` public methods, because several background workflows depend on them.
- `DeepSeekConditionalWorkflow.run(...)`, because batch execution delegates to it.
- `ChatAutomator.runMainAutomation(...)`, because its step order and diagnostic package output are behavior-critical.
- Python `GatewayHandlers.handle(...)`, because protocol responses must remain exact.
