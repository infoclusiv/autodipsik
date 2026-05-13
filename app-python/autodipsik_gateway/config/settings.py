from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    host: str = "127.0.0.1"
    port: int = 8765
    max_file_size_mb: int = 25
    allowed_extensions: tuple[str, ...] = (".xlsx", ".xls", ".csv")
    enable_native_file_picker: bool = True
    log_level: str = "INFO"
    app_name: str = "autodipsik-python-gateway"
    app_version: str = "0.1.0"

    @property
    def max_file_size_bytes(self) -> int:
      return self.max_file_size_mb * 1024 * 1024

    @property
    def runtime_dir(self) -> Path:
      return Path(__file__).resolve().parents[3] / "runtime"


def get_settings() -> Settings:
    return Settings()
