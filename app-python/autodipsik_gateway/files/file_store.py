from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def to_utc_iso(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


@dataclass
class StoredFile:
    file_id: str
    path: Path
    name: str
    extension: str
    size_bytes: int
    last_modified: str

    def to_public_payload(self) -> dict:
        return {
            "fileId": self.file_id,
            "name": self.name,
            "extension": self.extension,
            "sizeBytes": self.size_bytes,
            "lastModified": self.last_modified,
        }


class FileStore:
    def __init__(self) -> None:
        self._selected_file: StoredFile | None = None
        self._selected_files: list[StoredFile] = []

    @staticmethod
    def _build_stored_file(path: Path) -> StoredFile:
        stat = path.stat()
        return StoredFile(
            file_id=str(uuid4()),
            path=path,
            name=path.name,
            extension=path.suffix.lower(),
            size_bytes=stat.st_size,
            last_modified=to_utc_iso(stat.st_mtime),
        )

    def set_selected_path(self, path: Path) -> StoredFile:
        stored = self._build_stored_file(path)
        self._selected_files = [stored]
        self._selected_file = stored
        return stored

    def set_selected_paths(self, paths: list[Path]) -> list[StoredFile]:
        if not paths:
            self._selected_files = []
            self._selected_file = None
            raise ValueError("No files were provided for selection.")

        stored_files = [self._build_stored_file(path) for path in paths]
        self._selected_files = stored_files
        self._selected_file = stored_files[0]
        return list(stored_files)

    def get_selected_file(self) -> StoredFile | None:
        return self._selected_file

    def get_selected_files(self) -> list[StoredFile]:
        return list(self._selected_files)

    def get_file_by_id(self, file_id: str) -> StoredFile | None:
        for stored in self._selected_files:
            if stored.file_id == file_id:
                return stored
        return None

    def set_active_file_id(self, file_id: str) -> StoredFile:
        stored = self.get_file_by_id(file_id)
        if not stored:
            raise ValueError(f"Unknown selected file id: {file_id}")
        self._selected_file = stored
        return stored

    def get_selected_file_or_raise(self) -> StoredFile:
        if not self._selected_file:
            raise ValueError("No file has been selected.")
        return self._selected_file
