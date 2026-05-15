# Current Modularization Map

Date: 2026-05-15

## Scope

This document captures the current load order, namespaces, dependencies, message flows, and observability touchpoints before the modularization refactor starts.

## Script Load Order

### Extension service worker

`manifest.json` loads `background-main.js` as the MV3 service worker.

`background-main.js` then loads scripts in this exact order through `importScripts(...)`:

1. `core/config.js`
2. `core/constants.js`
3. `core/errors.js`
4. `core/storage.js`
5. `core/telemetry.js`
6. `core/observabilityContracts.js`
7. `core/gatewayProtocol.js`
8. `core/gatewayClient.js`
9. `core/messaging.js`
10. `core/tabManager.js`
11. `core/workflowRunner.js`
12. `core/diagnosticRedactor.js`
13. `core/diagnosticExporter.js`
14. `core/diagnosticStore.js`
15. `sites/newsite/config.js`
16. `sites/newsite/contracts.js`
17. `sites/newsite/siteProfile.js`
18. `sites/deepseek/config.js`
19. `sites/deepseek/siteProfile.js`

Current composition root and business logic host:

- `background-main.js`

### DeepSeek content script

`manifest.json` loads the following for `https://chat.deepseek.com/*`:

1. `core/config.js`
2. `core/constants.js`
3. `core/errors.js`
4. `core/storage.js`
5. `core/telemetry.js`
6. `core/observabilityContracts.js`
7. `core/workflowRunner.js`
8. `core/diagnosticRedactor.js`
9. `core/diagnosticExporter.js`
10. `core/diagnosticStore.js`
11. `sites/deepseek/config.js`
12. `sites/deepseek/siteProfile.js`
13. `sites/deepseek/selectors.js`
14. `sites/deepseek/domHelpers.js`
15. `sites/deepseek/pageState.js`
16. `sites/deepseek/chatAutomator.js`
17. `sites/deepseek/content.js`

### Newsite content script

`manifest.json` loads the following for `https://example.com/*`:

1. `core/config.js`
2. `core/constants.js`
3. `core/errors.js`
4. `core/storage.js`
5. `core/telemetry.js`
6. `core/observabilityContracts.js`
7. `core/workflowRunner.js`
8. `core/diagnosticRedactor.js`
9. `core/diagnosticExporter.js`
10. `core/diagnosticStore.js`
11. `sites/newsite/config.js`
12. `sites/newsite/siteProfile.js`
13. `sites/newsite/contracts.js`
14. `sites/newsite/selectors.js`
15. `sites/newsite/domHelpers.js`
16. `sites/newsite/pageState.js`
17. `sites/newsite/automator.js`
18. `sites/newsite/content.js`

### Sidepanel

`sidepanel/sidepanel.html` loads scripts in this exact order:

1. `../core/config.js`
2. `../core/constants.js`
3. `../core/errors.js`
4. `../core/storage.js`
5. `../core/telemetry.js`
6. `../core/observabilityContracts.js`
7. `../core/diagnosticRedactor.js`
8. `../core/diagnosticExporter.js`
9. `../sites/newsite/config.js`
10. `../sites/newsite/contracts.js`
11. `../sites/newsite/siteProfile.js`
12. `../sites/deepseek/config.js`
13. `../sites/deepseek/siteProfile.js`
14. `shared/dom.js`
15. `shared/toast.js`
16. `shared/logView.js`
17. `shared/chromeMessaging.js`
18. `profileEditor/profileEditor.store.js`
19. `profileEditor/profileEditor.render.js`
20. `profileEditor/profileEditor.controller.js`
21. `automationTester/automationTester.store.js`
22. `automationTester/automationRunOrchestrator.js`
23. `automationTester/automationTester.render.js`
24. `automationTester/automationTester.controller.js`
25. `diagnostics/diagnostics.store.js`
26. `diagnostics/diagnostics.render.js`
27. `diagnostics/diagnostics.controller.js`
28. `bootstrap.js`

## Global Namespaces

### Core

