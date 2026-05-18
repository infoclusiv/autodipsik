# DeepSeek Send Button Detection Fix — Implementation Plan

## 1. Purpose

Fix the DeepSeek automation failure where the workflow reaches `wait_for_composer_ready_to_send` but never executes `click_send`.

The causal diagnostic layer already identified the workflow-level failure as:

```text
Causal Code: SEND_BUTTON_NOT_FOUND
Blocked At: wait_for_composer_ready_to_send
Exact Cause: No valid send-button candidate was found near the composer.
```

After browser-console inspection, the issue is now more precise:

> The real DeepSeek send button exists in the DOM, but the current detector does not recognize it because it is a `DIV` icon button with no text and no `aria-label`.

The detector must recognize the real send button using its SVG arrow-up signature, composer-relative position, and disabled/enabled state.

---

## 2. Current Verified Evidence

### 2.1 Real send button disabled state

The real send button appears as a `DIV` icon button.

Observed disabled state:

```html
<div
  class="_52c986b bd74640a ds-icon-button ds-icon-button--l ds-icon-button--sizing-container ds-icon-button--disabled"
  role="button"
  aria-disabled="true"
>
  ...
</div>
```

Observed properties:

```json
{
  "role": "button",
  "ariaDisabled": "true",
  "disabledLike": true,
  "opacity": "0.4",
  "text": "",
  "svgViewBox": "0 0 16 16",
  "svgPathStart": "M8.3125 0.981587..."
}
```

### 2.2 Real send button enabled state

Observed enabled state:

```html
<div
  class="_52c986b ds-icon-button ds-icon-button--l ds-icon-button--sizing-container"
  role="button"
  aria-disabled="false"
>
  ...
</div>
```

Observed properties:

```json
{
  "role": "button",
  "ariaDisabled": "false",
  "disabledLike": false,
  "opacity": "1",
  "text": "",
  "svgViewBox": "0 0 16 16",
  "svgPathStart": "M8.3125 0.981587..."
}
```

### 2.3 Send button SVG signature

The send button uses an upward-arrow SVG path.

Stable observed path start:

```text
M8.3125 0.981587
```

Longer observed path sample:

```text
M8.3125 0.981587C8.66767 1.0545 8.97902 1.20558 9.2627 1.43374...
```

### 2.4 Attach button signature

The attach button is also a right-side icon button, but it uses a paperclip SVG path.

Observed attach button class:

```html
<div
  class="f02f0e25 ds-icon-button ds-icon-button--l ds-icon-button--sizing-container"
  role="button"
  aria-disabled="false"
>
  ...
</div>
```

Observed attach SVG path start:

```text
M5.5498 9.75V5
```

### 2.5 Important distinction

The current detector should not rely only on:

```text
button[type='submit']
button[aria-label*='Send']
[role='button'][aria-label*='Send']
```

DeepSeek currently exposes the send control as a `DIV` with:

```text
role="button"
class includes "ds-icon-button"
no visible text
no aria-label
SVG arrow-up icon
```

---

## 3. Problem Statement

The automation currently fails because the send button detector rejects or ignores empty icon buttons without text or `aria-label`.

Current causal report:

```text
attachmentReady: true
promptReady: true
sendButtonCandidateFound: false
sendButtonReady: false
clickSendExecuted: false
missingEvidence: none
ownerModule: sites/deepseek/chatAutomator.js
```

This proves:

- The Excel attachment is ready.
- The prompt is inserted.
- The workflow correctly refuses to click without a valid send candidate.
- The detection logic fails to identify the actual send button.

---

## 4. Primary Goal

Update DeepSeek send-button detection so that:

1. The arrow-up icon button is selected as the real send button.
2. The paperclip/attach button is rejected.
3. The button state is classified correctly:
   - found but disabled
   - found and enabled
4. `wait_for_composer_ready_to_send` passes only when:
   - attachment is ready
   - prompt is ready
   - the real send button exists
   - the real send button is enabled
5. `click_send` clicks the same selected send candidate that passed readiness.

---

## 5. Non-Goals

Do not modify these areas unless strictly necessary:

