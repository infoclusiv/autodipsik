from __future__ import annotations

import asyncio
import json
from pathlib import Path

from websockets.asyncio.server import serve

from autodipsik_gateway.config import Settings
from autodipsik_gateway.contracts import build_envelope
from autodipsik_gateway.files.file_store import FileStore
from autodipsik_gateway.observability import JsonlLogger
from autodipsik_gateway.websocket.errors import build_error_payload
from autodipsik_gateway.websocket.handlers import GatewayHandlers
from autodipsik_gateway.websocket.protocol import parse_message


async def run_server(settings: Settings) -> None:
    file_store = FileStore()
    logger = JsonlLogger(settings.runtime_dir)
    handlers = GatewayHandlers(settings, file_store, logger)

    async def handle_connection(websocket) -> None:
        async for raw_message in websocket:
            correlation_id = "unknown"
            try:
                message = parse_message(raw_message)
                correlation_id = message["id"]
                logger.emit(
                    event="python_gateway.websocket.message_received",
                    correlation_id=correlation_id,
                    component="python_gateway",
                    state="message_received",
                    details={"type": message["type"]},
                )
                response = await handlers.handle(message)
            except ValueError as error:
                parts = str(error).split("|")
                response = build_envelope(
                    "ERROR",
                    build_error_payload(
                        parts[0] if len(parts) > 1 else "UNKNOWN_ERROR",
                        parts[1] if len(parts) > 1 else str(error),
                        expected=parts[2] if len(parts) > 2 else "",
                        actual=parts[3] if len(parts) > 3 else str(error),
                    ),
                    correlation_id=correlation_id,
                )

            await websocket.send(json.dumps(response))
            logger.emit(
                event="python_gateway.websocket.message_sent",
                correlation_id=response.get("correlationId", response["id"]),
                component="python_gateway",
                state="message_sent",
                details={"type": response["type"]},
            )

    logger.emit(
        event="python_gateway.started",
        correlation_id="startup",
        component="python_gateway",
        state="started",
        details={"host": settings.host, "port": settings.port},
    )

    async with serve(handle_connection, settings.host, settings.port, max_size=None):
        print(f"Autodipsik Python Gateway running on ws://{settings.host}:{settings.port}")
        await asyncio.Future()
