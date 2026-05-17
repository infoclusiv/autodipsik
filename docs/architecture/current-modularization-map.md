# Current Modularization Map

Date: 2026-05-17

## Scope

This document captures the current runtime structure after the background modularization and DeepSeek + Python gateway integration. It is the current architecture reference for active runtime wiring, including the retained `newsite` template/lab path.

## Runtime Entrypoints

### Extension service worker

`manifest.json` registers `background-main.js` as the MV3 service worker.

`background-main.js` is the composition root and script loader. It loads:

1. core constants, contracts, storage, telemetry, diagnostics, gateway protocol, and gateway client modules
2. site configuration modules for `sites/newsite/*` and `sites/deepseek/*`
3. background services under `background/services/*`
4. the one-click workflow under `background/workflows/deepseekOneClickWorkflow.js`
5. message handlers under `background/messageHandlers/*`
6. `background/messageRouter.js`
7. `background/bootstrap.js`

After loading, `background-main.js` only starts the background through:

```text
NewSiteBackground.BackgroundBootstrap.start()
```

### Sidepanel

`manifest.json` sets `side_panel.default_path` to `sidepanel/sidepanel.html`.

`sidepanel/sidepanel.html` loads:

1. shared core contracts and utilities
2. newsite and DeepSeek site profile modules
3. sidepanel shared UI helpers
4. `profileEditor/*`
5. `automationTester/*`
6. `diagnostics/*`
7. `sidepanel/bootstrap.js`

`sidepanel/bootstrap.js` mounts:

- `NewSiteSidepanel.ProfileEditorController`
- `NewSiteSidepanel.AutomationTesterController`
- `NewSiteSidepanel.DiagnosticsController`

### Content scripts

`manifest.json` still registers two active content-script chains:

- `https://example.com/*` -> `sites/newsite/*` template/lab flow
- `https://chat.deepseek.com/*` -> `sites/deepseek/*`

For DeepSeek, the active end of the chain is:

```text
sites/deepseek/chatAutomator.js
  -> sites/deepseek/content.js
```

### Python gateway

The Python gateway entrypoint chain is:

```text
app-python/run_gateway.py
  -> autodipsik_gateway/main.py
  -> autodipsik_gateway/websocket/server.py
  -> autodipsik_gateway/websocket/handlers.py
```

## Background Delegation Map

### `background-main.js`

Current role:

- service-worker composition root
- script loader
- bootstrap trigger

It does not own the background business logic directly.

### `background/bootstrap.js`

Current role:

- hydrates telemetry on startup
- configures sidepanel behavior
- updates runtime status snapshots
- registers Chrome lifecycle listeners
- registers the `chrome.runtime.onMessage` listener that delegates into `MessageRouter`

### `background/messageRouter.js`

Current role:

- validates incoming runtime messages
- attaches a trace ID
- emits background message-received and message-failed telemetry
- routes message types to specific handler modules
- normalizes unsupported-message failures

### `background/messageHandlers/*`

Current role:

- `profileHandlers.js`: profile get/save/reset behavior
- `diagnosticsHandlers.js`: diagnostics export and gateway-aware diagnostics export
- `gatewayHandlers.js`: gateway status, connect, disconnect, file selection, upload execution
- `tabHandlers.js`: active-tab and DeepSeek-aware selector/page-state forwarding, DeepSeek tab ensure
- `automationHandlers.js`: automation request handling and one-click entry delegation

### `background/services/*`

Current role:

- `siteProfileResolver.js`: resolves newsite versus DeepSeek site profile services
- `runtimeStatusService.js`: computes and stores runtime status snapshots
- `activeTabForwarder.js`: forwards tab-scoped actions to the correct content script
- `deepseekTabService.js`: ensures, locates, and pings the DeepSeek tab/content script path
- `gatewayFileService.js`: resolves gateway file metadata and file payloads for automation

### `background/workflows/deepseekOneClickWorkflow.js`

Current role:

- owns one-click orchestration for the DeepSeek upload workflow
- coordinates gateway readiness, file selection, DeepSeek tab readiness, preflight, and actual automation stages through delegated services and handlers

## Canonical Runtime Flow

```text
sidepanel/automationTester.controller.js
  -> sidepanel/automationRunOrchestrator.js
  -> chrome.runtime.sendMessage(...)
  -> background/messageRouter.js
  -> background/messageHandlers/*
  -> background/services/gatewayFileService.js
  -> core/gatewayClient.js
  -> Python WebSocket gateway
  -> background/services/deepseekTabService.js
  -> sites/deepseek/content.js
  -> sites/deepseek/chatAutomator.js
```

Direct sidepanel actions also use the same background route for:

- gateway connect and disconnect
- file selection
- diagnostics export
- page-state detection
- dry-run automation

## Active UI Ownership

### `sidepanel/automationTester/automationTester.controller.js`

This is the active DeepSeek workflow control surface. It currently owns:

- runtime status refresh
- gateway status refresh
- gateway connect and disconnect
- Excel file selection through the Python gateway
- page-state detection
- diagnostics export
- dry-run execution
- one-click execution
- render lifecycle and event binding

`sidepanel/deepseekUpload/*` is no longer part of the active sidepanel path.

## DeepSeek Runtime Ownership

### `sites/deepseek/content.js`

This file currently owns:

- content-script singleton guard
- runtime message listener for DeepSeek-scoped actions
- selector tests
- page-state detection
- DeepSeek automation entrypoint
- content-script ping
- browser-side file attachment from gateway payloads

### `sites/deepseek/chatAutomator.js`

This file currently owns:

- workflow step execution
- file attachment flow inside DeepSeek
- chat input and send button heuristics
- selector health and diagnostics collection
- automation result and diagnostic package creation

## Python Gateway Runtime

### `app-python/autodipsik_gateway/websocket/server.py`

This module currently:

- creates `FileStore`, `JsonlLogger`, and `GatewayHandlers`
- accepts websocket connections
- parses incoming messages
- delegates protocol handling to `GatewayHandlers`
- sends JSON responses back to the extension
- logs gateway lifecycle and per-message events

## Historical Notes

- `docs/repo-discovery-deepseek-websocket-upload.md` is a historical discovery document from before the Python gateway and DeepSeek runtime were added. It should not be treated as the latest architecture source.
- Earlier descriptions that treated `background-main.js` as the owner of all background orchestration are no longer accurate. The active runtime is handler- and service-driven behind `background/bootstrap.js` and `background/messageRouter.js`.

## Cleanup-Relevant Notes

- `sites/newsite/*` is intentionally retained as the template/lab module.
- The `https://example.com/*` manifest registration is intentionally retained for that template/lab flow.
- The production DeepSeek flow lives in `sites/deepseek/*` and the Python gateway path under `app-python/`.
- `runtime/python-events.jsonl` is a generated runtime artifact path and remains covered by `.gitignore`.
- The removed `sidepanel/deepseekUpload/*` module was not part of the active sidepanel wiring.
