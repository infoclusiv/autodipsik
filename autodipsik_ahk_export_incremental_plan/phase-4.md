# Phase 4 — Integrate AHK generation into conditional workflow completion

## Single objective

After a conditional workflow completes successfully and the workflow run JSON is saved, request `.ahk` generation and include the result in the conditional workflow response.

## Expected behavior

After `ConditionalWorkflowEngine.run(...)` returns `status: "completed"`:

1. Existing workflow run JSON save still runs.
2. New AHK file save runs using the same selected Excel file and the completed `workflowRun`.
3. The returned background result includes a new field, for example:

```javascript
workflowAhkFileSave: {
  status: "completed",
  outputPath: "...",
  fileName: "selected-excel-name.ahk",
  bytesWritten: 1234,
  overwritten: false
}
```

If AHK generation fails because tags are missing or empty, the failure should be explicit and observable. Keep the existing workflow run JSON save behavior intact.

## Files/components involved

Primary files:

- `background/workflows/deepseekConditionalWorkflow.js`

Possibly:

- `core/constants/telemetryEvents.js` only if Phase 3 did not add enough events.
- `core/diagnosticStore.js` only if an existing diagnostic helper is needed, but avoid changing it unless necessary.

Do not change:

- DeepSeek content scripts
- Conditional workflow engine semantics
- Regex extractor
- Python writer logic from Phase 1/2 except for bug fixes discovered during verification

## Implementation notes

In `deepseekConditionalWorkflow.js`:

- Add a helper similar to `saveWorkflowRunJsonIfPossible(...)`, for example:

```javascript
async function saveWorkflowAhkFileIfPossible(options) { ... }
```

- It should no-op only when there is no selected file or no workflow run.
- For normal completed workflows, it should call:

```javascript
NewSiteBackground.GatewayFileService.saveDeepSeekWorkflowAhkFile(...)
```

- Pass:
  - `traceId`
  - `workflowId`
  - `fileId`
  - `selectedFile`
  - `workflowRun`

Recommended order:

1. Save workflow run JSON first.
2. Save AHK file second.

Reason:

- The JSON file is the diagnostic record of the full workflow run.
- If AHK extraction fails, the JSON file can still help debug the final captured response.

Return shape:

- On success response, include `workflowAhkFileSave`.
- On failure response, include `workflowAhkFileSave` if available, otherwise `null`.
- If AHK save fails, preserve the structured error and record it in `DiagnosticStore`.

Failure policy:

- Prefer strict failure for missing or empty AHK tags because the user explicitly requires the `.ahk` output.
- However, do not remove the already-saved workflow JSON. It is important diagnostic evidence.

## Success criteria

- A completed conditional workflow with tagged AHK creates both:
  - `<excel-stem>.deepseek-workflow-run.<timestamp>.json`
  - `<excel-stem>.ahk`
- The returned result includes both `workflowRunJsonSave` and `workflowAhkFileSave`.
- The `.ahk` file has the same basename as the Excel file.
- The `.ahk` file is saved in the same folder as the Excel file.
- The `.ahk` file contains only the extracted code.
- Existing conditional routing still works for `prompt -> regex_extract -> condition -> prompt -> end`.
- If tags are missing, the workflow result is failed with a structured error that identifies AHK extraction/save as the failed stage.
- The workflow run JSON should still be available when AHK generation fails after JSON save.

## How to verify

Use the attached workflow or a minimal workflow whose final prompt returns:

```text
<<<archivo ahk>>>
#SingleInstance force
#NoEnv
SendMode Input
SetKeyDelay, 10
Send, ABC{Tab}123{Tab}{Tab}4.0{Tab}N
<<</archivo ahk>>>
```

Run from the side panel:

1. Select an Excel file.
2. Run the conditional workflow.
3. Confirm JSON is saved.
4. Confirm `.ahk` is saved in the same folder.
5. Confirm side panel response object contains `workflowAhkFileSave`.

Also run a negative test:

- Change the final prompt to omit `<<<archivo ahk>>>`.
- Confirm the error is structured and observable.
- Confirm the diagnostic JSON or workflow run JSON still helps identify what DeepSeek returned.

## Observable failure signals

- Workflow completes but no `.ahk` file exists.
- `.ahk` file is generated with timestamp instead of exact Excel basename.
- `.ahk` file is generated in the wrong directory.
- Result object has `workflowRunJsonSave` but no `workflowAhkFileSave` for successful tagged response.
- Missing tags silently pass as success.
- The workflow fails before JSON save due to the new AHK logic.
- Existing workflows without AHK tags unexpectedly break if the implementation is supposed to be conditional. For this specific user workflow, strict AHK generation is expected.

## Preconditions before implementation

- Phase 3 is implemented and verified.
- `DeepSeekConditionalWorkflow.run(...)` still saves workflow run JSON after successful engine completion.
- `selectedFile.fileId` still matches the selected Python gateway file.
- `workflowRun` still contains captured turn responses.

## Stop conditions if the plan does not match the real codebase

Stop if:

- Conditional workflow completion no longer happens in `background/workflows/deepseekConditionalWorkflow.js`.
- The JSON save is no longer called from the background workflow.
- The workflow result no longer includes `workflowRun.turns`.
- Adding AHK generation at this point would require changing response capture or the workflow engine.
