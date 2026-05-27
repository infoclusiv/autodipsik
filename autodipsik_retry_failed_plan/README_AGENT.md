# README_AGENT — Autodipsik incremental implementation plan

Read this file first.

Execute the phase `.md` files in order:

1. `phase-1.md`
2. `phase-2.md`
3. `phase-3.md`
4. `phase-4.md`
5. `phase-5.md`

Implement only one phase at a time.

Before coding each phase:

- Read the phase document completely.
- Analyze the repository and fully understand the related architecture and affected components.
- Validate that the proposed implementation matches the real root cause and current codebase behavior.
- Confirm that the files, functions, and contracts referenced by the phase still exist and behave as described.
- Do not assume this plan is perfect if the repository has changed.

During implementation:

- Follow the phase scope strictly.
- Avoid unrelated refactors or unnecessary changes.
- Preserve existing functionality and minimize regression risk.
- Keep changes small, local, and easy to revert.
- Prefer existing architecture, naming, contracts, telemetry, diagnostic, and UI patterns.
- Use pnpm if package commands are needed.
- Never hardcode API keys or secrets.

After implementation:

- Verify all success criteria defined in the phase document.
- Confirm observable signals and expected behavior.
- Report any inconsistencies, architectural conflicts, missing information, or signs that the proposed plan may be incorrect before continuing.
- Do not move to the next phase until the current phase is implemented and verified.

Repository findings used to create this plan:

- The Python gateway stores selected files in `app-python/autodipsik_gateway/files/file_store.py` and can activate one file by `fileId`.
- The Python websocket file handlers expose multi-file selection and file activation in `app-python/autodipsik_gateway/websocket/file_handlers.py`.
- The extension protocol already includes `FILES_SELECTED`, `FILE_SELECT_BY_ID_REQUEST`, and `FILE_CONTENT_REQUEST` in `core/gatewayProtocol.js`.
- The background file service can select multiple files, activate by `fileId`, and resolve a selected file payload in `background/services/gatewayFileService.js`.
- The batch workflow already iterates selected files sequentially in `background/workflows/deepseekBatchConditionalWorkflow.js`.
- The batch workflow already has a `continueOnError` input flag, but its default is `false`.
- The sidepanel orchestrator passes `continueOnError` only when the caller explicitly provides `true` in `sidepanel/automationTester/automationRunOrchestrator.js`.
- The sidepanel controller currently calls `runConditionalWorkflowBatch({ definition, selectedFiles })` without `continueOnError`, so batch execution stops at the first failed file.
- The UI already renders a batch result summary and individual item statuses in `sidepanel/automationTester/automationTester.sections.js`, but there is no retry-failed button or stored failed-files queue.

Primary intended behavior:

- When multiple Excel files are selected, one failed file must not stop the rest of the batch.
- The batch result must preserve which files failed.
- The sidepanel must expose a button to retry only failed files.
- Retrying failed files must run the same workflow definition against the failed-file subset without requiring the user to reload the extension or reselect files.
