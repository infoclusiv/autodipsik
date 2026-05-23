# Phase 1 — Add a shared persistent storage contract for conditional workflow drafts

## Single objective

Create the minimal shared storage foundation needed to persist conditional workflow JSON text with `chrome.storage.local`, without changing current UI behavior yet.

## Why this phase exists

The current conditional workflow JSON is stored only in in-memory state:

- `sidepanel/automationTester/automationTester.store.js` has `conditionalWorkflowText: ""`.
- `workflowLab/workflowLab.store.js` has `conditionalWorkflowText: ""`.

That state disappears when the side panel reloads, the Workflow Lab popup is closed, the extension is reloaded, or Chrome restarts.

The repo already has a reusable namespaced storage wrapper in `core/storage.js`, so this phase should reuse that architecture instead of inventing a separate storage mechanism.

## Expected behavior

After this phase:

- A new storage key exists for conditional workflow draft text.
- A small shared module exposes functions to load, save, and clear the draft.
- The shared module uses `NewSiteCore.Storage` and therefore writes to a namespaced `chrome.storage.local` key.
- Loading the side panel and Workflow Lab still works exactly as before.
- No UI should persist or restore text yet; that happens in later phases.

## Success criteria

- `NewSiteCore.CoreStorageKeys` includes a new key for the conditional workflow JSON draft.
- A shared module exists, for example `core/workflow/conditionalWorkflowDraftStorage.js`, exposing a global API such as:
  - `NewSiteCore.ConditionalWorkflowDraftStorage.loadDraft()`
  - `NewSiteCore.ConditionalWorkflowDraftStorage.saveDraft(text)`
  - `NewSiteCore.ConditionalWorkflowDraftStorage.clearDraft()`
- The saved value preserves the exact textarea text as a string.
- Empty string is a valid stored value and should not throw.
- If `chrome.storage.local` is unavailable, the module fails safely and returns fallback values instead of throwing during UI boot.
- `sidepanel/sidepanel.html` loads the new module after `../core/storage.js`.
- `workflowLab/workflowLab.html` loads `../core/storage.js` before the new draft storage module.
- Existing side panel and Workflow Lab rendering do not regress.
- `scripts/verify-cleanup.ps1` still passes.

## How to verify

1. Run the cleanup verifier:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/verify-cleanup.ps1
   ```

2. Load/reload the unpacked extension in Chrome.

3. Open the side panel and confirm there are no console errors such as:
   - `NewSiteCore.Storage is undefined`
   - `NewSiteCore.ConditionalWorkflowDraftStorage is undefined`
   - script loading 404 errors

4. Open Workflow Lab and confirm there are no console errors.

5. From the side panel DevTools console, manually test the storage module:

   ```js
   await NewSiteCore.ConditionalWorkflowDraftStorage.saveDraft('{"flowVersion":1}')
   await NewSiteCore.ConditionalWorkflowDraftStorage.loadDraft()
   ```

   Expected result: the loaded value equals the saved string.

6. Confirm the actual storage key is namespaced by the existing storage wrapper. With the current config, the underlying key should be equivalent to:

   ```js
   NewSiteCore.Storage.namespaceKey(NewSiteCore.CoreStorageKeys.CONDITIONAL_WORKFLOW_DRAFT)
   ```

## Observable failure signals

- Side panel fails to boot after adding the script.
- Workflow Lab fails to boot because `core/storage.js` was not loaded before the new module.
- DevTools console shows missing global objects or script path errors.
- `scripts/verify-cleanup.ps1` reports missing referenced files.
- Manual `saveDraft` / `loadDraft` returns different text than saved.
- Stored JSON text is auto-parsed or reformatted unexpectedly in this phase.

## Files/components involved

- `core/constants/storageKeys.js`
- `core/storage.js` only for reuse; avoid modifying it unless absolutely necessary.
- New file, recommended path: `core/workflow/conditionalWorkflowDraftStorage.js`
- `sidepanel/sidepanel.html`
- `workflowLab/workflowLab.html`
- `scripts/verify-cleanup.ps1` only for verification, not expected to change.

## Preconditions before implementation

- Confirm `NewSiteCore.EXTENSION_CONFIG.storageNamespace` still exists in `core/config.js`.
- Confirm `core/storage.js` still exposes `NewSiteCore.Storage.getValue`, `setValue`, and `removeValue`.
- Confirm both `sidepanel/sidepanel.html` and `workflowLab/workflowLab.html` still load `../core/config.js` before storage-dependent modules.
- Confirm the extension still has the `storage` permission in `manifest.json`.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- `core/storage.js` no longer exists or no longer wraps `chrome.storage.local`.
- `workflowLab/workflowLab.html` has been removed or replaced by a different workflow editor architecture.
- The conditional workflow JSON is already persisted by another module.
- The extension has moved away from global script modules and the proposed global API would conflict with the real module system.

## Suggested implementation notes

Keep the new module intentionally small. A safe shape is:

- Read the key from `NewSiteCore.CoreStorageKeys.CONDITIONAL_WORKFLOW_DRAFT`.
- Use `NewSiteCore.Storage.getValue(key, "")`.
- Use `NewSiteCore.Storage.setValue(key, String(text || ""))`.
- Use `NewSiteCore.Storage.removeValue(key)` for clearing.
- Return booleans or string values, not parsed JSON objects.

Do not validate JSON in this module. JSON validation already belongs to the conditional workflow controller and `core/contracts/conditionalWorkflowContracts.js`.