- Python gateway logic
- File payload resolution
- File attachment upload logic
- Prompt insertion logic
- General workflow sequencing
- Causal diagnostic architecture
- DeepSeek attachment readiness logic

This fix should focus on:

```text
sites/deepseek/diagnostics/deepseekComposerProbe.js
sites/deepseek/chatAutomator.js
sites/deepseek/siteProfile.js
```

---

## 6. Files and Components Involved

### Primary files

```text
sites/deepseek/diagnostics/deepseekComposerProbe.js
sites/deepseek/chatAutomator.js
sites/deepseek/siteProfile.js
```

### Supporting files

```text
core/diagnosticStore.js
core/diagnosticExporter.js
core/causalDiagnostics/causalDecisionTree.js
core/causalDiagnostics/causalContracts.js
```

Only update supporting files if causal reporting needs improved field names or classifications.

---

## 7. Implementation Phases

---

# Phase 1 — Add SVG signature helpers

## Objective

Add reusable helper functions that extract and classify SVG signatures from button-like elements.

## Expected behavior

The code can inspect a candidate element and determine whether it contains:

- an arrow-up/send SVG
- a paperclip/attach SVG
- an unknown icon

## Success criteria

Add helper functions similar to:

```js
function getSvgPathSignature(element) {}
function hasSvgPathStartingWith(element, prefix) {}
function isArrowUpSendIcon(element) {}
function isPaperclipAttachIcon(element) {}
```

The helper must inspect:

```text
element.querySelectorAll("svg path")
```

and collect `d` attributes.

## Suggested detection rules

### Send icon

A candidate should be classified as send icon when:

```js
pathD.includes("M8.3125 0.981587")
```

or when the path contains a stable subset of the arrow-up SVG:

```js
pathD.includes("M8.3125")
&& pathD.includes("L14.707")
&& pathD.includes("V15.0431")
```

### Attach icon

A candidate should be classified as attach/paperclip when:

```js
pathD.includes("M5.5498 9.75V5")
```

or when the path contains a stable subset of the paperclip SVG:

```js
pathD.includes("M5.5498")
&& pathD.includes("V5")
&& pathD.includes("9.75")
```

## How to verify

In DevTools or internal test harness, pass observed button elements to:

```js
isArrowUpSendIcon(element)
isPaperclipAttachIcon(element)
```

Expected:

```text
send icon button -> true for isArrowUpSendIcon
attach icon button -> true for isPaperclipAttachIcon
DeepThink/Search -> false for isArrowUpSendIcon
```

## Observable failure signals

- The helper identifies the paperclip button as send.
- The helper requires text or `aria-label`.
- The helper fails when the SVG is nested inside inner `div`s.
- The helper depends only on hashed classes like `_52c986b`.

---

# Phase 2 — Improve send button candidate discovery

## Objective

Update the DeepSeek send-button probe so that it considers right-side icon buttons near the composer, even when they have no text or `aria-label`.

## Expected behavior

`probeSendButtonState()` or equivalent function should include candidates matching:

```text
[role="button"].ds-icon-button
.ds-icon-button[role="button"]
```

near the composer.

It should classify right-side composer controls as:

- attach button
- send button
- known non-send controls
- unknown icon button

## Candidate discovery rules

A valid send candidate may be a `DIV` if it satisfies:

```text
role="button"
class includes "ds-icon-button"
visible
near composer
right side of composer
contains arrow-up send SVG
```

## Rejection rules

Reject candidates if:

```text
text is "DeepThink"
text is "Search"
candidate contains paperclip/attach SVG
candidate is not near composer
candidate is not visible
candidate is a child icon when a parent role=button exists
```

## Success criteria

The probe should return:

```json
{
  "sendButtonCandidateFound": true,
  "selectedCandidate": {
    "tagName": "DIV",
    "className": "_52c986b ... ds-icon-button ...",
    "role": "button",
    "svgSignature": "arrow_up_send",
    "selectionReason": "arrow_up_svg_near_composer_right_side"
  }
}
```

when the arrow-up button exists.

## How to verify

Run the causal diagnostic flow again.

Expected result if the button is still disabled:

```text
causalCode should become SEND_BUTTON_FOUND_BUT_DISABLED
```

