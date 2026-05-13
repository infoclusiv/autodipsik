from __future__ import annotations

import base64
import hashlib
import mimetypes
from pathlib import Path


EXPLICIT_MIME_TYPES = {
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".csv": "text/csv",
}


def detect_mime_type(path: Path) -> str:
    return EXPLICIT_MIME_TYPES.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def serialize_file_to_base64(path: Path) -> dict:
    content_bytes = path.read_bytes()
    sha256 = hashlib.sha256(content_bytes).hexdigest()
    return {
        "name": path.name,
        "mimeType": detect_mime_type(path),
        "sizeBytes": len(content_bytes),
        "encoding": "base64",
        "contentBase64": base64.b64encode(content_bytes).decode("ascii"),
        "sha256": sha256,
    }
