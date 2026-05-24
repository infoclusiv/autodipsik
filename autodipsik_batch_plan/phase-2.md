# Phase 2 — Wire extension gateway protocol and background services for multi-file selection

## Single objective

Teach the extension-side gateway layer to request multiple files and activate a selected file by `fileId`, without changing the Run conditional workflow behavior yet.

## Expected behavior

- Existing `GATEWAY_SELECT_FILE` still selects one Excel file.
- New extension message types can:
  - select multiple Excel files through the Python gateway
  - activate one of the already selected files by `fileId`
- `GatewayClient` status can persist and return `selectedFiles` while preserving `selectedFile`.
- `GatewayFileService` exposes small, explicit methods for multi-file selection and active-file switching.
- No batch conditional workflow execution exists yet.

## Success criteria

- `core/gatewayProtocol.js` includes gateway protocol message constants matching Phase 1.
- `core/constants/messageTypes.js` includes extension runtime message types for multi-select and active-file switch.
- `core/constants/storageKeys.js` persists selected batch metadata safely.
- `core/gatewayClient.js` handles a `FILES_SELECTED` gateway envelope and persists:
  - `selectedFiles`
  - `selectedFile`
- `background/services/gatewayFileService.js` exposes:
  - `selectFiles(traceId)`
  - `selectFileById(traceId, fileId)` or equivalent
- `background/messageHandlers/gatewayHandlers.js` exposes handlers for those new service methods.
- `background/messageRouter.js` routes the new extension message types.
- Single-file selection and single-file conditional workflow still work.

## How to verify

1. Load the unpacked extension.
2. Start the Python gateway.
3. Use the existing **Select Excel File** button and confirm single-file status still updates.
4. Temporarily call the new runtime message from the service worker console or add a temporary manual test in the sidepanel console:

   ```js
   chrome.runtime.sendMessage({ type: "AUTODIPSIK_GATEWAY_SELECT_FILES" })
   ```

   Replace the string with the exact constant added in `messageTypes.js`.

5. Select multiple Excel files and confirm the response includes `files`, `selectedFile`, and `gatewayStatus.selectedFiles`.
6. Activate a later file by `fileId` through the new message and confirm `gatewayStatus.selectedFile.fileId` changes.

## Observable failure signals

- `GatewayClient.getStatus()` loses the existing `selectedFile` field.
- `FILES_SELECTED` gateway responses are received but never update status.
- The extension can select multiple files but cannot activate any file by `fileId`.
- Existing single-file **Run conditional workflow** fails because `selectedFile` is now missing or malformed.
- Storage contains stale selected file state after disconnect/reconnect in a way that breaks current behavior.

## Files/components involved

Primary files:

- `core/gatewayProtocol.js`
- `core/constants/messageTypes.js`
- `core/constants/storageKeys.js`
- `core/gatewayClient.js`
- `background/services/gatewayFileService.js`
- `background/messageHandlers/gatewayHandlers.js`
- `background/messageRouter.js`

Supporting files:

- `core/constants/telemetryEvents.js`
- `core/contracts/gatewayContracts.js`
- `core/storage.js`

## Implementation guidance

### Message names

Use explicit names. Example extension message types:

```js
GATEWAY_SELECT_FILES: "AUTODIPSIK_GATEWAY_SELECT_FILES",
GATEWAY_SELECT_FILE_BY_ID: "AUTODIPSIK_GATEWAY_SELECT_FILE_BY_ID"
```

Example gateway protocol message types:

```js
FILE_PICKER_OPEN_MULTIPLE_REQUEST: "FILE_PICKER_OPEN_MULTIPLE_REQUEST",
FILES_SELECTED: "FILES_SELECTED",
FILE_SELECT_BY_ID_REQUEST: "FILE_SELECT_BY_ID_REQUEST"
```

### GatewayClient status shape

Extend, do not replace:

```js
let currentStatus = {
  connected: false,
  state: "disconnected",
  lastError: null,
  selectedFile: null,
  selectedFiles: [],
  serverCapabilities: [],
  updatedAt: new Date().toISOString()
};
```

On `FILE_SELECTED`, preserve current behavior and also reconcile `selectedFiles` if the selected file exists in the batch.

On `FILES_SELECTED`, persist both the list and the first active selected file.

### Service methods

`GatewayFileService.selectFiles(traceId)` should request `FILE_PICKER_OPEN_MULTIPLE_REQUEST` and return:

```js
{
  status: "completed",
  traceId,
  gatewayStatus: await GatewayClient.getStatus(),
  files: response.payload.files || [],
  selectedFile: response.payload.selectedFile || null
}
```

`GatewayFileService.selectFileById(traceId, fileId)` should request `FILE_SELECT_BY_ID_REQUEST` and return the updated gateway status.

## Preconditions before implementation

- Phase 1 is implemented and verified.
- Python gateway returns `FILES_SELECTED` for multiple selection.
- Python gateway supports active-file switching by `fileId`.
- Current `GatewayClient` still uses `pendingRequests` and `persistStatus()`.

## Stop conditions if the plan does not match the real codebase

Stop before coding if:

- `GatewayClient` no longer owns the status object.
- `GatewayFileService` no longer mediates file selection.
- Message routing no longer uses `background/messageRouter.js`.
- Extension storage keys have already been redesigned.
