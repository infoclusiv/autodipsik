# README_AGENT — Autodipsik Modularization Plan

## Read this first

You are the implementation agent for the repository `infoclusiv/autodipsik`.

Your objective is to improve modularization while preserving current behavior. This plan is intentionally split into small, AI-safe phases. Do not collapse the phases into one large refactor.

## Execution order

Execute these files in order:

1. `phase-1.md`
2. `phase-2.md`
3. `phase-3.md`
4. `phase-4.md`
5. `phase-5.md`
6. `phase-6.md`
7. `phase-7.md`
8. `phase-8.md`
9. `phase-9.md`
10. `phase-10.md`
11. `phase-11.md`
12. `phase-12.md`

Do not move to the next phase until the current phase is implemented and verified.

## Global implementation rules

- Implement only one phase at a time.
- Follow each phase scope strictly.
- Avoid unrelated refactors, style rewrites, renames, formatting-only churn, or dependency changes.
- Preserve existing functionality and minimize regression risk.
- Do not introduce a bundler, TypeScript, ESM migration, React, npm, or pnpm workflow unless a phase explicitly requires it. None of the current phases require it.
- Preserve the current IIFE/global namespace architecture:
  - `NewSiteCore`
  - `NewSiteBackground`
  - `NewSiteSidepanel`
  - `DeepSeekAutomation`
  - `WorkflowLab`
- Preserve load order in:
  - `background-main.js`
  - `manifest.json`
  - `sidepanel/sidepanel.html`
  - `workflowLab/workflowLab.html`
- Preserve protocol and contract compatibility:
  - message type strings
  - storage keys
  - telemetry event names
  - gateway envelope shape
  - return payload shapes
  - `status: "completed"` / `status: "failed"` conventions
- Keep existing public facades available while moving internals. For example, keep `NewSiteBackground.GatewayFileService.saveDeepSeekWorkflowRunJson(...)` working even if the real implementation moves to another module.

## Before coding each phase

For the current phase only:

1. Read the phase document completely.
2. Re-read all files/components listed in **Files/components involved**.
3. Analyze the repository and fully understand the related architecture and affected components.
4. Validate that the proposed implementation matches the real current codebase behavior.
5. Confirm that preconditions are true.
6. Run or perform the baseline checks listed in the phase when possible.

Do not start coding if the phase assumptions do not match the repository.

## During implementation

- Change the smallest possible set of files.
- Prefer extraction + delegation over behavior rewrite.
- Keep old method names and call sites working unless the phase explicitly says to update them.
- When adding a new JS module:
  - Use the same IIFE pattern as surrounding files.
  - Attach exports to the correct existing namespace.
  - Add the script before consumers in the correct loader file.
- When adding a new Python module:
  - Keep tests passing.
  - Preserve exact response envelope types and payload shape.
  - Avoid changing file paths, output filenames, or side effects.

## After implementation

For the current phase:

1. Verify every **Success criteria** item.
2. Run every **How to verify** step that is feasible in the local environment.
3. Confirm **Observable failure signals** are absent.
4. Report any inconsistency, architectural conflict, missing information, or sign that the plan may be incorrect.
5. Stop if verification fails. Do not continue to the next phase.

## Common verification commands

### Python gateway

From the repository root:

```powershell
cd app-python
python -m pip install -r requirements.txt
python -m pip install pytest
python -m pytest autodipsik_gateway/tests
```

Start gateway manually:

```powershell
python app-python/run_gateway.py
```

Expected startup message:

```text
Autodipsik Python Gateway running on ws://127.0.0.1:8765
```

### Extension manual checks

Use `docs/testing/manual-regression-checklist.md` after every phase when possible.

Minimum smoke checks after JS/browser phases:

- Load unpacked extension in `chrome://extensions`.
- Confirm MV3 service worker starts without script-load/import errors.
- Open side panel.
- Confirm `Site Profile`, `Automation Tester`, and `Diagnostics` render.
- Start Python gateway.
- Connect gateway from side panel.
- Select one Excel file.
- Select multiple Excel files.
- Open DeepSeek.
- Run content-script ping/page-state detection.
- Load sample conditional workflow.
- Run a conditional workflow smoke test when DeepSeek is available.
- Export diagnostics.

## Stop conditions that apply to every phase

Stop immediately and report before continuing if any of these occur:

- A file listed in the phase does not exist or has materially different responsibilities than described.
- Existing behavior differs from the phase assumptions.
- A proposed new module would create a circular load-order dependency.
- A global namespace export is missing at runtime.
- The service worker fails to load.
- Sidepanel shows null-binding errors.
- DeepSeek content script stops responding to ping.
- Gateway protocol response types change unexpectedly.
- Python tests fail after a Python phase.
- Manual regression checklist fails in an area touched by the phase.
