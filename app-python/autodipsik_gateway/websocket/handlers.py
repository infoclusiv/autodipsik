from __future__ import annotations

from pathlib import Path

from autodipsik_gateway.config import Settings
from autodipsik_gateway.contracts import build_envelope
from autodipsik_gateway.files.file_picker import open_file_picker
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

        return build_envelope(
            "ERROR",
            build_error_payload("UNKNOWN_ERROR", "Unhandled message type."),
            correlation_id=correlation_id,
        )
