# Autodipsik Cleanup Audit

Date: 2026-05-17

## Scope

This document is a verified cleanup inventory for Phase 1. It records active runtime entrypoints, suspected cleanup candidates, generated artifacts, and stale documentation without deleting or moving anything.

## Runtime Entrypoints

### Chrome extension

Verified current chain:

```text
manifest.json
  -> background-main.js
  -> background/bootstrap.js
  -> background/messageRouter.js
```

Verification notes:

- `manifest.json` registers `background-main.js` as the MV3 service worker.
- `background-main.js` loads both `background/messageRouter.js` and `background/bootstrap.js` through `importScripts(...)`.
- `background-main.js` starts the runtime through `NewSiteBackground.BackgroundBootstrap.start()`.

### Sidepanel

Verified current chain:

```text
manifest.json
  -> sidepanel/sidepanel.html
  -> sidepanel/bootstrap.js
  -> ProfileEditorController
  -> AutomationTesterController
  -> DiagnosticsController
```

Verification notes:

- `manifest.json` sets `side_panel.default_path` to `sidepanel/sidepanel.html`.
- `sidepanel/sidepanel.html` loads `bootstrap.js`.
- `sidepanel/bootstrap.js` mounts:
  - `NewSiteSidepanel.ProfileEditorController`
  - `NewSiteSidepanel.AutomationTesterController`
  - `NewSiteSidepanel.DiagnosticsController`

### DeepSeek content script

Verified current chain:

```text
manifest.json
  -> sites/deepseek/content.js
  -> sites/deepseek/chatAutomator.js
```

Verification notes:

- `manifest.json` registers a content-script bundle for `https://chat.deepseek.com/*`.
- That bundle includes `sites/deepseek/chatAutomator.js` before `sites/deepseek/content.js`.

### Newsite content script

Verified current chain:

```text
manifest.json
  -> sites/newsite/content.js
  -> sites/newsite/automator.js
```

Verification notes:

- `manifest.json` still registers a content-script bundle for `https://example.com/*`.
- `sites/newsite/*` is also still loaded by `background-main.js` and `sidepanel/sidepanel.html`.
- This means `sites/newsite/*` is still active runtime code today and must not be assumed unused.

### Python gateway

Verified current chain:

```text
app-python/run_gateway.py
  -> autodipsik_gateway/main.py
  -> autodipsik_gateway/websocket/server.py
  -> autodipsik_gateway/websocket/handlers.py
```

Verification notes:

- `app-python/run_gateway.py` imports `main` from `autodipsik_gateway.main`.
- `app-python/autodipsik_gateway/main.py` calls `run_server(settings)`.
- `app-python/autodipsik_gateway/websocket/server.py` imports and instantiates `GatewayHandlers`.

## Suspected Cleanup Candidates

| Candidate | Classification | Current evidence | Notes |
| --- | --- | --- | --- |
| `sidepanel/deepseekUpload/*` | `DELETE_CANDIDATE` | Phase 3 grep verification found no active references outside the module itself, and the files were removed from the working tree. | Removed as an orphaned duplicate sidepanel module. |
| `runtime/python-events.jsonl` | `DELETE_CANDIDATE` | Phase 2 confirmed `.gitignore` coverage and removed the file from the working tree. | Generated runtime artifact path. The Git index still needs `git rm --cached runtime/python-events.jsonl` outside this sandbox to fully stop tracking it. |
| `docs/repo-discovery-deepseek-websocket-upload.md` | `ARCHIVE_DOC` | The document states there is no Python app and no DeepSeek content registration, which is no longer true in the current repository. | Historical discovery document with stale architecture statements. |
| `docs/architecture/current-modularization-map.md` | `KEEP_ACTIVE` | Refreshed in Phase 4 to describe the actual current runtime delegation and canonical DeepSeek + Python gateway path. | This is now the current-state architecture reference. |
| `sites/newsite/*` | `KEEP_TEMPLATE` | `manifest.json`, `background-main.js`, `sidepanel/sidepanel.html`, and multiple background services still reference the newsite module. | Intentionally retained as the placeholder template/lab module. The production DeepSeek flow lives in `sites/deepseek/*`. |
| `https://example.com/*` manifest registration | `KEEP_TEMPLATE` | Still present in both `host_permissions` and `content_scripts.matches` in `manifest.json`. | Intentionally retained to support the placeholder template/lab flow wired to `sites/newsite/*`. |

## Cleanup Decisions Applied

### Phase 2

- `runtime/python-events.jsonl` was deleted from the working tree.
- `.gitignore` still contains `runtime/*.jsonl`.
- Because this environment cannot write inside `.git`, the repository still needs a real `git rm --cached runtime/python-events.jsonl` outside the sandbox to remove the path from the Git index.

### Phase 3

- `sidepanel/deepseekUpload/deepseekUpload.controller.js` was removed.
- `sidepanel/deepseekUpload/deepseekUpload.render.js` was removed.
- `sidepanel/deepseekUpload/deepseekUpload.store.js` was removed.
- Pre-deletion grep checks confirmed there were no active runtime references outside that module.

### Phase 5

- `sites/newsite/*` is intentionally retained as the template/lab module.
- `https://example.com/*` remains in `manifest.json` to support that template/lab flow.
- The production DeepSeek runtime remains `sites/deepseek/*` plus the Python gateway path.

## Do Not Delete Before Checking

Required `git grep` checks:

```bash
git grep -n "deepseekUpload" -- .
git grep -n "sites/newsite" -- manifest.json background-main.js background sidepanel core sites docs
git grep -n "https://example.com/\*" -- manifest.json sites docs background sidepanel core
git grep -n "run_gateway\|autodipsik_gateway\.main\|websocket/server\.py\|GatewayHandlers" -- app-python
```

Additional validation checks:

```bash
git ls-files -- "sidepanel/deepseekUpload/*"
git ls-files -- "runtime/python-events.jsonl"
```

## Verification Commands

Phase verification commands:

```bash
git status --short
git diff --stat
```

Expected Phase 1 intent:

- only `docs/cleanup/autodipsik-cleanup-audit.md` is added or modified by this phase
- no runtime code files change
- no files are deleted

## Risk Notes

- `docs/repo-discovery-deepseek-websocket-upload.md` is demonstrably historical, not current-state truth.
- `docs/architecture/current-modularization-map.md` was refreshed in Phase 4 and is now the preferred architecture reference.
- `sites/newsite/*` and `https://example.com/*` are intentionally retained as template/lab runtime paths, not as orphaned code.
- `runtime/python-events.jsonl` is still a tracking cleanup item until the Git index is updated outside this sandbox.
