# Phase 5 — Remove the executable legacy one-click background route

## Single objective

Remove the background-level executable path for the legacy one-click single-prompt workflow after the UI no longer exposes it.

## Expected behavior

After this phase:

- No active UI sends `AUTOMATION_ONE_CLICK_RUN`.
- The background message router no longer registers a handler for `AUTOMATION_ONE_CLICK_RUN`.
- `background-main.js` no longer imports the legacy `background/workflows/deepseekOneClickWorkflow.js` module.
- The conditional workflow path still works.
- Internal conditional prompt turns still work through `DeepSeekPromptTurnRunner` and `MESSAGE_TYPES.RUN_AUTOMATION`.

## Success criteria

- `background/messageRouter.js` no longer maps `MESSAGE_TYPES.AUTOMATION_ONE_CLICK_RUN` to a handler.
- `background/messageHandlers/automationHandlers.js` no longer exposes or calls `runOneClick(...)`.
- `background-main.js` no longer imports `background/workflows/deepseekOneClickWorkflow.js`.
- `core/constants/messageTypes.js` no longer exposes `AUTOMATION_ONE_CLICK_RUN` if no references remain.
- `background/workflows/deepseekOneClickWorkflow.js` can be deleted if no active references remain. If the repository prefers keeping deprecated files temporarily, it must not be imported or executable.
- `core/contracts/backgroundContracts.js` can be simplified or deleted only if no active references remain.
- Do not remove `RUN_AUTOMATION`.
- Do not remove `DEEPSEEK_ATTACH_FILE`, `DEEPSEEK_TAB_ENSURE`, or `DEEPSEEK_CONTENT_SCRIPT_PING` unless unrelated dead-code analysis proves they are unused.
- Do not remove `background/workflows/deepseekPromptTurnRunner.js`.
- Do not remove `sites/deepseek/chatAutomator.js` or response capture modules.

## How to verify

1. Search for legacy one-click references:

   ```powershell
   git grep -n "AUTOMATION_ONE_CLICK_RUN\|DeepSeekOneClickWorkflow\|runOneClick\|automation.one_click" -- .
   ```

   Expected:
   - No active executable references remain.
   - Telemetry constants may remain only if intentionally retained and harmless. Prefer removing unused one-click telemetry constants if no files reference them.

2. Run the cleanup verifier:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/verify-cleanup.ps1
   ```

3. Reload the extension.

   Expected: background service worker starts without import errors.

4. Open the side panel.

   Expected: no console errors and no legacy single-prompt controls.

5. Run a valid conditional workflow.

   Expected:
   - Background receives `CONDITIONAL_WORKFLOW_RUN`.
   - `deepseekConditionalWorkflow` starts.
   - Prompt nodes still execute through `DeepSeekPromptTurnRunner`.
   - The workflow can still save workflow run JSON through the gateway when a selected file exists.

6. Test the sample workflow with at least one prompt node requiring a file.

   Expected: file selection and DeepSeek prompt turn behavior still works.

## Observable failure signals

- Background service worker fails to start due to `importScripts` missing file or missing global.
- `MessageRouter` throws for `CONDITIONAL_WORKFLOW_RUN` because message type definitions were accidentally changed.
- Conditional prompt nodes fail because `RUN_AUTOMATION` or prompt turn runner was removed.
- `git grep` still finds active sidepanel or background calls to `runOneClick`.
- Extension UI still exposes a single-prompt execution path.
- `scripts/verify-cleanup.ps1` reports missing referenced files.

## Files/components involved

- `background-main.js`
- `background/messageRouter.js`
- `background/messageHandlers/automationHandlers.js`
- `background/workflows/deepseekOneClickWorkflow.js`
- `core/constants/messageTypes.js`
- `core/contracts/backgroundContracts.js`
- `core/constants/telemetryEvents.js` only if removing unused one-click telemetry constants is safe.
- `scripts/verify-cleanup.ps1` only if adding explicit legacy-route verification is desired.

## Preconditions before implementation

- Phase 4 must be implemented and verified.
- Confirm `git grep -n "AUTOMATION_ONE_CLICK_RUN\|runOneClick" -- sidepanel workflowLab` returns no active UI callers.
- Confirm conditional workflows still pass through `CONDITIONAL_WORKFLOW_RUN`.
- Confirm `DeepSeekPromptTurnRunner` still depends on `MESSAGE_TYPES.RUN_AUTOMATION` for prompt nodes.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- Any active conditional workflow code uses `AUTOMATION_ONE_CLICK_RUN` internally.
- `deepseekOneClickWorkflow.js` has been repurposed as a required conditional workflow component.
- Removing `BackgroundContracts.validateAutomationOneClickInput` would break unrelated active validation paths.
- The implementation agent cannot clearly distinguish legacy user-facing one-click from internal prompt-turn execution.

## Suggested implementation notes

Recommended order:

1. Remove `runOneClick` from `background/messageHandlers/automationHandlers.js`.
2. Remove `handlers[MESSAGE_TYPES.AUTOMATION_ONE_CLICK_RUN]` from `background/messageRouter.js`.
3. Remove `AUTOMATION_ONE_CLICK_RUN` from `core/constants/messageTypes.js` if no references remain.
4. Remove `background/workflows/deepseekOneClickWorkflow.js` from `background-main.js` imports.
5. Delete `background/workflows/deepseekOneClickWorkflow.js` only after all references are gone.
6. Delete or simplify `core/contracts/backgroundContracts.js` only after all references are gone.
7. Optionally remove one-click telemetry constants after grep confirms no active references.

Keep changes small and reversible. If there is any uncertainty, remove the route and import first, then leave unused files for a later cleanup rather than risking conditional workflow regressions.