- `NewSiteCore`
  - Declared and extended by the files under `core/`
  - Current shared members include:
    - `MESSAGE_TYPES`
    - `STORAGE_KEYS`
    - `TELEMETRY_EVENTS`
    - `Errors`
    - `Storage`
    - `Telemetry`
    - `GatewayProtocol`
    - `GatewayClient`
    - `Messaging`
    - `TabManager`
    - `WorkflowRunner`
    - `DiagnosticRedactor`
    - `DiagnosticExporter`
    - `DiagnosticStore`

### Newsite automation

- `NewSiteAutomation`
  - `NEWSITE_CONFIG`
  - `SiteProfile`
  - `NewSiteContracts`
  - `NewSiteSelectors`
  - `NewSiteDomHelpers`
  - `NewSitePageState`
  - `NewSiteAutomator`

### DeepSeek automation

- `DeepSeekAutomation`
  - `DEEPSEEK_CONFIG`
  - `DeepSeekSiteProfile`
  - `DeepSeekSelectors`
  - `DeepSeekDomHelpers`
  - `DeepSeekPageState`
  - `ChatAutomator`
  - Runtime flags from `content.js`:
    - `__contentScriptInitialized`
    - `__contentScriptLoadedAt`

### Sidepanel

- `NewSiteSidepanel`
  - `ChromeMessaging`
  - `Toast`
  - `LogView`
  - feature stores, renders, controllers, orchestrators

## Current Module Responsibilities

### `background-main.js`

This file is currently the service-worker composition root and the main orchestration module. It owns:

- background bootstrap
- runtime status updates
- message routing
- profile resolution by target site
- forwarding to active tab
- forwarding to DeepSeek tab
- gateway connection management
- gateway file selection
- gateway upload execution
- resolving gateway file payloads for automation
- ensuring the DeepSeek tab exists and is healthy
- one-click automation orchestration
- diagnostic export
- Chrome listener registration

### `sites/deepseek/content.js`

This file currently mixes adapter and feature logic:

- content script singleton guard
- runtime message listener
- selector test handlers
- page-state detection
- DeepSeek automation entry point
- diagnostics response
- content-script ping
- base64 to `File` conversion
- browser-side file attachment

### `sites/deepseek/chatAutomator.js`

This file currently mixes workflow steps, heuristics, diagnostics, and lower-level helpers:

- file payload conversion
- attachment through file input
- chat input lookup heuristics
- send button lookup heuristics
- attachment confirmation heuristics
- selector health collection
- diagnostic snapshot creation
- workflow step definitions
- final diagnostic package creation

### `sidepanel/automationTester/automationTester.controller.js`

This controller currently owns both UI lifecycle and action logic:

- runtime status refresh
- gateway status refresh
- gateway connect/disconnect
- file picker trigger
- page-state detection
- diagnostics export download
- dry-run execution
- one-click execution
- root render and event binding

## Current Dependency Notes

### Background dependencies

`background-main.js` depends directly on:

- `NewSiteCore.MESSAGE_TYPES`
- `NewSiteCore.TELEMETRY_EVENTS`
- `NewSiteCore.Errors`
- `NewSiteCore.Telemetry`
- `NewSiteCore.TabManager`
- `NewSiteCore.DiagnosticStore`
- `NewSiteCore.Storage`
- `NewSiteCore.GatewayClient`
- `NewSiteCore.GatewayProtocol`
- `NewSiteAutomation.NEWSITE_CONFIG`
- `NewSiteAutomation.SiteProfile`
- `DeepSeekAutomation.DEEPSEEK_CONFIG`
- `DeepSeekAutomation.DeepSeekSiteProfile`

### DeepSeek content dependencies

`sites/deepseek/content.js` depends directly on:

- `NewSiteCore.MESSAGE_TYPES`
- `NewSiteCore.TELEMETRY_EVENTS`
- `NewSiteCore.Telemetry`
- `NewSiteCore.Errors`
- `NewSiteCore.DiagnosticStore`
- `DeepSeekAutomation.DeepSeekSiteProfile`
- `DeepSeekAutomation.DeepSeekSelectors`
- `DeepSeekAutomation.DeepSeekDomHelpers`
- `DeepSeekAutomation.DeepSeekPageState`
- `DeepSeekAutomation.ChatAutomator`