Expected result if the button is enabled:

```text
wait_for_composer_ready_to_send should pass
click_send should execute
```

## Observable failure signals

- `SEND_BUTTON_NOT_FOUND` still appears while the arrow-up icon button is visible.
- The selected candidate is the paperclip button.
- The selected candidate is DeepThink or Search.
- The selected candidate is a nested `svg` or child `div` instead of the clickable parent with `role="button"`.

---

# Phase 3 — Add precise enabled/disabled classification

## Objective

Correctly classify the send button as disabled or enabled after it is found.

## Expected behavior

If the arrow-up send candidate exists but has disabled indicators, the causal report must say:

```text
SEND_BUTTON_FOUND_BUT_DISABLED
```

not:

```text
SEND_BUTTON_NOT_FOUND
```

## Disabled rules

Treat the send candidate as disabled when any of these are true:

```js
candidate.getAttribute("aria-disabled") === "true"
candidate.className.includes("ds-icon-button--disabled")
candidate.className.toLowerCase().includes("disabled")
candidate.hasAttribute("disabled")
candidate.disabled === true
getComputedStyle(candidate).opacity === "0.4"
```

## Enabled rules

Treat the send candidate as enabled when:

```js
candidate.getAttribute("aria-disabled") !== "true"
!candidate.className.includes("ds-icon-button--disabled")
!candidate.hasAttribute("disabled")
candidate.disabled !== true
getComputedStyle(candidate).visibility !== "hidden"
getComputedStyle(candidate).display !== "none"
candidate.getBoundingClientRect().width > 0
candidate.getBoundingClientRect().height > 0
```

Opacity should be used as supporting evidence, not as the only enabled signal.

## Success criteria

The send button evidence should distinguish:

```json
{
  "sendButtonCandidateFound": true,
  "sendButtonReady": false,
  "disabledReason": "aria_disabled_true"
}
```

or:

```json
{
  "sendButtonCandidateFound": true,
  "sendButtonReady": false,
  "disabledReason": "class_contains_ds_icon_button_disabled"
}
```

When enabled:

```json
{
  "sendButtonCandidateFound": true,
  "sendButtonReady": true,
  "disabledReason": ""
}
```

## How to verify

Run the flow while the send button is visibly disabled.

Expected:

```text
causalCode: SEND_BUTTON_FOUND_BUT_DISABLED
```

Run the flow when the button becomes enabled.

Expected:

```text
wait_for_composer_ready_to_send completed
click_send executed
```

## Observable failure signals

- Disabled send button is reported as not found.
- Disabled send button is reported as ready.
- Enabled send button remains blocked due to stale disabled state.
- The code reads disabled state from the wrong element.

---

# Phase 4 — Ensure click uses the selected send candidate

## Objective

Ensure the `click_send` step clicks the exact candidate selected and validated by the readiness gate.

## Expected behavior

The workflow should not re-run a different heuristic in `click_send` if `wait_for_composer_ready_to_send` already selected a valid send candidate.

The selected candidate should be stored in the workflow context or retrieved consistently.

## Suggested implementation

During composer readiness:

```js
context.sendButton = snapshot.sendButtonEvidence.selectedCandidateElement;
context.sendButtonEvidence = snapshot.sendButtonEvidence;
```

If direct DOM element storage is not safe, store a selector/re-resolution strategy:

```js
{
  svgSignature: "arrow_up_send",
  role: "button",
  classIncludes: ["ds-icon-button"],
  relativePosition: "right_side_of_composer"
}
```

Then re-resolve immediately before click and verify it still matches:

```text
same SVG signature
same enabled state
same composer-relative position
```

## Success criteria

`click_send` evidence must include:

```json
{
  "clickSendExecuted": true,
  "clickedCandidate": {
    "svgSignature": "arrow_up_send",
    "role": "button",
    "className": "...ds-icon-button..."
  }
}
```

## How to verify

Run the workflow.

If composer readiness passes, the next step must be:

```text
click_send completed
```

The diagnostic export must show the clicked candidate.

## Observable failure signals

