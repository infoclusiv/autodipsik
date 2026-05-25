from __future__ import annotations

from autodipsik_gateway.contracts import build_envelope
from autodipsik_gateway.files.file_store import FileStore, StoredFile
from autodipsik_gateway.files.response_writer import (
    write_deepseek_response_json,
    write_deepseek_workflow_ahk_file,
    write_deepseek_workflow_run_json,
)
from autodipsik_gateway.observability import JsonlLogger
from autodipsik_gateway.websocket.errors import build_error_payload


class GatewaySaveHandlers:
    def __init__(self, file_store: FileStore, logger: JsonlLogger) -> None:
        self.file_store = file_store
        self.logger = logger

    @staticmethod
    def _split_error(
        value: str,
        default_code: str,
        default_message: str,
        default_expected: str,
        default_actual: str,
    ) -> tuple[str, str, str, str]:
        parts = str(value or "").split("|", 3)
        if len(parts) == 4:
            return parts[0], parts[1], parts[2], parts[3]
        return default_code, default_message, default_expected, default_actual

    def _validate_selected_file(
        self,
        *,
        payload: dict,
        correlation_id: str,
        failed_event: str,
        failed_state: str,
    ) -> tuple[StoredFile | None, dict | None]:
        selected_file = self.file_store.get_selected_file()
        if not selected_file:
            error_payload = build_error_payload(
                "GATEWAY_FILE_NOT_SELECTED",
                "No selected file is available in FileStore.",
                expected="A selected Excel file should exist in FileStore.",
                actual="FileStore has no selected file.",
            )
            self.logger.emit(
                event=failed_event,
                correlation_id=correlation_id,
                component="python_gateway",
                state=failed_state,
                details={"fileId": payload.get("fileId", "")},
                level="ERROR",
                expected=error_payload["expected"],
                actual=error_payload["actual"],
                error=error_payload,
            )
            return None, build_envelope("ERROR", error_payload, correlation_id=correlation_id)

        if payload.get("fileId") != selected_file.file_id:
            error_payload = build_error_payload(
                "GATEWAY_SELECTED_FILE_MISMATCH",
                "The payload file id did not match the currently selected file.",
                expected="Payload fileId should match FileStore selected fileId.",
                actual="Payload fileId did not match selected fileId.",
            )
            self.logger.emit(
                event=failed_event,
                correlation_id=correlation_id,
                component="python_gateway",
                state=failed_state,
                details={"fileId": payload.get("fileId", ""), "selectedFileId": selected_file.file_id},
                level="ERROR",
                expected=error_payload["expected"],
                actual=error_payload["actual"],
                error=error_payload,
            )
            return None, build_envelope("ERROR", error_payload, correlation_id=correlation_id)

        return selected_file, None

    async def handle_save_deepseek_response_json(self, message: dict, correlation_id: str) -> dict:
        payload = message.get("payload", {}) or {}
        selected_file, error_envelope = self._validate_selected_file(
            payload=payload,
            correlation_id=correlation_id,
            failed_event="python_gateway.deepseek_response_json.save_failed",
            failed_state="deepseek_response_json_save_failed",
        )
        if error_envelope:
            return error_envelope

        assert selected_file is not None
        self.logger.emit(
            event="python_gateway.deepseek_response_json.save_requested",
            correlation_id=correlation_id,
            component="python_gateway",
            state="deepseek_response_json_save_requested",
            details={
                "fileId": selected_file.file_id,
                "selectedFileName": selected_file.name,
                "selectedFileExtension": selected_file.extension,
                "responseTextLength": len(str((payload.get("response") or {}).get("text") or "")),
                "workflowId": payload.get("workflowId", ""),
            },
        )

        try:
            save_result = write_deepseek_response_json(selected_file, payload)
        except Exception as error:  # pragma: no cover - defensive integration branch
            code, error_message, expected, actual = self._split_error(
                str(error),
                "DEEPSEEK_RESPONSE_JSON_WRITE_FAILED",
                "The gateway could not write the DeepSeek response JSON file.",
                "Gateway should write a UTF-8 JSON file beside the selected Excel file.",
                str(error),
            )
            error_payload = build_error_payload(code, error_message, expected=expected, actual=actual)
            self.logger.emit(
                event="python_gateway.deepseek_response_json.save_failed",
                correlation_id=correlation_id,
                component="python_gateway",
                state="deepseek_response_json_save_failed",
                details={
                    "fileId": selected_file.file_id,
                    "selectedFileName": selected_file.name,
                    "selectedFileExtension": selected_file.extension,
                },
                level="ERROR",
                expected=expected,
                actual=actual,
                error=error_payload,
            )
            return build_envelope("ERROR", error_payload, correlation_id=correlation_id)

        self.logger.emit(
            event="python_gateway.deepseek_response_json.save_completed",
            correlation_id=correlation_id,
            component="python_gateway",
            state="deepseek_response_json_save_completed",
            details={
                "fileId": selected_file.file_id,
                "selectedFileName": selected_file.name,
                "selectedFileExtension": selected_file.extension,
                "outputFileName": save_result["fileName"],
                "bytesWritten": save_result["bytesWritten"],
                "responseTextLength": len(str((payload.get("response") or {}).get("text") or "")),
            },
        )
        return build_envelope("DEEPSEEK_RESPONSE_JSON_SAVED", save_result, correlation_id=correlation_id)

    async def handle_save_deepseek_workflow_run_json(self, message: dict, correlation_id: str) -> dict:
        payload = message.get("payload", {}) or {}
        selected_file, error_envelope = self._validate_selected_file(
            payload=payload,
            correlation_id=correlation_id,
            failed_event="python_gateway.deepseek_workflow_run_json.save_failed",
            failed_state="deepseek_workflow_run_json_save_failed",
        )
        if error_envelope:
            return error_envelope

        assert selected_file is not None
        self.logger.emit(
            event="python_gateway.deepseek_workflow_run_json.save_requested",
            correlation_id=correlation_id,
            component="python_gateway",
            state="deepseek_workflow_run_json_save_requested",
            details={
                "fileId": selected_file.file_id,
                "selectedFileName": selected_file.name,
                "selectedFileExtension": selected_file.extension,
                "workflowStatus": str((payload.get("workflowRun") or {}).get("status") or ""),
                "workflowId": payload.get("workflowId", ""),
            },
        )

        try:
            save_result = write_deepseek_workflow_run_json(selected_file, payload)
        except Exception as error:  # pragma: no cover - defensive integration branch
            code, error_message, expected, actual = self._split_error(
                str(error),
                "DEEPSEEK_WORKFLOW_RUN_JSON_WRITE_FAILED",
                "The gateway could not write the DeepSeek workflow run JSON file.",
                "Gateway should write a UTF-8 JSON file beside the selected Excel file.",
                str(error),
            )
            error_payload = build_error_payload(code, error_message, expected=expected, actual=actual)
            self.logger.emit(
                event="python_gateway.deepseek_workflow_run_json.save_failed",
                correlation_id=correlation_id,
                component="python_gateway",
                state="deepseek_workflow_run_json_save_failed",
                details={
                    "fileId": selected_file.file_id,
                    "selectedFileName": selected_file.name,
                    "selectedFileExtension": selected_file.extension,
                },
                level="ERROR",
                expected=expected,
                actual=actual,
                error=error_payload,
            )
            return build_envelope("ERROR", error_payload, correlation_id=correlation_id)

        self.logger.emit(
            event="python_gateway.deepseek_workflow_run_json.save_completed",
            correlation_id=correlation_id,
            component="python_gateway",
            state="deepseek_workflow_run_json_save_completed",
            details={
                "fileId": selected_file.file_id,
                "selectedFileName": selected_file.name,
                "selectedFileExtension": selected_file.extension,
                "outputFileName": save_result["fileName"],
                "bytesWritten": save_result["bytesWritten"],
                "workflowStatus": str((payload.get("workflowRun") or {}).get("status") or ""),
            },
        )
        return build_envelope("DEEPSEEK_WORKFLOW_RUN_JSON_SAVED", save_result, correlation_id=correlation_id)

    async def handle_save_deepseek_workflow_ahk_file(self, message: dict, correlation_id: str) -> dict:
        payload = message.get("payload", {}) or {}
        selected_file, error_envelope = self._validate_selected_file(
            payload=payload,
            correlation_id=correlation_id,
            failed_event="python_gateway.deepseek_workflow_ahk_file.save_failed",
            failed_state="deepseek_workflow_ahk_file_save_failed",
        )
        if error_envelope:
            return error_envelope

        assert selected_file is not None
        self.logger.emit(
            event="python_gateway.deepseek_workflow_ahk_file.save_requested",
            correlation_id=correlation_id,
            component="python_gateway",
            state="deepseek_workflow_ahk_file_save_requested",
            details={
                "fileId": selected_file.file_id,
                "selectedFileName": selected_file.name,
                "selectedFileExtension": selected_file.extension,
                "workflowStatus": str((payload.get("workflowRun") or {}).get("status") or ""),
                "workflowId": payload.get("workflowId", ""),
            },
        )

        try:
            save_result = write_deepseek_workflow_ahk_file(selected_file, payload)
        except Exception as error:  # pragma: no cover - defensive integration branch
            code, error_message, expected, actual = self._split_error(
                str(error),
                "DEEPSEEK_WORKFLOW_AHK_FILE_WRITE_FAILED",
                "The gateway could not write the DeepSeek workflow AHK file.",
                "Gateway should write a UTF-8 AHK file beside the selected Excel file.",
                str(error),
            )
            error_payload = build_error_payload(code, error_message, expected=expected, actual=actual)
            self.logger.emit(
                event="python_gateway.deepseek_workflow_ahk_file.save_failed",
                correlation_id=correlation_id,
                component="python_gateway",
                state="deepseek_workflow_ahk_file_save_failed",
                details={
                    "fileId": selected_file.file_id,
                    "selectedFileName": selected_file.name,
                    "selectedFileExtension": selected_file.extension,
                },
                level="ERROR",
                expected=expected,
                actual=actual,
                error=error_payload,
            )
            return build_envelope("ERROR", error_payload, correlation_id=correlation_id)

        self.logger.emit(
            event="python_gateway.deepseek_workflow_ahk_file.save_completed",
            correlation_id=correlation_id,
            component="python_gateway",
            state="deepseek_workflow_ahk_file_save_completed",
            details={
                "fileId": selected_file.file_id,
                "selectedFileName": selected_file.name,
                "selectedFileExtension": selected_file.extension,
                "outputFileName": save_result["fileName"],
                "bytesWritten": save_result["bytesWritten"],
                "workflowStatus": str((payload.get("workflowRun") or {}).get("status") or ""),
            },
        )
        return build_envelope("DEEPSEEK_WORKFLOW_AHK_FILE_SAVED", save_result, correlation_id=correlation_id)
