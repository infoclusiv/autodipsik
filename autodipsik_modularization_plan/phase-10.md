# Phase 10 — Extract ChatAutomator workflow step builder

## Objective

Separate the construction of DeepSeek workflow steps from `ChatAutomator.runMainAutomation(...)` while keeping the public automator API stable.

## Expected behavior

`DeepSeekAutomation.ChatAutomator.runMainAutomation(options)` still returns the same workflow result and diagnostic package shape, but the step definitions are composed by a dedicated builder module.

## Success criteria

- A new module builds the `steps` array.
- `runMainAutomation(...)` still:
  - normalizes input
  - calls the step builder
  - calls `WorkflowRunner.runWorkflow(...)`
  - creates failure diagnostic package
  - returns success/failure result
- Step order is unchanged.
- Step names and stage names are unchanged.
- Existing helper functions used by steps are passed explicitly or exposed through a narrow dependency object.

## How to verify

1. Run dry-run automation if supported by internal route.
2. Run real conditional workflow through prompt-turn runner.
3. Confirm workflow timeline contains the same step names in the same order.
4. Confirm failure diagnostic package still includes:
   - `failedStep`
   - `expected`
   - `actual`
   - `profileSnapshot`
   - `selectorHealth`
   - `selectedFile`
   - `sendButtonEvidence`
   - response-capture evidence when relevant
5. Confirm no helper becomes implicitly undefined at runtime.

## Observable failure signals

- Workflow timeline step names change.
- `WorkflowRunner.runWorkflow` receives an empty/invalid steps array.
- Diagnostic package is missing selector health or composer snapshots.
- `runMainAutomation` no longer returns `workflowName`.
- Prompt turn runner fails to extract `wait_for_deepseek_response_complete`.

## Files/components involved

- New file, suggested: `sites/deepseek/chatAutomatorSteps.js`
- `sites/deepseek/chatAutomator.js`
- `manifest.json`
- `sites/deepseek/chatAutomatorReadiness.js`
- `sites/deepseek/responseCapture.js`
- `sites/deepseek/diagnostics/deepseekComposerProbe.js`

## Preconditions before implementation

- Phase 9 completed and verified.
- `runMainAutomation(...)` still contains inline `steps`.
- All helper dependencies for step functions are identifiable and can be passed safely.

## Implementation guidance

- Suggested namespace: `DeepSeekAutomation.ChatAutomatorSteps`.
- Suggested method:

  ```js
  buildSteps({
    profile,
    workflowInput,
    helpers
  })
  ```

- Keep context mutation semantics unchanged because steps currently share data through `context`.
- Do not alter the `WorkflowRunner` contract.
- Keep diagnostic package assembly in `chatAutomator.js` for this phase.

## Stop conditions if the plan does not match the real codebase

Stop if:

- Step construction has already moved.
- Required helper functions cannot be passed without creating a large circular dependency.
- Extraction would change step context behavior.
