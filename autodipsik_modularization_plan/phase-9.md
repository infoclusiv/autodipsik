# Phase 9 — Extract ChatAutomator readiness helper module

## Objective

Reduce `sites/deepseek/chatAutomator.js` by moving readiness/probe interpretation helpers into a dedicated module while preserving workflow step order.

## Expected behavior

DeepSeek automation steps remain unchanged:
1. validate input
2. wait for page ready
3. attach file
4. wait for attachment ready
5. insert prompt
6. wait for composer ready to send
7. click send
8. verify submit effect
9. wait for response complete
10. finalize

Readiness gates must produce the same pass/fail outcomes and diagnostic snapshots.

## Success criteria

- A new helper module owns pure readiness interpretation functions, such as:
  - attachment readiness satisfied
  - attachment readiness failures
  - attachment stability failures
  - prompt normalization/composer value helpers if useful
  - send-button disabled reasons if safely movable
- `ChatAutomator.runMainAutomation(...)` remains public and stable.
- Step names, stage names, telemetry events, and diagnostic gate names remain unchanged.
- Diagnostic package still includes readiness evidence.

## How to verify

1. Run a normal file-attaching workflow.
2. Confirm it still waits for attachment readiness before prompt insertion.
3. Confirm it still waits for composer/send button readiness before clicking send.
4. Run/force a scenario where attachment is not ready and confirm:
   - error code remains `FILE_ATTACHMENT_NOT_READY`
   - expected/actual remain useful
   - readiness failure list is still populated
5. Run/force a scenario where composer is not ready and confirm:
   - error code remains `COMPOSER_NOT_READY_TO_SEND`
   - diagnostic snapshot still includes send-button evidence.

## Observable failure signals

- Attachment gate always passes too early.
- Send button click happens before upload is ready.
- Diagnostic snapshots lose `readinessFailures`.
- Error codes change unexpectedly.
- `wait_for_attachment_ready` or `wait_for_composer_ready_to_send` gate snapshots disappear.
- Response capture fails because prompt was not actually sent.

## Files/components involved

- New file, suggested: `sites/deepseek/chatAutomatorReadiness.js`
- `sites/deepseek/chatAutomator.js`
- `manifest.json`
- `sites/deepseek/diagnostics/deepseekComposerProbe.js`
- `sites/deepseek/domHelpers.js`
- `sites/deepseek/selectors.js`

## Preconditions before implementation

- Confirm helper functions are still embedded in `chatAutomator.js`.
- Confirm `ComposerProbe` still owns low-level DOM probing.
- Confirm new helper module can load after `deepseekComposerProbe.js` and before `chatAutomator.js`.

## Implementation guidance

- Suggested namespace: `DeepSeekAutomation.ChatAutomatorReadiness`.
- Extract pure functions first. Avoid moving the async wait loops in this phase unless trivial.
- Keep gate names and step names exactly:
  - `wait_for_attachment_ready`
  - `wait_for_composer_ready_to_send`
  - `click_send`
  - `verify_submit_effect`
- Do not modify `WorkflowRunner.runWorkflow(...)` usage.
- Do not modify response-capture logic in this phase.

## Stop conditions if the plan does not match the real codebase

Stop if:

- Readiness logic has already been extracted.
- Moving helpers would require changing `ComposerProbe` behavior.
- Helper extraction changes any diagnostic payload shape.
