# Phase 8 — Extract DeepSeek content script handlers behind a router

## Objective

Reduce `sites/deepseek/content.js` into a small singleton/bootstrap/router layer by moving route handlers into a dedicated content handlers module.

## Expected behavior

Content-script behavior remains unchanged:
- Singleton guard still prevents duplicate initialization.
- `SELECTOR_TEST`, `SELECTOR_TEST_ALL`, `PAGE_STATE_DETECT`, `RUN_AUTOMATION`, `DEEPSEEK_CONTENT_SCRIPT_PING`, `DIAGNOSTICS_GET`, and `DEEPSEEK_ATTACH_FILE` still respond.
- Error responses keep `status: "failed"` and structured error payloads.
- File attachment still uses the same payload-to-File behavior and profile upload dispatch events.

## Success criteria

- `sites/deepseek/content.js` mainly owns:
  - singleton guard
  - loaded timestamp
  - listener registration
  - routing to handler module
- New handler module owns:
  - attach file
  - get profile
  - selector tests
  - page-state detect
  - run automation
  - diagnostics payload
  - ping response helper if desired
- `manifest.json` loads new handler module before `sites/deepseek/content.js`.
- No message type changes.

## How to verify

1. Reload extension.
2. Open DeepSeek.
3. Confirm console shows content script loaded once.
4. Send/trigger DeepSeek content ping and confirm completed response.
5. Run page-state detection.
6. Run selector test/test all if available.
7. Select a file and run a file-attaching conditional workflow.
8. Export diagnostics after a failure and confirm page summary still appears.

## Observable failure signals

- Content script initializes repeatedly.
- `DeepSeekAutomation.DeepSeekContentHandlers` undefined.
- Ping returns ignored/failed.
- Page-state detection fails.
- File attach fails with missing `FilePayloadHelpers`.
- `RUN_AUTOMATION` no longer reaches `ChatAutomator.runMainAutomation`.

## Files/components involved

- New file, suggested: `sites/deepseek/contentHandlers.js`
- `sites/deepseek/content.js`
- `manifest.json`
- `sites/deepseek/chatAutomator.js`
- `sites/deepseek/filePayloadHelpers.js`
- `sites/deepseek/siteProfile.js`
- `sites/deepseek/selectors.js`
- `sites/deepseek/pageState.js`
- `sites/deepseek/domHelpers.js`

## Preconditions before implementation

- Confirm `manifest.json` DeepSeek content script chain can insert a new script before `content.js`.
- Confirm `content.js` still directly implements the listed handlers.
- Confirm `ChatAutomator` and helper modules load before `content.js`.

## Implementation guidance

- Suggested namespace: `DeepSeekAutomation.DeepSeekContentHandlers`.
- Suggested public method: `handleMessage(message)`.
- Keep `content.js` listener as:

  ```js
  DeepSeekAutomation.DeepSeekContentHandlers.handleMessage(message)
  ```

- Preserve the singleton guard and loaded timestamp in `content.js`.
- Preserve catch block behavior, including structured error and page summary.

## Stop conditions if the plan does not match the real codebase

Stop if:

- Content routing already moved.
- Manifest content-script order differs significantly.
- Handler extraction requires async module imports.
- File attachment depends on closure-only state that cannot be safely moved.
