from __future__ import annotations

from pathlib import Path

from autodipsik_gateway.config import Settings
from autodipsik_gateway.contracts import build_envelope
from autodipsik_gateway.files.file_picker import open_file_picker
from autodipsik_gateway.files.response_writer import (
    write_deepseek_response_json,
    write_deepseek_workflow_ahk_file,
    write_deepseek_workflow_run_json,
)
from autodipsik_gateway.files.file_store import FileStore
from autodipsik_gateway.files.serializers import serialize_file_to_base64
from autodipsik_gateway.files.validators import validate_file
from autodipsik_gateway.observability import JsonlLogger
from autodipsik_gateway.websocket.errors import build_error_payload


class GatewayHandlers:
    def __init__(self, settings: Settings, file_store: FileStore, logger: JsonlLogger) -> None:
        self.settings = settings
        self.file_store = file_store
        self.logger = logger

    def _validate_or_raise(self, path: Path) -> None:
        validation = validate_file(
            path,
            allowed_extensions=self.settings.allowed_extensions,
            max_file_size_bytes=self.settings.max_file_size_bytes,
        )
        if not validation.valid:
            raise ValueError(validation.code + "|" + validation.message + "|" + validation.expected + "|" + validation.actual)

    @staticmethod
    def _split_error(value: str, default_code: str, default_message: str, default_expected: str, default_actual: str) -> tuple[str, str, str, str]:
        parts = str(value or "").split("|", 3)
        if len(parts) == 4:
            return parts[0], parts[1], parts[2], parts[3]
        return default_code, default_message, default_expected, default_actual

    async def handle(self, message: dict) -> dict:
        message_type = message["type"]
        correlation_id = message.get("id", "")

        if message_type == "HELLO":
            self.logger.emit(
                event="python_gateway.websocket.client_connected",
                correlation_id=correlation_id,
                component="python_gateway",
                state="connected",
                details={"client": message.get("payload", {}).get("client", "")},
            )
            return build_envelope(
                "HELLO_ACK",
                {
                    "server": self.settings.app_name,
                    "serverVersion": self.settings.app_version,
                    "protocolVersion": 1,
                    "capabilities": ["file_picker", "file_read", "diagnostics"],
                },
                correlation_id=correlation_id,
            )

        if message_type == "PING":
            return build_envelope(
                "PONG",
                {
                    "sentAt": message.get("payload", {}).get("sentAt", ""),
                    "receivedAt": message.get("timestamp", ""),
                },
                correlation_id=correlation_id,
            )

        if message_type == "FILE_PICKER_OPEN_REQUEST":
            self.logger.emit(
                event="python_gateway.file_picker.open_requested",
                correlation_id=correlation_id,
                component="python_gateway",
                state="file_picker_open_requested",
                details=message.get("payload", {}),
            )
            picker_result = open_file_picker(
                self.settings.allowed_extensions,
                message.get("payload", {}).get("dialogTitle", "Select Excel file"),
            )
            if not picker_result.selected or not picker_result.path:
                return build_envelope(
                    "ERROR",
                    build_error_payload(
                        "FILE_PICKER_CANCELLED",
                        "File picker was cancelled.",
                        expected="The user should select an Excel file.",
                        actual="The dialog was closed without a file.",
                    ),
                    correlation_id=correlation_id,
                )

            path = picker_result.path
            self._validate_or_raise(path)
            stored = self.file_store.set_selected_path(path)
            self.logger.emit(
                event="python_gateway.file_selected",
                correlation_id=correlation_id,
                component="python_gateway",
                state="file_selected",
                details=stored.to_public_payload(),
            )
            return build_envelope("FILE_SELECTED", stored.to_public_payload(), correlation_id=correlation_id)

        if message_type == "FILE_CONTENT_REQUEST":
            stored = self.file_store.get_selected_file_or_raise()
            if stored.file_id != message.get("payload", {}).get("fileId"):
                return build_envelope(
                    "ERROR",
                    build_error_payload(
                        "FILE_NOT_SELECTED",
                        "The requested file id does not match the current selection.",
                        expected=stored.file_id,
                        actual=str(message.get("payload", {}).get("fileId")),
                    ),
                    correlation_id=correlation_id,
                )

            self._validate_or_raise(stored.path)
            payload = serialize_file_to_base64(stored.path)
            payload["fileId"] = stored.file_id
            self.logger.emit(
                event="python_gateway.file_serialized",
                correlation_id=correlation_id,
                component="python_gateway",
                state="file_serialized",
                details={"name": stored.name, "sizeBytes": payload["sizeBytes"]},
            )
            return build_envelope("FILE_CONTENT_RESPONSE", payload, correlation_id=correlation_id)

        if message_type == "FILE_CONTENT_BY_PATH_REQUEST":
            raw_path = message.get("payload", {}).get("path", "")
            path = Path(raw_path).expanduser()
            self._validate_or_raise(path)
            payload = serialize_file_to_base64(path)
            self.logger.emit(
                event="python_gateway.file_serialized_by_path",
                correlation_id=correlation_id,
                component="python_gateway",
                state="file_serialized_by_path",
                details={"name": path.name, "sizeBytes": payload["sizeBytes"]},
            )
            return build_envelope("FILE_CONTENT_RESPONSE", payload, correlation_id=correlation_id)

        if message_type == "SAVE_DEEPSEEK_RESPONSE_JSON":
            payload = message.get("payload", {}) or {}
            selected_file = self.file_store.get_selected_file()
            if not selected_file:
                error_payload = build_error_payload(
                    "GATEWAY_FILE_NOT_SELECTED",
                    "No selected file is available in FileStore.",
                    expected="A selected Excel file should exist in FileStore.",
                    actual="FileStore has no selected file.",
                )
                self.logger.emit(
                    event="python_gateway.deepseek_response_json.save_failed",
                    correlation_id=correlation_id,
                    component="python_gateway",
                    state="deepseek_response_json_save_failed",
                    details={"fileId": payload.get("fileId", "")},
                    level="ERROR",
                    expected=error_payload["expected"],
                    actual=error_payload["actual"],
                    error=error_payload,
                )
                return build_envelope("ERROR", error_payload, correlation_id=correlation_id)

            if payload.get("fileId") != selected_file.file_id:
                error_payload = build_error_payload(
                    "GATEWAY_SELECTED_FILE_MISMATCH",
                    "The payload file id did not match the currently selected file.",
                    expected="Payload fileId should match FileStore selected fileId.",
                    actual="Payload fileId did not match selected fileId.",
                )
                self.logger.emit(
                    event="python_gateway.deepseek_response_json.save_failed",
                    correlation_id=correlation_id,
                    component="python_gateway",
                    state="deepseek_response_json_save_failed",
                    details={"fileId": payload.get("fileId", ""), "selectedFileId": selected_file.file_id},
                    level="ERROR",
                    expected=error_payload["expected"],
                    actual=error_payload["actual"],
                    error=error_payload,
                )
                return build_envelope("ERROR", error_payload, correlation_id=correlation_id)

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

        if message_type == "SAVE_DEEPSEEK_WORKFLOW_RUN_JSON":
            payload = message.get("payload", {}) or {}
            selected_file = self.file_store.get_selected_file()
            if not selected_file:
              error_payload = build_error_payload(
                  "GATEWAY_FILE_NOT_SELECTED",
                  "No selected file is available in FileStore.",
                  expected="A selected Excel file should exist in FileStore.",
                  actual="FileStore has no selected file.",
              )
              self.logger.emit(
                  event="python_gateway.deepseek_workflow_run_json.save_failed",
                  correlation_id=correlation_id,
                  component="python_gateway",
                  state="deepseek_workflow_run_json_save_failed",
                  details={"fileId": payload.get("fileId", "")},
                  level="ERROR",
                  expected=error_payload["expected"],
                  actual=error_payload["actual"],
                  error=error_payload,
              )
              return build_envelope("ERROR", error_payload, correlation_id=correlation_id)

            if payload.get("fileId") != selected_file.file_id:
                error_payload = build_error_payload(
                    "GATEWAY_SELECTED_FILE_MISMATCH",
                    "The payload file id did not match the currently selected file.",
                    expected="Payload fileId should match FileStore selected fileId.",
                    actual="Payload fileId did not match selected fileId.",
                )
                self.logger.emit(
                    event="python_gateway.deepseek_workflow_run_json.save_failed",
                    correlation_id=correlation_id,
                    component="python_gateway",
                    state="deepseek_workflow_run_json_save_failed",
                    details={"fileId": payload.get("fileId", ""), "selectedFileId": selected_file.file_id},
                    level="ERROR",
                    expected=error_payload["expected"],
                    actual=error_payload["actual"],
                    error=error_payload,
                )
                return build_envelope("ERROR", error_payload, correlation_id=correlation_id)

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

        if message_type == "SAVE_DEEPSEEK_WORKFLOW_AHK_FILE":
            payload = message.get("payload", {}) or {}
            selected_file = self.file_store.get_selected_file()
            if not selected_file:
                error_payload = build_error_payload(
                    "GATEWAY_FILE_NOT_SELECTED",
                    "No selected file is available in FileStore.",
                    expected="A selected Excel file should exist in FileStore.",
                    actual="FileStore has no selected file.",
                )
                self.logger.emit(
                    event="python_gateway.deepseek_workflow_ahk_file.save_failed",
                    correlation_id=correlation_id,
                    component="python_gateway",
                    state="deepseek_workflow_ahk_file_save_failed",
                    details={"fileId": payload.get("fileId", "")},
                    level="ERROR",
                    expected=error_payload["expected"],
                    actual=error_payload["actual"],
                    error=error_payload,
                )
                return build_envelope("ERROR", error_payload, correlation_id=correlation_id)

            if payload.get("fileId") != selected_file.file_id:
                error_payload = build_error_payload(
                    "GATEWAY_SELECTED_FILE_MISMATCH",
                    "The payload file id did not match the currently selected file.",
                    expected="Payload fileId should match FileStore selected fileId.",
                    actual="Payload fileId did not match selected fileId.",
                )
                self.logger.emit(
                    event="python_gateway.deepseek_workflow_ahk_file.save_failed",
                    correlation_id=correlation_id,
                    component="python_gateway",
                    state="deepseek_workflow_ahk_file_save_failed",
                    details={"fileId": payload.get("fileId", ""), "selectedFileId": selected_file.file_id},
                    level="ERROR",
                    expected=error_payload["expected"],
                    actual=error_payload["actual"],
                    error=error_payload,
                )
                return build_envelope("ERROR", error_payload, correlation_id=correlation_id)

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

        return build_envelope(
            "ERROR",
            build_error_payload("UNKNOWN_ERROR", "Unhandled message type."),
            correlation_id=correlation_id,
        )
