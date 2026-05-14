# Autodipsik One-Click Observability

## Implemented

- Cleaned the sidepanel so user-facing tabs no longer render raw payloads, event streams, or full diagnostic JSON inline.
- Switched the Site Profile Editor to the live DeepSeek profile by sending `targetSiteId: "deepseek"` through profile messages.
- Added `AUTOMATION_ONE_CLICK_RUN` and `DEEPSEEK_TAB_ENSURE` to move the normal automation flow into background orchestration.
- Added AI-ready diagnostic export modules:
  - `core/observabilityContracts.js`
  - `core/diagnosticRedactor.js`
  - `core/diagnosticExporter.js`
- Strengthened DeepSeek automation evidence around send button detection and click handling.

## Notes

- The local environment in this session does not provide `node`, so syntax validation was reviewed manually instead of using `node --check`.
- `runtime/python-events.jsonl` already had local changes in the worktree before implementation and was left as-is.

## Manual Verification To Run

1. Open the sidepanel and confirm Diagnostics only shows summary cards and export actions.
2. Open Site Profile and verify the `Send` group exposes `sendButton` and `sendButtonDisabledIndicator`.
3. In Automation Tester, enter a prompt and click only `Run automation`.
4. If prompted, select an Excel file and verify DeepSeek opens or focuses automatically.
5. Export the AI diagnostic JSON after a run and confirm local paths/base64 are redacted.
