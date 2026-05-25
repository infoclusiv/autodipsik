# Modularization Refactor Baseline

Date: 2026-05-24

## Goal

This note captures the verified baseline for the modularization refactor sequence before any runtime extraction work begins.

Phase covered: `autodipsik_modularization_plan/phase-1.md`

## Repository state

- Branch status at capture time: clean (`git -c core.excludesfile= status --short`)
- Runtime code changes in this phase: none

## Verified entrypoints and loader files

### MV3 service worker

- `manifest.json` registers `background-main.js` as the service worker.
- `background-main.js` is the current composition root and bootstrap trigger.

Current `importScripts(...)` order in `background-main.js`:

1. Core config/constants/storage/telemetry/contracts
2. Core conditional workflow helpers and engine
3. Core gateway protocol/client and shared utilities
4. Core diagnostic modules
5. `sites/newsite/*` site modules
6. `sites/deepseek/*` site modules
7. `background/services/*`
8. `background/workflows/deepseekPromptTurnRunner.js`
9. `background/workflows/deepseekConditionalWorkflow.js`
10. `background/workflows/deepseekBatchConditionalWorkflow.js`
11. `background/messageHandlers/*`
12. `background/messageRouter.js`
13. `background/bootstrap.js`

Bootstrap call after load:

```text
NewSiteBackground.BackgroundBootstrap.start()
```

### Content scripts from `manifest.json`

- `https://example.com/*`
  - Loads the `sites/newsite/*` chain ending in `sites/newsite/content.js`
- `https://chat.deepseek.com/*`
  - Loads the `sites/deepseek/*` chain ending in `sites/deepseek/content.js`

### Side panel

- `manifest.json` registers `sidepanel/sidepanel.html`
- `sidepanel/sidepanel.html` still uses ordered `<script>` tags

Current side panel script order:

1. Core config/constants/storage
2. `core/workflow/conditionalWorkflowDraftStorage.js`
3. Core telemetry/observability/contracts/diagnostics helpers
4. `sites/newsite/*` site modules
5. `sites/deepseek/*` site profile modules
6. `sidepanel/shared/*`
7. `sidepanel/profileEditor/*`
8. `sidepanel/automationTester/*`
9. `sidepanel/diagnostics/*`
10. `sidepanel/bootstrap.js`

### Workflow Lab

- `workflowLab/workflowLab.html` still uses ordered `<script>` tags

Current Workflow Lab script order:

1. Core config/constants/storage
2. `core/workflow/conditionalWorkflowDraftStorage.js`
3. `sites/deepseek/config.js`
4. `workflowLab.store.js`
5. `workflowLab.render.js`
6. `workflowLab.controller.js`
7. `workflowLab/bootstrap.js`

## High-risk modules confirmed before refactor

- `background-main.js`
- `manifest.json`
- `sidepanel/sidepanel.html`
- `workflowLab/workflowLab.html`
- `background/services/gatewayFileService.js`
- `background/workflows/deepseekPromptTurnRunner.js`
- `background/workflows/deepseekConditionalWorkflow.js`
- `background/workflows/deepseekBatchConditionalWorkflow.js`
- `sites/deepseek/chatAutomator.js`
- `sidepanel/automationTester/automationTester.controller.js`
- `sidepanel/automationTester/automationTester.render.js`
- `app-python/autodipsik_gateway/websocket/handlers.py`

## Verification completed

### Repository/document inspection

Reviewed:

- `manifest.json`
- `background-main.js`
- `sidepanel/sidepanel.html`
- `workflowLab/workflowLab.html`
- `docs/architecture/current-modularization-map.md`
- `docs/testing/manual-regression-checklist.md`
- `app-python/autodipsik_gateway/tests/test_handlers.py`

### Python tests

Attempted:

```powershell
cd app-python
python -m pytest autodipsik_gateway/tests
```

Result:

- Could not run because `pytest` is not installed in the current environment (`No module named pytest`).
- No dependency installation was performed in this phase.

### Python gateway startup

Ran:

```powershell
python -u app-python/run_gateway.py
```

Observed before timeout:

```text
Autodipsik Python Gateway running on ws://127.0.0.1:8765
```

Result:

- Gateway startup baseline is healthy.

### Manual extension checks

Not performed in this phase from the local CLI environment:

- unpacked extension load in `chrome://extensions`
- service worker runtime inspection in Chrome
- sidepanel rendering checks
- DeepSeek content-script ping and page-state checks

These remain pending manual verification using `docs/testing/manual-regression-checklist.md`.

## Noted inconsistencies

- `docs/architecture/current-modularization-map.md` is partially stale relative to the current service-worker loader order.
- Specifically, it still describes `background/workflows/deepseekOneClickWorkflow.js`, while the active loader currently includes:
  - `background/workflows/deepseekPromptTurnRunner.js`
  - `background/workflows/deepseekConditionalWorkflow.js`
  - `background/workflows/deepseekBatchConditionalWorkflow.js`

## Phase-1 conclusion

- No runtime code was changed.
- Current loader order is now recorded for later extraction phases.
- Python gateway startup was verified.
- Python tests are currently blocked by a missing local `pytest` installation.
- Manual browser regression checks are still required before relying on this baseline as fully validated behavior.
