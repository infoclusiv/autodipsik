from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass
class ValidationResult:
    valid: bool
    code: str = ""
    message: str = ""
    expected: str = ""
    actual: str = ""


def validate_file(path: Path, *, allowed_extensions: tuple[str, ...], max_file_size_bytes: int) -> ValidationResult:
    if not path.exists():
        return ValidationResult(
            valid=False,
            code="FILE_NOT_FOUND",
            message="The selected file no longer exists.",
            expected="The file should exist at the selected location.",
            actual=f"Missing path: {path}",
        )

    extension = path.suffix.lower()
    if extension not in allowed_extensions:
        return ValidationResult(
            valid=False,
            code="FILE_EXTENSION_NOT_ALLOWED",
            message="The selected file type is not allowed.",
            expected=f"One of: {', '.join(allowed_extensions)}",
            actual=extension or "No extension",
        )

    size_bytes = path.stat().st_size
    if size_bytes > max_file_size_bytes:
        return ValidationResult(
            valid=False,
            code="FILE_TOO_LARGE",
            message="The selected file exceeds the maximum supported size.",
            expected=f"At most {max_file_size_bytes} bytes",
            actual=f"{size_bytes} bytes",
        )

    if not os.access(path, os.R_OK):
        return ValidationResult(
            valid=False,
            code="FILE_READ_FAILED",
            message="The selected file is not readable.",
            expected="The current user should have read access to the file.",
            actual="Read permission check failed.",
        )

    return ValidationResult(valid=True)
