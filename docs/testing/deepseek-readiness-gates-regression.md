# DeepSeek Readiness Gates Regression

Date: 2026-05-17

Use this guide after changes to the DeepSeek workflow, selectors, timing, or diagnostics. The goal is to confirm the readiness gates still prevent early send clicks and still explain failures clearly in exported diagnostics.

## Preconditions

- Load the unpacked extension in `chrome://extensions`.
- Open `https://chat.deepseek.com/`.
- Start the gateway with `python app-python/run_gateway.py`.
- Connect the side panel to the gateway.
- Select a valid `.xlsx` file unless the scenario explicitly says otherwise.
- Keep the `Automation Tester` and `Diagnostics` tabs available in the side panel.

## Shared Inspection Points

For every scenario below, inspect:

- the workflow timeline in the automation response
- the latest error, if the run fails
- the exported diagnostics JSON from `Export Diagnostics`

Look specifically for these readiness gates:

- `wait_for_attachment_ready`
- `wait_for_composer_ready_to_send`

Key diagnostic locations:

- `workflow.timeline`
- `workflow.steps`
- `readiness.latestAttachmentReadinessSnapshot`
- `readiness.latestComposerReadyToSendSnapshot`
- `readiness.failedCondition`
- `aiDebugSummary`

## Scenario A - Normal Success

Setup:

- Use a valid `.xlsx` file.
- Use a normal prompt.
- Leave the default DeepSeek site profile values in place.

Run:

- Execute the real automation from `Automation Tester`.
- Export diagnostics immediately after the run.

Expected result:

- `wait_for_attachment_ready` completes.
- `wait_for_composer_ready_to_send` completes.
- `click_send` runs after both readiness gates.
- The workflow completes or at minimum reaches `click_send` without readiness errors.

Diagnostics to inspect:

- `workflow.timeline`
- `workflow.steps` entries for `wait_for_attachment_ready`, `insert_prompt`, `wait_for_composer_ready_to_send`, and `click_send`
- `readiness.latestAttachmentReadinessSnapshot`
- `readiness.latestComposerReadyToSendSnapshot`

Pass / fail criteria:

- Pass if `attachmentReady`, `promptReady`, and `sendButtonReady` are all `true` before `click_send`.
- Fail if `click_send` appears before either readiness gate completes.

## Scenario B - Attachment Not Ready

Setup:

- In `Site Profile`, temporarily break `selectors.fileAttachedIndicator` or use a page state where the attachment card never becomes visible near the composer.
- Keep the selected Excel file and prompt otherwise valid.

Run:

- Execute the real automation.
- Export diagnostics after failure.

Expected result:

- The workflow fails before `insert_prompt`.
- `click_send` does not run.
- Error code is `FILE_ATTACHMENT_NOT_READY`.

Diagnostics to inspect:

- `workflow.timeline`
- `workflow.steps` entry for `wait_for_attachment_ready`
- `readiness.latestAttachmentReadinessSnapshot`
- `readiness.failedCondition`
- `aiDebugSummary`

Pass / fail criteria:

- Pass if `failedStage` is `file_attachment`, `failedStep` is `wait_for_attachment_ready`, and the attachment snapshot explains which readiness condition failed.
- Fail if the workflow reaches `insert_prompt` or if the readiness snapshot is `null`.

## Scenario C - Prompt Not Ready

Setup:

- Use a valid selected `.xlsx` file.
- Temporarily force prompt insertion failure in a reversible way:
  - use a broken `selectors.chatInput` / `selectors.chatInputFallback`, or
  - use a page state where the composer is replaced or cleared after prompt insertion.
- Do not change attachment selectors for this scenario.

Run:

- Execute the real automation.
- Export diagnostics after failure.

Expected result:

- The workflow fails before `click_send`.
- Error code is `COMPOSER_NOT_READY_TO_SEND` if the prompt disappears after insertion, or `PROMPT_INSERT_FAILED` if insertion never succeeds at all.
- If the failure reaches `wait_for_composer_ready_to_send`, its snapshot shows `promptReady: false`.

Diagnostics to inspect:

- `workflow.timeline`
- `workflow.steps` entry for `insert_prompt` or `wait_for_composer_ready_to_send`
- `readiness.latestComposerReadyToSendSnapshot`
- `readiness.failedCondition`

Pass / fail criteria:

- Pass if `click_send` does not run and the diagnostics clearly show the prompt condition failed.
- Fail if the workflow clicks send while the expected prompt text is missing from the composer.

## Scenario D - Send Button Disabled

Setup:

- Use a valid selected `.xlsx` file and prompt.
- Reproduce a state where the attachment is visible but the send button stays disabled or loading.
- If needed, temporarily adjust the page or selector environment so the button remains present but not ready.

Run:

- Execute the real automation.
- Export diagnostics after failure.

Expected result:

- The workflow fails before `click_send`.
- Error code is `COMPOSER_NOT_READY_TO_SEND`.
- The composer snapshot shows:
  - `attachmentReady: true`
  - `promptReady: true`
  - `sendButtonReady: false`

Diagnostics to inspect:

- `workflow.timeline`
- `workflow.steps` entry for `wait_for_composer_ready_to_send`
- `readiness.latestComposerReadyToSendSnapshot`
- `readiness.failedCondition`
- `readiness.involvedArea`

Pass / fail criteria:

- Pass if `click_send` does not run and the snapshot includes a disabled reason for the send button.
- Fail if the workflow clicks a disabled or loading send control.

## Scenario E - Click Allowed Only When All Conditions Are True

Setup:

- Use a valid `.xlsx` file and prompt.
- Keep the default readiness settings enabled.

Run:

- Execute the real automation.
- Export diagnostics.

Expected result:

- The only path to `click_send` goes through:
  - `attachmentReady: true`
  - `promptReady: true`
  - `sendButtonReady: true`

Diagnostics to inspect:

- `workflow.timeline`
- `workflow.steps`
- `readiness.latestAttachmentReadinessSnapshot`
- `readiness.latestComposerReadyToSendSnapshot`

Pass / fail criteria:

- Pass if `click_send` appears only after both readiness gates complete and the composer snapshot reports all three conditions true.
- Fail if any run reaches `click_send` without readiness evidence.

## Regression Notes

- Restore any temporary selector edits after each failure scenario.
- Prefer exporting diagnostics immediately after each run so the latest readiness snapshots stay easy to correlate with the workflow result.
- If a future agent automates these checks, it should assert against the same workflow steps, error codes, and readiness fields documented here.
