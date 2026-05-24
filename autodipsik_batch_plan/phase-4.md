# Phase 4 — Add explicit DeepSeek tab targeting and fresh same-window tab creation

## Single objective

Create a safe tab-management foundation so a workflow can target a specific DeepSeek tab, and so later batch items can open a new DeepSeek tab in the same browser window.

This phase must not implement batch execution yet.

## Expected behavior

- Existing single workflow behavior remains unchanged by default.
- A caller can request a fresh DeepSeek tab instead of reusing the first existing DeepSeek tab.
- A caller can forward a message to a specific DeepSeek `tabId`.
- New tab creation happens in the same browser window as the current or base DeepSeek tab when possible.
- Existing fallback content-script injection behavior remains available for the target tab.

## Success criteria

- `core/tabManager.js` exposes a safe method to create a new tab in a chosen window, for example `openTabInWindow(url, windowId)`.
- `background/services/deepseekTabService.js` exposes:
  - existing `ensureReady(traceId)` unchanged
  - a fresh-tab method such as `openFreshReady(traceId, options)`
  - a target-tab forward method such as `forwardToTab(tabId, message)`
- `DeepSeekTabService.forward(message)` remains backward-compatible and still uses `ensureReady()`.
- No current single workflow code is forced to pass a `tabId` yet.
- Manual testing proves a fresh DeepSeek tab can be opened in the same window and pinged by the content script.

## How to verify

1. Reload the extension.
2. Open or focus a browser window with the sidepanel.
3. From the service worker console, call the new fresh-tab method indirectly if exposed through a temporary debug call, or temporarily trigger it from a development-only console snippet.
4. Confirm:
   - a new `https://chat.deepseek.com/` tab opens
   - it opens as a tab in the same Chrome window, not a separate window
   - the content script ping succeeds
5. Run a normal single-file conditional workflow and confirm it still works.

## Observable failure signals

- A new Chrome window opens instead of a new tab.
- `DeepSeekTabService.forward()` starts targeting the wrong tab for existing single workflows.
- Content script ping fails on the fresh tab but succeeds on old tabs.
- Fallback content-script injection no longer runs because the new path bypasses `sendMessageWithContentScriptCheck`.
- `chrome.tabs.create` fails because `windowId` is invalid and there is no fallback path.

## Files/components involved

Primary files:

- `core/tabManager.js`
- `background/services/deepseekTabService.js`

Supporting files:

- `core/constants/telemetryEvents.js`
- `core/diagnosticStore.js`
- `background/workflows/deepseekConditionalWorkflow.js` only if a no-op compatibility check is needed, but avoid changing workflow execution in this phase.

## Implementation guidance

### TabManager

Add a small helper that does not replace `ensureTab()`:

```js
async function openTabInWindow(url, windowId) {
  const createOptions = { url: url, active: true };
  if (typeof windowId === "number") {
    createOptions.windowId = windowId;
  }
  return chrome.tabs.create(createOptions);
}
```

Expose it on `NewSiteCore.TabManager`.

### DeepSeekTabService

Add fresh tab readiness:

```js
async function openFreshReady(traceId, options) {
  const opts = options || {};
  const baseWindowId = typeof opts.windowId === "number" ? opts.windowId : null;
  const tab = await TabManager.openTabInWindow(deepSeekConfig.baseUrl, baseWindowId);
  const readyTab = await TabManager.waitForTabComplete(tab.id, 20000);
  // record snapshot, ping content script using existing check path
  return readyTab;
}
```

Add specific forwarding:

```js
async function forwardToTab(tabId, message) {
  return TabManager.sendMessageWithContentScriptCheck(tabId, message, { targetSiteId: "deepseek" });
}
```

Keep `forward(message)` as:

```js
const activeTab = await ensureReady(message.traceId);
return forwardToTab(activeTab.id, message);
```

The goal is compatibility first, not batch yet.

## Preconditions before implementation

- `TabManager.ensureTab()` still reuses existing DeepSeek tabs.
- `DeepSeekTabService.forward()` still calls `ensureReady()` internally.
- `sendMessageWithContentScriptCheck()` still contains the DeepSeek content-script fallback injection path.

## Stop conditions if the plan does not match the real codebase

Stop before coding if:

- Tab handling no longer goes through `core/tabManager.js`.
- `DeepSeekTabService` has already been redesigned to support explicit sessions/tabs.
- Chrome MV3 permissions no longer include `tabs` or `scripting` in `manifest.json`.
