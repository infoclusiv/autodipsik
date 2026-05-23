# phase-4.md

# Phase 4 — Add prompt-only turn support to the existing DeepSeek automation

## Single objective

Allow the existing DeepSeek `RUN_AUTOMATION` path to send a prompt without attaching a file, while preserving the current file-attachment behavior by default.

This is required because conditional workflows need prompt 1 with Excel attachment, then follow-up prompts without re-attaching the same Excel file.

## Expected behavior

Current behavior remains unchanged:

- Existing one-click automation still attaches the selected Excel file.
- Existing one-click automation still waits for attachment readiness.
- Existing one-click automation still captures the response and saves the existing single-response JSON.

New behavior:

- A caller can send:

```js
{
  type: MESSAGE_TYPES.RUN_AUTOMATION,
  traceId: "...",
  targetSiteId: "deepseek",
  input: {
    dryRun: false,
    promptText: "Follow-up prompt",
    attachFile: false,
    waitForResponse: true
  }
}
```

Expected result:

- The DeepSeek content workflow skips:
  - `attach_file`
  - `wait_for_attachment_ready`
- The workflow still performs:
  - `validate_input`
  - `wait_for_page_ready`
  - `insert_prompt`
  - `wait_for_composer_ready_to_send`
  - `click_send`
  - `verify_submit_effect`
  - `wait_for_deepseek_response_complete`
  - `finalize`
- Composer readiness no longer requires attachment readiness when `attachFile === false`.

## Success criteria

- `GatewayFileService.resolvePayload(input)` returns `null` instead of throwing when:
  - `input.attachFile === false`
- `DeepSeekWorkflowContracts.validateRunAutomationInput(...)` accepts optional boolean `attachFile`.
- `sites/deepseek/chatAutomator.js` normalizes:
  - `attachFile: input.attachFile !== false`
  - `requireAttachmentReady: attachFile`
- `validate_input` in `chatAutomator.js` requires a file payload only when:
  - `!dryRun && attachFile === true`
- `attach_file` returns a skipped result when:
  - `dryRun === true` or `attachFile === false`
- `wait_for_attachment_ready` returns a skipped result when:
  - `dryRun === true` or `attachFile === false`
- `ComposerProbe.probeComposerReadyToSend(...)` treats attachment readiness as satisfied when the workflow input explicitly indicates:
  - `requireAttachmentReady === false`
- `ComposerProbe.probeSubmitEffect(...)` does not treat missing attachment evidence as a failure when:
  - `requireAttachmentReady === false`
- Existing one-click automation still works because it does not set `attachFile: false`.

## How to verify

1. Run the existing one-click automation from Automation Tester.

Expected result:

- Same behavior as before.
- Excel is attached.
- Response is captured.
- Existing `responseJsonSave` still works.

2. With DeepSeek already open, send a prompt-only automation message manually from the service worker console or by a temporary local console test:

```js
chrome.runtime.sendMessage({
  type: NewSiteCore.MESSAGE_TYPES.RUN_AUTOMATION,
  targetSiteId: "deepseek",
  input: {
    dryRun: false,
    promptText: "Say exactly: prompt-only smoke test",
    attachFile: false,
    waitForResponse: true
  }
});
```

Expected result:

- No gateway selected file is required for this prompt-only turn.
- No file attachment step is attempted.
- The prompt is sent.
- A response is captured.

3. Inspect returned workflow timeline.

Expected result:

- `attach_file` is present with `skipped: true` or equivalent skipped status.
- `wait_for_attachment_ready` is present with `skipped: true` or equivalent skipped status.
- `wait_for_deepseek_response_complete.responseCaptured === true`.

## Observable failure signals

- Prompt-only turn fails with `GATEWAY_FILE_NOT_SELECTED`.
- Prompt-only turn fails with `FILE_PAYLOAD_REQUIRED`.
- Prompt-only turn fails at `COMPOSER_NOT_READY_TO_SEND` because attachment is missing.
- Existing one-click flow stops attaching Excel.
- Existing one-click flow skips attachment readiness unexpectedly.
- Response capture works for one-click but not prompt-only turns.

## Files/components involved

Expected files to edit:

- `background/services/gatewayFileService.js`
- `core/contracts/deepseekWorkflowContracts.js`
- `sites/deepseek/chatAutomator.js`
- `sites/deepseek/diagnostics/deepseekComposerProbe.js`

Do not edit in this phase:

- `background/workflows/deepseekOneClickWorkflow.js`, except only if a tiny compatibility change is absolutely necessary and preserves current behavior.
- Python gateway files
- UI files
- Conditional workflow engine files

## Preconditions before implementation

- Existing one-click automation is working before the change.
- Phase 1, Phase 2, and Phase 3 are complete.
- Confirm `AutomationHandlers.runAutomation` still calls `GatewayFileService.resolvePayload(...)` before forwarding to the content script.
- Confirm `chatAutomator.js` still owns the file attachment and response capture steps.
- Confirm `deepseekComposerProbe.js` still computes `probeComposerReadyToSend(...)` using attachment, prompt, and send button readiness.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- `RUN_AUTOMATION` no longer routes through `GatewayFileService.resolvePayload`.
- `chatAutomator.js` no longer contains `attach_file`, `wait_for_attachment_ready`, or `wait_for_composer_ready_to_send`.
- `deepseekComposerProbe.js` no longer calculates attachment readiness inside `probeComposerReadyToSend`.
- DeepSeek changed its UI such that prompt-only sends need a different interaction path.
- Existing one-click behavior is already broken before this phase.

## Phase scope limit

Do not add conditional workflow message routing or UI in this phase. Only make prompt-only turns possible through the existing automation path.
