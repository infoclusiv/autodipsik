from __future__ import annotations

import asyncio

from autodipsik_gateway.config import get_settings
from autodipsik_gateway.websocket import run_server


def main() -> None:
    settings = get_settings()
    asyncio.run(run_server(settings))
