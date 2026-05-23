# Phase 6 — Add regression documentation and explicit verification for the new conditional-only behavior

## Single objective

Document and verify the final behavior: conditional workflow JSON persistence works and the user-facing single-prompt legacy path is gone.

## Expected behavior

After this phase:

- The repo includes a clear manual regression checklist for conditional workflow persistence and conditional-only UI behavior.
- The existing cleanup verifier still passes.
- If appropriate, the verifier or documentation explicitly warns against reintroducing the legacy one-click UI path.
- The implementation agent has evidence that the final result matches the user request.

## Success criteria

- `docs/testing/manual-regression-checklist.md` includes a section for:
  - Automation Tester draft persistence
  - Workflow Lab draft persistence
  - cross-surface draft persistence
  - extension reload persistence
  - Chrome restart persistence
  - invalid JSON draft preservation
  - conditional-only UI verification
  - conditional workflow execution smoke test
- The checklist explicitly states that `RUN_AUTOMATION` may still exist as a low-level internal primitive for conditional prompt nodes.
- If `scripts/verify-cleanup.ps1` is extended, it checks only stable, low-risk invariants, such as absence of sidepanel ids for removed legacy buttons or absence of active `AUTOMATION_ONE_CLICK_RUN` routes.
- The script must not block valid conditional workflow internals.
- All previous phases remain functional.

## How to verify

1. Run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/verify-cleanup.ps1
   ```

2. Run reference searches:

   ```powershell
   git grep -n "automation-prompt-text\|run-automation\|run-dry-run" -- sidepanel
   git grep -n "AUTOMATION_ONE_CLICK_RUN\|DeepSeekOneClickWorkflow\|runOneClick" -- background core sidepanel workflowLab
   ```

   Expected:
   - No sidepanel legacy UI references.
   - No active executable one-click route remains.
   - Any remaining references must be consciously documented as harmless constants/comments, or removed.

3. Manual persistence regression:

   - Paste valid JSON in Automation Tester.
   - Close/reopen side panel.
   - Reload extension.
   - Close/reopen Chrome.
   - Confirm draft remains.

4. Manual Workflow Lab regression:

   - Open Workflow Lab.
   - Confirm it reads the same draft.
   - Edit the draft.
   - Close/reopen Workflow Lab.
   - Confirm draft remains.

5. Manual invalid JSON regression:

   - Type invalid JSON.
   - Close/reopen side panel or Workflow Lab.
   - Confirm invalid draft text is preserved.
   - Click run and confirm parse error appears without losing text.

6. Manual execution smoke test:

   - Load the sample conditional workflow.
   - Select an Excel file if required by `attachFile: true`.
   - Run conditional workflow.
   - Confirm the result area shows status, trace id, workflow id, visited nodes, variables, and decisions.

## Observable failure signals

- Documentation describes legacy single-prompt as still supported.
- Regression script fails because it accidentally flags required conditional internals.
- Manual testing shows draft text is lost after reload or Chrome restart.
- Workflow Lab and Automation Tester use different storage keys.
- Conditional workflow run no longer reaches prompt nodes.
- Workflow run JSON saving through the gateway regresses.

## Files/components involved

- `docs/testing/manual-regression-checklist.md`
- `scripts/verify-cleanup.ps1` only if adding low-risk verification is useful.
- No production UI or runtime files should be changed in this phase unless a documentation-driven verification issue reveals a small missing cleanup.

## Preconditions before implementation

- Phase 1 through Phase 5 must be implemented and verified.
- The implementation agent must have manually tested at least Automation Tester persistence and conditional workflow execution.
- Any remaining legacy references must be understood before deciding whether they are harmless or should be removed.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- There is no `docs/testing/manual-regression-checklist.md` and the repo has a different testing documentation convention.
- `scripts/verify-cleanup.ps1` has changed substantially and adding checks would create false positives.
- The codebase now has automated tests that should be updated instead of or before manual docs.

## Suggested implementation notes

Prefer documentation first, script changes second.

If extending `scripts/verify-cleanup.ps1`, only add checks that are stable after the previous phases. Example safe checks:

- Sidepanel does not contain removed DOM ids:
  - `automation-prompt-text`
  - `run-automation`
  - `run-dry-run`
- Active background files do not route `AUTOMATION_ONE_CLICK_RUN`.

Avoid checks that forbid `RUN_AUTOMATION`, `DeepSeekPromptTurnRunner`, `chatAutomator`, or response capture modules because those are required for conditional workflow prompt nodes.
