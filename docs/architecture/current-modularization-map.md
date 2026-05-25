# Current Modularization Map

Date: 2026-05-24

## Scope

This document captures the active runtime structure after the conditional-workflow, DeepSeek content-script, sidepanel, and Python gateway modularization phases.

It is intended to reflect the actual current runtime owners and loader order, not historical one-click or pre-gateway architecture.

## Runtime Entrypoints

### Extension service worker

`manifest.json` registers `background-main.js` as the MV3 service worker.

`background-main.js` is the composition root and script loader. It loads, in order:

1. core constants, contracts, telemetry, storage, and diagnostics modules
2. core conditional-workflow helpers and engine
3. gateway protocol/client and shared workflow runner utilities
4. `sites/newsite/*` and `sites/deepseek/*` configuration/profile modules
5. background services under `background/services/*`
6. background workflows:
   - `background/workflows/deepseekPromptTurnRunner.js`
   - `background/workflows/deepseekConditionalWorkflowSupport.js`
   - `background/workflows/deepseekConditionalWorkflow.js`
   - `background/workflows/deepseekBatchItemRunner.js`
   - `background/workflows/deepseekBatchConditionalWorkflow.js`
7. background message handlers under `background/messageHandlers/*`
8. `background/messageRouter.js`
9. `background/bootstrap.js`

After load, the only direct startup call is:

```text
NewSiteBackground.BackgroundBootstrap.start()
```

### Sidepanel

`manifest.json` sets `side_panel.default_path` to `sidepanel/sidepanel.html`.

`sidepanel/sidepanel.html` loads:

1. shared core config/constants/storage modules
2. shared conditional workflow draft/sample modules:
   - `core/workflow/conditionalWorkflowDraftStorage.js`
   - `core/workflow/conditionalWorkflowSamples.js`
   - `core/workflow/conditionalWorkflowDraftSession.js`
3. shared telemetry/contracts/diagnostics helpers
4. site profile modules for `newsite` and DeepSeek
5. sidepanel shared UI modules
6. `profileEditor/*`
7. `automationTester/*`
8. `diagnostics/*`
9. `sidepanel/bootstrap.js`

Active Automation Tester composition is:

```text
automationTester.store.js
  -> automationTester.adapters.js
  -> automationRunOrchestrator.js
  -> automationTester.sections.js
  -> automationTester.render.js
  -> automationTester.controller.js
```

### Workflow Lab

`workflowLab/workflowLab.html` loads:

1. shared core config/constants/storage modules
2. `core/workflow/conditionalWorkflowDraftStorage.js`
3. `core/workflow/conditionalWorkflowSamples.js`
4. `core/workflow/conditionalWorkflowDraftSession.js`
5. `sites/deepseek/config.js`
6. `workflowLab.store.js`
7. `workflowLab.render.js`
8. `workflowLab.controller.js`
9. `workflowLab/bootstrap.js`

### Content scripts

`manifest.json` still registers two active content-script chains:

- `https://example.com/*` -> `sites/newsite/*`
- `https://chat.deepseek.com/*` -> `sites/deepseek/*`

The active DeepSeek chain now loads:

1. core constants/contracts/diagnostics/runtime helpers
2. `sites/deepseek/config.js`
3. `sites/deepseek/siteProfile.js`
4. `sites/deepseek/selectors.js`
5. `sites/deepseek/domHelpers.js`
6. `sites/deepseek/pageState.js`
7. `sites/deepseek/filePayloadHelpers.js`
8. `sites/deepseek/diagnostics/deepseekComposerProbe.js`
9. `sites/deepseek/responseCapture.js`
10. `sites/deepseek/chatAutomatorReadiness.js`
11. `sites/deepseek/chatAutomatorSteps.js`
12. `sites/deepseek/chatAutomator.js`
13. `sites/deepseek/contentHandlers.js`
14. `sites/deepseek/content.js`

### Python gateway

The Python gateway entrypoint chain is:

```text
app-python/run_gateway.py
  -> autodipsik_gateway/main.py
  -> autodipsik_gateway/websocket/server.py
  -> autodipsik_gateway/websocket/handlers.py
```

`handlers.py` is now a dispatcher over:

- `autodipsik_gateway/websocket/file_handlers.py`
- `autodipsik_gateway/websocket/save_handlers.py`

## Background Ownership

### `background/bootstrap.js`

Owns:

- background startup wiring
- Chrome lifecycle listeners
- sidepanel behavior integration
- runtime status refresh orchestration
- `chrome.runtime.onMessage` registration through the message router

### `background/messageRouter.js`

Owns:

- message validation and trace ID normalization
- routing by message type
- background telemetry for message receipt/failure
- unsupported-message normalization

### `background/messageHandlers/*`

Owns:

- `profileHandlers.js`: profile get/save/reset
- `diagnosticsHandlers.js`: diagnostics export flows
- `gatewayHandlers.js`: gateway status/connect/disconnect and file-selection requests
- `tabHandlers.js`: active-tab forwarding, DeepSeek tab ensure, selector/page-state forwarding
- `automationHandlers.js`: conditional workflow and batch workflow entrypoints

### `background/services/*`

Owns:

- `siteProfileResolver.js`: site profile service selection
- `runtimeStatusService.js`: runtime status snapshot computation
- `activeTabForwarder.js`: tab-scoped message forwarding
- `deepseekTabService.js`: DeepSeek tab discovery/readiness forwarding
- `gatewayPersistenceService.js`: gateway save-path persistence helpers
- `gatewayFileService.js`: gateway file metadata, file payload, and file selection facade

### `background/workflows/*`

Owns:

