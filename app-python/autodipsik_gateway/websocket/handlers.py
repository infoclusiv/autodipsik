from __future__ import annotations

from autodipsik_gateway.config import Settings
from autodipsik_gateway.contracts import build_envelope
from autodipsik_gateway.files.file_store import FileStore
from autodipsik_gateway.observability import JsonlLogger
from autodipsik_gateway.websocket.errors import build_error_payload
from autodipsik_gateway.websocket.file_handlers import GatewayFileHandlers
from autodipsik_gateway.websocket.save_handlers import GatewaySaveHandlers


class GatewayHandlers:
    def __init__(self, settings: Settings, file_store: FileStore, logger: JsonlLogger) -> None:
        self.settings = settings
        self.file_store = file_store
        self.logger = logger
        self.file_handlers = GatewayFileHandlers(settings, file_store, logger)
        self.save_handlers = GatewaySaveHandlers(file_store, logger)

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
            return await self.file_handlers.handle_file_picker_open_request(message, correlation_id)

        if message_type == "FILE_PICKER_OPEN_MULTIPLE_REQUEST":
            return await self.file_handlers.handle_file_picker_open_multiple_request(message, correlation_id)

        if message_type == "FILE_SELECT_BY_ID_REQUEST":
            return await self.file_handlers.handle_file_select_by_id_request(message, correlation_id)

        if message_type == "FILE_CONTENT_REQUEST":
            return await self.file_handlers.handle_file_content_request(message, correlation_id)

        if message_type == "FILE_CONTENT_BY_PATH_REQUEST":
            return await self.file_handlers.handle_file_content_by_path_request(message, correlation_id)

        if message_type == "SAVE_DEEPSEEK_RESPONSE_JSON":
            return await self.save_handlers.handle_save_deepseek_response_json(message, correlation_id)

        if message_type == "SAVE_DEEPSEEK_WORKFLOW_RUN_JSON":
            return await self.save_handlers.handle_save_deepseek_workflow_run_json(message, correlation_id)

        if message_type == "SAVE_DEEPSEEK_WORKFLOW_AHK_FILE":
            return await self.save_handlers.handle_save_deepseek_workflow_ahk_file(message, correlation_id)

        return build_envelope(
            "ERROR",
            build_error_payload("UNKNOWN_ERROR", "Unhandled message type."),
            correlation_id=correlation_id,
        )
