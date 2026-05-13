from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from uuid import uuid4


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


@dataclass
class MessageEnvelope:
    type: str
    payload: dict
    source: str = "python_gateway"
    version: int = 1
    id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: str = field(default_factory=utc_now_iso)
    correlationId: str | None = None

    def to_dict(self) -> dict:
        data = asdict(self)
        if not data["correlationId"]:
            data["correlationId"] = data["id"]
        return data


def build_envelope(message_type: str, payload: dict | None = None, *, correlation_id: str | None = None) -> dict:
    return MessageEnvelope(
        type=message_type,
        payload=payload or {},
        correlationId=correlation_id,
    ).to_dict()