- Readiness gate selects one candidate but click step clicks another.
- `click_send` runs without `selectedCandidate`.
- `click_send` falls back to old selector and fails.
- The clicked candidate is paperclip/attach.

---

# Phase 5 — Update causal decision tree mappings

## Objective

Ensure causal reporting reflects the refined button states accurately.

## Expected behavior

The causal report should distinguish:

```text
SEND_BUTTON_NOT_FOUND
SEND_BUTTON_FOUND_BUT_DISABLED
WRONG_SEND_BUTTON_CANDIDATE
CLICK_NOT_EXECUTED_AFTER_READY_GATE
CLICK_DISPATCHED_BUT_NO_SUBMIT_EFFECT
```

## Required mapping

If:

```js
sendButtonCandidateFound === false
```

then:

```text
SEND_BUTTON_NOT_FOUND
```

If:

```js
sendButtonCandidateFound === true
sendButtonReady === false
```

then:

```text
SEND_BUTTON_FOUND_BUT_DISABLED
```

If:

```js
selectedCandidate.svgSignature === "paperclip_attach"
```

then:

```text
WRONG_SEND_BUTTON_CANDIDATE
```

If:

```js
ready === true
clickSendStep === null
```

then:

```text
CLICK_NOT_EXECUTED_AFTER_READY_GATE
```

If:

```js
clickSendExecuted === true
submitEffectDetected === false
```

then:

```text
CLICK_DISPATCHED_BUT_NO_SUBMIT_EFFECT
```

## Success criteria

The causal report must no longer say `SEND_BUTTON_NOT_FOUND` if the arrow-up icon exists.

## How to verify

Run these scenarios:

1. Prompt empty, no file:
   - send candidate found but disabled.
2. Prompt inserted, file still processing:
   - send candidate found but disabled.
3. Prompt inserted, file ready:
   - send candidate found and ready.
4. Wrong candidate intentionally selected in test:
   - wrong candidate detected.

## Observable failure signals

- Causal report stays generic.
- Missing evidence is reported even though selected candidate evidence exists.
- Disabled button is classified as not found.
- Wrong candidate is classified as not found.

---

# Phase 6 — Improve diagnostic evidence fields

## Objective

Make the exported causal report and JSON show why the send button was selected or rejected.

## Expected behavior

Each send candidate should include:

```json
{
  "summary": {},
  "svgSignature": "arrow_up_send | paperclip_attach | unknown",
  "candidateRole": "send | attach | known_non_send | unknown",
  "selectionScore": 0,
  "selectionReasons": [],
  "rejectionReasons": [],
  "disabledSignals": []
}
```

The selected candidate should include:

```json
{
  "selectedCandidate": {},
  "selectedCandidateReason": "arrow_up_svg_near_composer_right_side",
  "disabledReason": "",
  "sendButtonCandidateFound": true,
  "sendButtonReady": true
}
```

## Success criteria

The exported diagnostic JSON lets a developer answer:

- Which element was selected?
- Why was it selected?
- Which elements were rejected?
- Why were they rejected?
- Was the selected element disabled?
- Which disabled signal was active?

## How to verify

Export diagnostics after a failed and successful run.

Confirm the causal report contains a compact explanation and the JSON contains the full evidence.

## Observable failure signals

- `selectedCandidate` is present but has no reason.
- rejected candidates have no rejection reasons.
- SVG signature is missing.
- Evidence is too large because it includes full page HTML instead of compact summaries.

---

# Phase 7 — Manual verification checklist

## Objective

Manually verify the fix in the browser using the existing Automation Tester and causal report.

## Verification steps

### Step 1 — Reload extension and DeepSeek

Reload:

```text
chrome://extensions
Autodipsik extension
DeepSeek tab
```

### Step 2 — Run Automation Tester

Use:

```text
Excel file: any valid .xlsx
Prompt: Analiza esto
```

### Step 3 — Export causal report

Expected success path:

```text
attachmentReady: true
promptReady: true
sendButtonCandidateFound: true
sendButtonReady: true
clickSendExecuted: true
```

### Step 4 — Export diagnostics JSON

Verify:

```text
selectedCandidate.svgSignature = arrow_up_send
selectedCandidate role = button
selectedCandidate class includes ds-icon-button
clickedCandidate.svgSignature = arrow_up_send
```

