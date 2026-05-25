# Phase 1 — Establish a modularization safety baseline

## Objective

Create a concrete baseline before moving code so every later phase can be verified against current behavior.

## Expected behavior

No runtime behavior changes. The extension, side panel, DeepSeek content script, conditional workflows, diagnostics, and Python gateway should behave exactly as before this phase.

## Success criteria

- A short repository-local baseline note exists describing current module entrypoints and verification results.
- Existing tests/checks are run or explicitly documented as unavailable.
- No production JS/Python behavior is changed.
- The implementation agent can identify the exact current loader order before modifying modules in later phases.

## How to verify

1. Inspect:
   - `manifest.json`
   - `background-main.js`
   - `sidepanel/sidepanel.html`
   - `workflowLab/workflowLab.html`
   - `docs/architecture/current-modularization-map.md`
   - `docs/testing/manual-regression-checklist.md`
2. Run Python tests if the environment supports it:

   ```powershell
   cd app-python
   python -m pip install -r requirements.txt
   python -m pip install pytest
   python -m pytest autodipsik_gateway/tests
   ```

3. Manually load the unpacked extension and confirm service worker + sidepanel start.
4. Start the gateway:

   ```powershell
   python app-python/run_gateway.py
   ```

5. Confirm the gateway starts on `ws://127.0.0.1:8765`.

## Observable failure signals

- Service worker import failure.
- Sidepanel tabs fail to render.
- `NewSiteCore.MESSAGE_TYPES` is undefined.
- `NewSiteBackground.BackgroundBootstrap` is undefined.
- Python tests fail before any code change.
- Gateway startup fails before any code change.

## Files/components involved

- `docs/architecture/current-modularization-map.md`
- `docs/testing/manual-regression-checklist.md`
- `manifest.json`
- `background-main.js`
- `sidepanel/sidepanel.html`
- `workflowLab/workflowLab.html`
- `app-python/autodipsik_gateway/tests/test_handlers.py`

## Preconditions before implementation

- Repository branch is clean or intentionally prepared for refactor work.
- Current branch represents the intended latest baseline.
- No unrelated local runtime artifacts are staged.

## Implementation guidance

- Add a small document such as `docs/architecture/modularization-refactor-baseline.md`.
- Record:
  - current entrypoints
  - loader files
  - active high-risk modules
  - verification commands run
  - checks that could not be run and why
- Do not modify runtime code in this phase.

## Stop conditions if the plan does not match the real codebase

Stop if:

- `docs/architecture/current-modularization-map.md` is missing or clearly stale relative to the actual loaders.
- `background-main.js` is no longer the service worker composition root.
- The side panel no longer uses ordered `<script>` tags.
- Python tests fail before any implementation changes.