- `deepseekPromptTurnRunner.js`: single prompt-turn execution primitive used by conditional workflow nodes
- `deepseekConditionalWorkflowSupport.js`: normalization, telemetry, persistence wrappers, and stage helpers for conditional workflow runs
- `deepseekConditionalWorkflow.js`: top-level single conditional workflow orchestration
- `deepseekBatchItemRunner.js`: per-file batch item execution
- `deepseekBatchConditionalWorkflow.js`: sequential batch orchestration and batch result shaping

## Sidepanel Ownership

### Shared workflow draft/sample modules

Shared ownership:

- `conditionalWorkflowSamples.js`: shared sample workflow payload
- `conditionalWorkflowDraftSession.js`: shared debounce/session persistence logic
- `conditionalWorkflowDraftStorage.js`: storage-backed draft persistence

These are shared by both Automation Tester and Workflow Lab.

### `sidepanel/automationTester/*`

Owns:

- `automationTester.store.js`: UI state container
- `automationTester.adapters.js`: gateway-status application, file selection normalization, selected-file lookup, conditional workflow input building
- `automationRunOrchestrator.js`: runtime message orchestration for workflow execution
- `automationTester.sections.js`: card-level HTML section builders
- `automationTester.render.js`: view-model assembly and full-screen composition
- `automationTester.controller.js`: DOM binding, rerendering, message sending, toasts, and user action orchestration

### `workflowLab/*`

Owns:

- workflow-lab-specific state/render/controller/bootstrap
- full-window conditional workflow editing and execution surface
- shared draft/session integration with Automation Tester

## DeepSeek Runtime Ownership

### `sites/deepseek/content.js`

Owns only:

- singleton guard
- content-script loaded timestamp
- `chrome.runtime.onMessage` registration
- delegation to `DeepSeekAutomation.DeepSeekContentHandlers.handleMessage(message)`
- structured catch behavior for failed message handling

### `sites/deepseek/contentHandlers.js`

Owns:

- selector test/test-all handling
- page-state detection handling
- `RUN_AUTOMATION` entry delegation
- DeepSeek content ping
- diagnostics payload response
- browser-side file attachment from gateway payloads

### `sites/deepseek/chatAutomatorReadiness.js`

Owns:

- attachment-readiness interpretation
- readiness failure aggregation
- attachment stability failure aggregation
- shared prompt/send-button helper interpretation functions safe to reuse

### `sites/deepseek/chatAutomatorSteps.js`

Owns:

- construction of the `steps` array used by `runMainAutomation(...)`
- stable step names and order from `validate_input` through `finalize`
- explicit dependency consumption through the `helpers` object

### `sites/deepseek/chatAutomator.js`

Owns:

- `DeepSeekAutomation.ChatAutomator.runMainAutomation(...)`
- input normalization
- helper functions used by readiness loops and step execution
- `WorkflowRunner.runWorkflow(...)` invocation
- failure diagnostic package assembly
- `testAllSelectors(...)`

## Python Gateway Ownership

### `autodipsik_gateway/websocket/handlers.py`

Owns:

- top-level protocol dispatch
- `HELLO` and `PING`
- delegation of file messages to `GatewayFileHandlers`
- delegation of save messages to `GatewaySaveHandlers`

### `autodipsik_gateway/websocket/file_handlers.py`

Owns:

- `FILE_PICKER_OPEN_REQUEST`
- `FILE_PICKER_OPEN_MULTIPLE_REQUEST`
- `FILE_SELECT_BY_ID_REQUEST`
- `FILE_CONTENT_REQUEST`
- `FILE_CONTENT_BY_PATH_REQUEST`
- shared file validation used by those routes

### `autodipsik_gateway/websocket/save_handlers.py`

Owns:

- `SAVE_DEEPSEEK_RESPONSE_JSON`
- `SAVE_DEEPSEEK_WORKFLOW_RUN_JSON`
- `SAVE_DEEPSEEK_WORKFLOW_AHK_FILE`
- shared selected-file validation for save routes

### `autodipsik_gateway/files/response_writer.py`

Still owns:

- DeepSeek response JSON writing
- workflow-run JSON writing
- workflow AHK extraction/writing

This file remains the persistence writer and was not modularized further in these phases.

## Canonical Runtime Flows

### Conditional workflow from sidepanel

```text
sidepanel/automationTester.controller.js
  -> automationRunOrchestrator.js
  -> chrome.runtime.sendMessage(...)
  -> background/messageRouter.js
  -> background/messageHandlers/automationHandlers.js
  -> background/workflows/deepseekConditionalWorkflow.js
  -> background/workflows/deepseekPromptTurnRunner.js
  -> background/services/deepseekTabService.js
  -> sites/deepseek/content.js
  -> sites/deepseek/contentHandlers.js
  -> sites/deepseek/chatAutomator.js
  -> sites/deepseek/chatAutomatorSteps.js
```

### Gateway file/save path

```text
background/services/gatewayFileService.js
  -> core/gatewayClient.js
  -> autodipsik_gateway/websocket/handlers.py
  -> autodipsik_gateway/websocket/file_handlers.py
  -> autodipsik_gateway/websocket/save_handlers.py
  -> autodipsik_gateway/files/response_writer.py
```

## Documentation Integrity Notes

- `background/workflows/deepseekOneClickWorkflow.js` is not an active runtime owner and should not be treated as the current workflow entrypoint.
- `sidepanel/deepseekUpload/*` is not part of the active sidepanel runtime.
- `sites/newsite/*` remains intentionally loaded as the template/lab path.
- `runtime/python-events.jsonl` remains a generated runtime artifact path.

## Verification Notes

- Python `pytest` commands described in the plan remain blocked in this local environment because `pytest` is not installed.
- Gateway startup and direct Python smoke runs have been used locally to validate the current modularization where feasible from the CLI.
- Manual Chrome extension regression still needs to be completed using `docs/testing/manual-regression-checklist.md`.
