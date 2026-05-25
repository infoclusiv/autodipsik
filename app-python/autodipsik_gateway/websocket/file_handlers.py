from __future__ import annotations

from pathlib import Path

from autodipsik_gateway.config import Settings
from autodipsik_gateway.contracts import build_envelope
from autodipsik_gateway.files.file_picker import open_file_picker, open_multi_file_picker
from autodipsik_gateway.files.file_store import FileStore
from autodipsik_gateway.files.serializers import serialize_file_to_base64
from autodipsik_gateway.files.validators import validate_file
from autodipsik_gateway.observability import JsonlLogger
from autodipsik_gateway.websocket.errors import build_error_payload


class GatewayFileHandlers:
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

    async def handle_file_picker_open_request(self, message: dict, correlation_id: str) -> dict:
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

    async def handle_file_picker_open_multiple_request(self, message: dict, correlation_id: str) -> dict:
        self.logger.emit(
            event="python_gateway.file_picker.open_multiple_requested",
            correlation_id=correlation_id,
            component="python_gateway",
            state="file_picker_open_multiple_requested",
            details=message.get("payload", {}),
        )
        picker_result = open_multi_file_picker(
            self.settings.allowed_extensions,
            message.get("payload", {}).get("dialogTitle", "Select Excel files"),
        )
        if picker_result.error:
            return build_envelope(
                "ERROR",
                build_error_payload(
                    "FILE_PICKER_UNAVAILABLE",
                    "Multi-file picker is unavailable.",
                    expected="The gateway should be able to open a Tkinter multi-file picker.",
                    actual=picker_result.error,
                ),
                correlation_id=correlation_id,
            )

        if not picker_result.selected:
            return build_envelope(
                "ERROR",
                build_error_payload(
                    "FILE_PICKER_CANCELLED",
                    "File picker was cancelled.",
                    expected="The user should select one or more Excel files.",
                    actual="The dialog was closed without selecting files.",
                ),
                correlation_id=correlation_id,
            )

        if not picker_result.paths:
            return build_envelope(
                "ERROR",
                build_error_payload(
                    "FILE_PICKER_NO_FILES_SELECTED",
                    "No files were selected.",
                    expected="The user should select one or more Excel files.",
                    actual="The dialog completed without any selected file paths.",
                ),
                correlation_id=correlation_id,
            )

        for path in picker_result.paths:
            self._validate_or_raise(path)

        stored_files = self.file_store.set_selected_paths(picker_result.paths)
        active_file = self.file_store.get_selected_file_or_raise()
        files_payload = [stored.to_public_payload() for stored in stored_files]
        self.logger.emit(
            event="python_gateway.files_selected",
            correlation_id=correlation_id,
            component="python_gateway",
            state="files_selected",
            details={
                "count": len(files_payload),
                "activeFileId": active_file.file_id,
                "fileIds": [item["fileId"] for item in files_payload],
            },
        )
        return build_envelope(
            "FILES_SELECTED",
            {
                "files": files_payload,
                "selectedFile": active_file.to_public_payload(),
                "count": len(files_payload),
            },
            correlation_id=correlation_id,
        )

    async def handle_file_select_by_id_request(self, message: dict, correlation_id: str) -> dict:
        file_id = str(message.get("payload", {}).get("fileId") or "")
        if not file_id:
            return build_envelope(
                "ERROR",
                build_error_payload(
                    "FILE_ID_REQUIRED",
                    "A file id is required to activate a selected file.",
                    expected="payload.fileId should be a non-empty string.",
                    actual="payload.fileId was empty or missing.",
                ),
                correlation_id=correlation_id,
            )

        stored = self.file_store.get_file_by_id(file_id)
        if not stored:
            return build_envelope(
                "ERROR",
                build_error_payload(
                    "UNKNOWN_SELECTED_FILE_ID",
                    "The requested file id is not part of the current selected batch.",
                    expected="payload.fileId should match one of the selected gateway files.",
                    actual=file_id,
                ),
                correlation_id=correlation_id,
            )

        stored = self.file_store.set_active_file_id(file_id)
        self.logger.emit(
            event="python_gateway.file_activated",
            correlation_id=correlation_id,
            component="python_gateway",
            state="file_activated",
            details={
                "fileId": stored.file_id,
                "selectedFileCount": len(self.file_store.get_selected_files()),
            },
        )
        return build_envelope("FILE_SELECTED", stored.to_public_payload(), correlation_id=correlation_id)

    async def handle_file_content_request(self, message: dict, correlation_id: str) -> dict:
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

    async def handle_file_content_by_path_request(self, message: dict, correlation_id: str) -> dict:
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
