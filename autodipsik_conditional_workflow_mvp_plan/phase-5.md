# phase-5.md

# Phase 5 — Add a DeepSeek prompt turn runner in background

## Single objective

Add a background-level prompt turn runner that executes exactly one DeepSeek prompt turn and returns a normalized captured response.

This phase creates a reusable bridge between the pure conditional workflow engine and the existing DeepSeek content automation.

## Expected behavior

A new background module can run one prompt turn:

```js
const turn = await NewSiteBackground.DeepSeekPromptTurnRunner.runTurn({
  traceId: "trace_123",
  selectedFile: selectedFileOrNull,
  promptText: "Follow-up prompt",
  attachFile: false,
  waitForResponse: true,
  turnIndex: 2,
  nodeId: "prompt_tipo_1"
});
```

Expected output shape:

```js
{
  status: "completed",
  traceId: "trace_123",
  nodeId: "prompt_tipo_1",
  turnIndex: 2,
  attachFile: false,
  promptTextLength: 16,
  workflowId: "...",
  automationResult: { },
  response: {
    source: "deepseek",
    capturedAt: "...",
    text: "...",
    textLength: 123,
    selectorUsed: "..."
  },
  error: null
}
```

If response capture is missing, the runner returns or throws a structured error with the failed stage and expected vs actual details.

## Success criteria

- A new module exists, for example:
  - `background/workflows/deepseekPromptTurnRunner.js`
- The module attaches to:
  - `NewSiteBackground.DeepSeekPromptTurnRunner`
- The module exposes:
  - `runTurn(input)`
- The module uses the existing `DeepSeekTabService.forward(...)` path with:
  - `type: MESSAGE_TYPES.RUN_AUTOMATION`
  - `targetSiteId: "deepseek"`
- For `attachFile === true`, the runner resolves the selected file payload through `GatewayFileService.resolvePayload(...)`.
- For `attachFile === false`, the runner does not require or resolve a file payload.
- The runner extracts the captured response from:
  - `automationResult.results.wait_for_deepseek_response_complete.capturedResponse`
- The runner validates captured response using:
  - `GatewayContracts.validateDeepSeekCapturedResponse(...)`
- The runner emits or records enough telemetry/diagnostic context to identify:
  - node ID
  - turn index
  - attach-file mode
  - prompt length
  - captured response text length
- The new module is loaded by `background-main.js` before `deepseekConditionalWorkflow.js` will use it in the next phase.
- Existing one-click automation remains unchanged.

## How to verify

1. Reload the extension.
2. Open the service worker console and check:

```js
Boolean(NewSiteBackground.DeepSeekPromptTurnRunner)
```

Expected result:

```js
true
```

3. With DeepSeek ready and the gateway connected, manually run a prompt-only turn:

```js
NewSiteBackground.DeepSeekPromptTurnRunner.runTurn({
  traceId: NewSiteCore.Telemetry.createTraceId("manual_turn"),
  nodeId: "manual_prompt_only",
  turnIndex: 1,
  promptText: "Say exactly: turn runner smoke test",
  attachFile: false,
  waitForResponse: true
});
```

Expected result:

- `status === "completed"`
- `response.textLength > 0`
- No file selection required.

4. Select an Excel file through the existing Automation Tester, then run a file-attached turn:

```js
const status = await NewSiteCore.GatewayClient.getStatus();
NewSiteBackground.DeepSeekPromptTurnRunner.runTurn({
  traceId: NewSiteCore.Telemetry.createTraceId("manual_file_turn"),
  nodeId: "manual_file_prompt",
  turnIndex: 1,
  selectedFile: status.selectedFile,
  promptText: "Analyze this file and answer briefly.",
  attachFile: true,
  waitForResponse: true
});
```

Expected result:

- Excel is attached.
- Response is captured.
- `response.textLength > 0`.

## Observable failure signals

- `DeepSeekPromptTurnRunner` is undefined.
- Prompt-only turn still tries to read gateway file content.
- File-attached turn does not include file payload.
- Captured response is buried only inside raw automation result and not normalized.
- Capture validation does not run.
- Existing one-click flow breaks after adding the runner.

## Files/components involved

Expected files to create or edit:

- Create:
  - `background/workflows/deepseekPromptTurnRunner.js`
- Edit:
  - `background-main.js`

Expected dependencies to use but not rewrite:

- `background/services/deepseekTabService.js`
- `background/services/gatewayFileService.js`
- `core/contracts/gatewayContracts.js`
- `core/constants/messageTypes.js`

Do not edit in this phase:

- `background/messageRouter.js`
- `background/messageHandlers/automationHandlers.js`
- Python gateway files
- Sidepanel UI files

## Preconditions before implementation

- Phase 4 is complete and verified.
- Prompt-only `RUN_AUTOMATION` works manually.
- Existing one-click automation works.
- Confirm `DeepSeekTabService.forward(...)` is still the correct background-to-content script path.
- Confirm the captured response path is still:
  - `automationResult.results.wait_for_deepseek_response_complete.capturedResponse`

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- Prompt-only turns are not possible after Phase 4.
- `DeepSeekTabService.forward(...)` no longer exists or changed API.
- `wait_for_deepseek_response_complete` changed name or result structure.
- `GatewayContracts.validateDeepSeekCapturedResponse` no longer exists.
- The runner cannot be tested without adding message routing.

## Phase scope limit

Do not add conditional workflow message types, sidepanel UI, or Python gateway saving in this phase.
