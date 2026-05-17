# Repository Discovery: DeepSeek WebSocket Upload

> Historical document: this discovery note reflects the repository state on 2026-05-13 before the Python gateway and current DeepSeek runtime were fully added. Use `docs/architecture/current-modularization-map.md` as the current architecture source.

## Date

2026-05-13

## Existing Structure

The repository is a Chrome Manifest V3 extension scaffold oriented around a placeholder site module named `newsite`.

Top-level structure:

- `manifest.json`
- `background-main.js`
- `core/`
- `sidepanel/`
- `sites/newsite/`

There is no existing Python application in this repository.

## Existing Sidepanel Implementation

The sidepanel is already modular and split into tabs:

- `sidepanel/sidepanel.html`
- `sidepanel/bootstrap.js`
- `sidepanel/profileEditor/*`
- `sidepanel/automationTester/*`
- `sidepanel/diagnostics/*`
- `sidepanel/shared/*`

Current tabs:

- `Site Profile`
- `Automation Tester`
- `Diagnostics`

This is reusable for the DeepSeek workflow. The cleanest approach is to add a new workflow panel and shared gateway client utilities instead of replacing the existing sidepanel structure.

## Existing Content Script Implementation

The current content script pipeline is site-scoped and loads for `https://example.com/*` only.

Relevant files:

- `sites/newsite/content.js`
- `sites/newsite/automator.js`
- `sites/newsite/selectors.js`
- `sites/newsite/domHelpers.js`
- `sites/newsite/pageState.js`
- `sites/newsite/siteProfile.js`
- `sites/newsite/contracts.js`
- `sites/newsite/config.js`

The current content script already:

- receives runtime messages from the background
- emits telemetry
- records diagnostics
- runs selector tests
- detects page state
- executes a site workflow

This pattern should be reused for a dedicated `sites/deepseek/` module.

## Existing Background Architecture

`background-main.js` is already the coordinator between:

- sidepanel
- active tab content script
- storage
- diagnostics

It currently:

- initializes telemetry
- manages sidepanel behavior
- forwards site actions to the active tab
- exports diagnostics
- stores runtime status
- normalizes background errors

This is the right place to own the Python gateway connection long-term. For MVP, a sidepanel-owned WebSocket client is possible, but the background already fits the coordinator role better and aligns with the implementation plan.

## Existing Site Profile Editor

The site profile system is already implemented and persisted through storage.

Relevant files:

- `sidepanel/profileEditor/*`
- `sites/newsite/siteProfile.js`
- `sites/newsite/contracts.js`

The profile model is selector-driven and includes timing settings. For DeepSeek, this can be reused with a smaller specialized default profile and different selector keys.

## Existing Logging and Observability

There is already a reusable observability layer:

- `core/telemetry.js`
- `core/diagnosticStore.js`
- `core/errors.js`
- `core/storage.js`

Current capabilities:

- buffered telemetry in extension storage
- structured error normalization
- diagnostic export
- selector health history
- page-state history
- last workflow snapshot

This should be extended, not replaced. The new DeepSeek workflow and the Python gateway should emit compatible structured events.

## Existing Contracts and Message Types

Shared constants already exist in:

- `core/constants.js`
- `core/messaging.js`

The existing message model is extension-internal and site-specific. It does not yet include:

- gateway connection messages
- WebSocket protocol envelopes
- file selection messages
- file content transfer messages
- DeepSeek attach-file actions

These should be added in a shared protocol layer without breaking current `newsite` message types.

## Manifest Status

Current manifest characteristics:

- Manifest V3
- service worker background
- side panel enabled
- `activeTab`, `tabs`, `scripting`, `downloads`, `storage`, `alarms`, `notifications`
- host permissions only for `https://example.com/*`, `http://localhost/*`, and `http://127.0.0.1/*`
- content scripts only registered for `https://example.com/*`

Required changes:

- add `https://chat.deepseek.com/*` to `host_permissions`
- register a DeepSeek content script module
- keep the current MV3 service worker structure intact

## Python App Status

No Python code, dependencies, tests, or app folders currently exist in the repository.

The Python gateway will need to be added from scratch. A separate `app-python/` folder is appropriate and does not conflict with the existing extension layout.

## Reuse vs New Module Decisions

Reuse:

- `core/telemetry.js`
- `core/diagnosticStore.js`
- `core/errors.js`
- `core/storage.js`
- `core/messaging.js`
- `background-main.js` coordination pattern
- sidepanel tab/bootstrap/shared architecture

Create new:

- `app-python/` gateway package
- shared extension WebSocket protocol/client modules
- `sites/deepseek/` module
- sidepanel workflow UI for gateway connection and file execution
- DeepSeek-specific diagnostics export additions

## Implementation Direction

The least disruptive path is:

1. Keep the existing extension architecture.
2. Add a new DeepSeek site module beside `sites/newsite/`.
3. Extend shared constants and diagnostics instead of renaming the current scaffold.
4. Add a new Python gateway under `app-python/`.
5. Start with a sidepanel-owned WebSocket client for MVP if needed, but structure the code so the background can own the connection later.

## Risks Noted During Discovery

- The current codebase is strongly branded as `newsite`, so some shared event naming and storage naming are still generic only in behavior, not in naming.
- The manifest and sidepanel currently assume one site module, so introducing DeepSeek will require careful registration changes.
- DeepSeek selectors are not yet verified against the live DOM from this environment, so the initial profile will need defensive selectors and diagnostics.
