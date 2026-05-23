# phase-2.md

# Phase 2 — Add pure regex extraction and condition evaluation modules

## Single objective

Add pure, independently testable workflow decision utilities for regex extraction and branch evaluation.

This phase should not call DeepSeek, Chrome APIs, the Python gateway, or the DOM.

## Expected behavior

Two new core modules can process text and variables:

1. `RegexExtractor.extract(...)`
2. `ConditionEvaluator.evaluate(...)`

Example extraction input:

```js
const text = "The result is [[TIPO: tipo_1]].";
const patterns = [
  {
    name: "tipo",
    regex: "\\[\\[TIPO:\\s*(tipo_1|tipo_2)\\s*\\]\\]",
    groupIndex: 1,
    required: true
  }
];
```

Expected extraction output:

```js
{
  status: "matched",
  variables: {
    tipo: "tipo_1"
  },
  matches: [
    {
      name: "tipo",
      value: "tipo_1",
      matched: true
    }
  ],
  errors: []
}
```

Example condition input:

```js
{
  variable: "tipo",
  branches: [
    { equals: "tipo_1", nextNodeId: "prompt_tipo_1" },
    { equals: "tipo_2", nextNodeId: "prompt_tipo_2" }
  ],
  fallbackNextNodeId: "end_no_match"
}
```

Expected condition output:

```js
{
  status: "matched",
  variable: "tipo",
  actualValue: "tipo_1",
  nextNodeId: "prompt_tipo_1",
  reason: "variable tipo matched tipo_1"
}
```

## Success criteria

- New modules exist, for example:
  - `core/workflow/regexExtractor.js`
  - `core/workflow/conditionEvaluator.js`
- Modules attach to:
  - `NewSiteCore.RegexExtractor`
  - `NewSiteCore.ConditionEvaluator`
- `RegexExtractor.extract(...)` supports:
  - `name`
  - `regex`
  - `groupIndex`
  - `groupName`
  - `required`
  - `flags`
- `RegexExtractor.extract(...)` returns a structured non-throwing result for normal no-match cases.
- Required no-match patterns either:
  - return `status: "failed"` with an error object, or
  - throw a structured error only if the calling contract requires hard failure.
- `ConditionEvaluator.evaluate(...)` supports:
  - exact equality through `equals`
  - fallback through `fallbackNextNodeId`
- Errors include:
  - expected
  - actual
  - probableCause
- Modules are loaded by `background-main.js` after contracts and before background workflows that will use them.
- Existing one-click automation remains unchanged.

## How to verify

1. Reload the extension.
2. In the service worker console, check:

```js
Boolean(NewSiteCore.RegexExtractor && NewSiteCore.ConditionEvaluator)
```

Expected result:

```js
true
```

3. Test extraction:

```js
NewSiteCore.RegexExtractor.extract({
  text: "Decision: [[TIPO: tipo_1]]",
  patterns: [
    {
      name: "tipo",
      regex: "\\[\\[TIPO:\\s*(tipo_1|tipo_2)\\s*\\]\\]",
      groupIndex: 1,
      required: true
    }
  ]
})
```

Expected result:

- `status === "matched"`
- `variables.tipo === "tipo_1"`

4. Test required no-match:

```js
NewSiteCore.RegexExtractor.extract({
  text: "Decision missing",
  patterns: [
    {
      name: "tipo",
      regex: "\\[\\[TIPO:\\s*(tipo_1|tipo_2)\\s*\\]\\]",
      groupIndex: 1,
      required: true
    }
  ]
})
```

Expected result:

- `status === "failed"` or a structured contract error, depending on implementation choice.
- Failure includes expected vs actual.

5. Test condition evaluation:

```js
NewSiteCore.ConditionEvaluator.evaluate({
  variable: "tipo",
  branches: [
    { equals: "tipo_1", nextNodeId: "prompt_tipo_1" },
    { equals: "tipo_2", nextNodeId: "prompt_tipo_2" }
  ],
  fallbackNextNodeId: "end_no_match"
}, { tipo: "tipo_2" })
```

Expected result:

- `status === "matched"`
- `nextNodeId === "prompt_tipo_2"`

## Observable failure signals

- Modules are undefined in the background global.
- Regex with escaped brackets fails incorrectly.
- Extraction returns the entire match when `groupIndex: 1` should return the capture group.
- Missing required matches do not produce diagnostic information.
- Condition evaluation returns no fallback when no branch matches.
- Existing one-click automation breaks due to script load order.

## Files/components involved

Expected files to create or edit:

- Create:
  - `core/workflow/regexExtractor.js`
  - `core/workflow/conditionEvaluator.js`
- Edit:
  - `background-main.js`

Do not edit in this phase:

- UI files
- DeepSeek content automation
- Background message router
- Python gateway

## Preconditions before implementation

- Phase 1 is complete and verified.
- Confirm `background-main.js` can load files under `core/workflow/`.
- Confirm no existing module already provides the same globals.
- Confirm the project style still uses plain JavaScript IIFEs rather than bundling.

## Stop conditions if the plan does not match the real codebase

Stop and report before coding if:

- There is already a workflow engine/extractor/evaluator with incompatible APIs.
- `background-main.js` cannot load new files from `core/workflow/`.
- The extension build system now requires manifest registration for background core files.
- The repository has added formal test tooling that should be used instead of console verification.

## Phase scope limit

Do not execute workflows or add runtime message types in this phase.
