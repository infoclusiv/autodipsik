from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


@dataclass
class EventRecord:
    timestamp: str
    level: str
    event: str
    correlationId: str
    component: str
    workflow: str
    state: str
    details: dict[str, Any]
    expected: str | None = None
    actual: str | None = None
    error: dict[str, Any] | None = None


class JsonlLogger:
    def __init__(self, runtime_dir: Path) -> None:
        self.runtime_dir = runtime_dir
        self.runtime_dir.mkdir(parents=True, exist_ok=True)
        self.events_path = self.runtime_dir / "python-events.jsonl"

    def emit(
        self,
        *,
        event: str,
        correlation_id: str,
        component: str,
        state: str,
        details: dict[str, Any] | None = None,
        level: str = "INFO",
        expected: str | None = None,
        actual: str | None = None,
        error: dict[str, Any] | None = None,
    ) -> None:
        record = EventRecord(
            timestamp=utc_now_iso(),
            level=level,
            event=event,
            correlationId=correlation_id,
            component=component,
            workflow="deepseek_excel_upload",
            state=state,
            details=details or {},
            expected=expected,
            actual=actual,
            error=error,
        )
        with self.events_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(asdict(record), ensure_ascii=True) + "\n")