### DeepSeek automator dependencies

`sites/deepseek/chatAutomator.js` depends directly on:

- `DeepSeekAutomation.DEEPSEEK_CONFIG`
- `DeepSeekAutomation.DeepSeekSelectors`
- `DeepSeekAutomation.DeepSeekDomHelpers`
- `DeepSeekAutomation.DeepSeekPageState`
- `NewSiteCore.WorkflowRunner`
- `NewSiteCore.Errors`
- `NewSiteCore.Telemetry`
- `NewSiteCore.TELEMETRY_EVENTS`
- `NewSiteCore.DiagnosticStore`

## Current Chrome Runtime Message Types

Defined today in `core/constants.js`:

- `NEWSITE_PROFILE_GET`
- `NEWSITE_PROFILE_SAVE`
- `NEWSITE_PROFILE_RESET`
- `NEWSITE_SELECTOR_TEST`
- `NEWSITE_SELECTOR_TEST_ALL`
- `NEWSITE_PAGE_STATE_DETECT`
- `NEWSITE_RUN_AUTOMATION`
- `NEWSITE_RUNTIME_STATUS_GET`
- `NEWSITE_DIAGNOSTICS_GET`
- `NEWSITE_EXPORT_DIAGNOSTICS`
- `AUTODIPSIK_AUTOMATION_ONE_CLICK_RUN`
- `AUTODIPSIK_GATEWAY_STATUS_GET`
- `AUTODIPSIK_GATEWAY_CONNECT`
- `AUTODIPSIK_GATEWAY_DISCONNECT`
- `AUTODIPSIK_GATEWAY_SELECT_FILE`
- `AUTODIPSIK_GATEWAY_EXECUTE_UPLOAD`
- `AUTODIPSIK_GATEWAY_EXPORT_DIAGNOSTICS`
- `AUTODIPSIK_ATTACH_FILE_TO_DEEPSEEK`
- `AUTODIPSIK_DEEPSEEK_TAB_ENSURE`
- `AUTODIPSIK_DEEPSEEK_CONTENT_SCRIPT_PING`

## Current Background Message Routing

### Profile and runtime

- `PROFILE_GET` -> load profile from newsite or DeepSeek profile service
- `PROFILE_SAVE` -> validate and persist profile
- `PROFILE_RESET` -> restore default profile into storage
- `RUNTIME_STATUS_GET` -> update and return runtime status

### Diagnostics

- `DIAGNOSTICS_GET` -> export diagnostics and merge live page context
- `EXPORT_DIAGNOSTICS` -> export AI-ready diagnostics for selected site
- `GATEWAY_EXPORT_DIAGNOSTICS` -> export diagnostics with DeepSeek profile and gateway status

### Tab/content actions

- `SELECTOR_TEST` -> forward to active or DeepSeek-aware tab
- `SELECTOR_TEST_ALL` -> forward to active or DeepSeek-aware tab
- `PAGE_STATE_DETECT` -> forward to active or DeepSeek-aware tab
- `DEEPSEEK_TAB_ENSURE` -> prepare DeepSeek tab and ping content script
- `RUN_AUTOMATION` -> resolve file payload, send to DeepSeek content workflow

### Gateway

- `GATEWAY_STATUS_GET` -> gateway status snapshot
- `GATEWAY_CONNECT` -> open websocket connection
- `GATEWAY_DISCONNECT` -> close websocket connection
- `GATEWAY_SELECT_FILE` -> open Python file picker
- `GATEWAY_EXECUTE_UPLOAD` -> resolve selected file and attach it in DeepSeek

### One-click workflow

- `AUTOMATION_ONE_CLICK_RUN` -> execute full DeepSeek workflow orchestration in background

## Critical Workflow Mapping