### Step 5 — Failure classification check

If the button is disabled during upload, expected causal code:

```text
SEND_BUTTON_FOUND_BUT_DISABLED
```

not:

```text
SEND_BUTTON_NOT_FOUND
```

---

## 8. Final Acceptance Criteria

The fix is complete when all conditions below are true:

1. The real DeepSeek arrow-up send button is detected as a candidate.
2. The paperclip attach button is rejected.
3. Empty icon buttons without text or aria-label can still be valid candidates if they match the arrow-up SVG.
4. Disabled send button is classified as:

```text
SEND_BUTTON_FOUND_BUT_DISABLED
```

5. Enabled send button allows:

```text
wait_for_composer_ready_to_send completed
click_send completed
```

6. The causal report no longer returns `SEND_BUTTON_NOT_FOUND` when the arrow-up send icon is visible.
7. The clicked element is the same logical candidate selected by readiness.
8. The diagnostic JSON includes:
   - selected candidate
   - SVG signature
   - disabled signals
   - rejected candidates
   - click evidence

---

## 9. Recommended Agent Prompt

Use this prompt with the coding agent:

```text
Fix DeepSeek send button detection in autodipsik.

Evidence:
The real DeepSeek send button is a DIV icon button with no text and no aria-label.

Disabled state:
className:
_52c986b bd74640a ds-icon-button ds-icon-button--l ds-icon-button--sizing-container ds-icon-button--disabled
role: button
aria-disabled: true
opacity: 0.4
svg path starts with:
M8.3125 0.981587

Enabled state:
className:
_52c986b ds-icon-button ds-icon-button--l ds-icon-button--sizing-container
role: button
aria-disabled: false
opacity: 1
svg path starts with:
M8.3125 0.981587

Attach button:
className:
f02f0e25 ds-icon-button ds-icon-button--l ds-icon-button--sizing-container
svg path starts with:
M5.5498 9.75V5

Current problem:
The causal diagnostic layer reports SEND_BUTTON_NOT_FOUND because the detector does not recognize empty icon buttons without text or aria-label.

Required changes:
1. Update the DeepSeek send-button probe to classify the arrow-up SVG icon as the send button.
2. Reject the paperclip/attach icon by SVG signature.
3. Treat the arrow-up icon as disabled when aria-disabled="true" or class includes ds-icon-button--disabled.
4. Treat it as ready when aria-disabled is not true and the disabled class is absent.
5. If arrow-up send icon exists but is disabled, report SEND_BUTTON_FOUND_BUT_DISABLED.
6. If arrow-up send icon exists and is enabled, wait_for_composer_ready_to_send must pass and click_send must execute.
7. Preserve and export causal evidence: selectedCandidate, rejectedCandidates, svgSignature, disabledSignals, selectedCandidateReason, clickedCandidate.

Scope:
Focus on:
- sites/deepseek/diagnostics/deepseekComposerProbe.js
- sites/deepseek/chatAutomator.js
- sites/deepseek/siteProfile.js if needed

Do not modify:
- Python gateway
- file attachment logic
- prompt insertion logic
- general workflow runner behavior

Use pnpm if any JS tooling command is needed.
```

---

## 10. Rollback Plan

If the new detection causes regressions:

1. Keep the old semantic selector path as a fallback.
2. Feature-flag the SVG-based detection under DeepSeek profile behavior:

```js
behavior: {
  enableSvgSendButtonDetection: true
}
```

3. If needed, disable the new logic by setting:

```js
enableSvgSendButtonDetection: false
```

4. Preserve causal evidence to compare old vs new detection.

---

## 11. Notes for Future Robustness

Avoid relying only on hashed classes such as:

```text
_52c986b
f02f0e25
bd74640a
```

These may change.

Prefer stable combined signals:

```text
role="button"
class includes "ds-icon-button"
near composer
right-side composer position
SVG arrow-up path signature
not paperclip path signature
disabled state from aria-disabled/class
```

The safest rule is:

```text
The real send button is the right-side DeepSeek icon button near the composer whose SVG path matches the upward arrow icon.
```
