# Automation Tester Batch Retry Regression Checklist

Use this checklist when verifying multi-file conditional workflow runs in the sidepanel.

## Continue After Failure

1. Start the Python gateway.
2. Open the extension sidepanel and go to `Automation Tester`.
3. Select at least 3 Excel files.
4. Run a conditional workflow that is expected to fail for at least 1 file.
5. Confirm the batch summary shows all attempted files, including files after the first failure.
6. Confirm the batch toast says the batch finished with failures instead of saying it stopped early.
7. Export or inspect diagnostics and confirm the batch telemetry includes:
   - `batchId`
   - `traceId`
   - `workflowId`
   - `runMode: "full_batch"`
   - `continueOnError: true`
   - `selectedFileIds`
   - `failedFileIds` when failures occurred
   - `continuedAfterFailure: true` when later files still ran after a failure

## Retry Failed Files

1. After a partial-failure batch, confirm the `Failed files` list appears in the batch summary.
2. Confirm the `Retry failed files` button appears only when retryable failed files exist.
3. Click `Retry failed files` without reselecting files.
4. Confirm only the previously failed files are retried.
5. Confirm successful retry items disappear from the failed-file queue.
6. Confirm files that fail again remain listed for another retry.
7. Export or inspect diagnostics and confirm the retry batch telemetry includes:
   - `runMode: "failed_only"`
   - `retryCount` greater than `0`
   - `selectedFileIds` limited to the retry subset

## Regression Guardrails

- Do not log file contents or base64 payloads in telemetry.
- Do not reopen the file picker during retry.
- Do not regress single-file conditional workflow behavior.