### `AUTOMATION_ONE_CLICK_RUN`

Current owner: `background-main.js`

Stages and delegated modules:

1. `validate_input` -> `background-main.js`
2. `ensure_gateway_connected` -> `background-main.js`
3. `ensure_file_selected` -> `background-main.js`
4. `ensure_deepseek_tab` -> `background-main.js`
5. `detect_page_state` -> `sites/deepseek/content.js`
6. `run_preflight` -> `sites/deepseek/content.js` -> `sites/deepseek/chatAutomator.js`
7. `run_actual_automation` -> `sites/deepseek/content.js` -> `sites/deepseek/chatAutomator.js`

Main output shape today:

- `status`
- `traceId`
- `workflowId`
- `stage`
- `failedStage`
- `failedStep`
- `gatewayStatus`
- `selectedFile`
- `pageState`
- `automationResult`
- `diagnosticPackageReady`
- `error`

### `RUN_AUTOMATION`

Current owners:

- background request enrichment: `background-main.js`
- DeepSeek execution: `sites/deepseek/content.js`
- workflow engine: `sites/deepseek/chatAutomator.js`

Behavior:

- dry-run skips physical file attachment and send click
- real run requires `filePayload`
- background resolves file payload from gateway before forwarding

### `GATEWAY_SELECT_FILE`

Current owner: `background-main.js`

Behavior:

- ensures websocket client is connected
- calls Python gateway `FILE_PICKER_OPEN_REQUEST`
- records gateway snapshot in diagnostics
- returns gateway status plus selected file payload metadata

### `GATEWAY_EXECUTE_UPLOAD`

Current owner: `background-main.js`

Behavior:

- ensures gateway connection
- checks selected file metadata
- requests base64 file content from Python
- forwards `DEEPSEEK_ATTACH_FILE` to DeepSeek content script
- records telemetry around attach

### `EXPORT_DIAGNOSTICS`

Current owner: `background-main.js`

Behavior:

- exports redacted diagnostics package through `DiagnosticStore`
- includes gateway status when relevant
- emits export telemetry

### `PAGE_STATE_DETECT`

Current owners:

- background forwarding: `background-main.js`
- page-state detection: `sites/deepseek/content.js` or `sites/newsite/content.js`

Behavior:

- chooses target tab according to active URL and DeepSeek-aware routing
- records page state and content script health when DeepSeek handles the request

## Telemetry and Observability Touchpoints

### Background-heavy telemetry clusters

`background-main.js` emits events for:

- extension bootstrap
- extension message receive/forward/failure
- DeepSeek tab detection and tab ensure lifecycle
- gateway connect and file-selection related stages
- one-click stage lifecycle
- diagnostic export lifecycle
- DeepSeek preflight lifecycle
- file payload resolution

### DeepSeek workflow telemetry clusters

`sites/deepseek/chatAutomator.js` emits or causes events for:

- workflow started/completed/failed
- page ready
- chat input found
- file input found
- file attachment started/confirmed/skipped
- prompt insertion started/completed
- send button search/found/not found/heuristic used
- send click success/failure
- diagnostic package created

### DiagnosticStore usage hotspots

- `background-main.js`
  - `recordRuntimeSnapshot`
  - `recordGatewaySnapshot`
  - `recordContentScriptHealth`
  - `recordError`
- `sites/deepseek/content.js`
  - `recordRuntimeSnapshot`
  - `recordSelectorHealth`
  - `recordPageState`
  - `recordContentScriptHealth`
  - `setLastWorkflow`
  - `recordError`
- `sites/deepseek/chatAutomator.js`
  - `recordRuntimeSnapshot`
  - `recordSendButtonEvidence`

## Refactor Pressure Points

The highest-friction files before refactor are:

- `background-main.js`
- `sites/deepseek/content.js`
- `sites/deepseek/chatAutomator.js`
- `sidepanel/automationTester/automationTester.controller.js`

These files should be reduced by extracting:

- composition and routing
- service-level helpers
- domain-specific handlers
- step-level workflow modules
- thin UI controllers
