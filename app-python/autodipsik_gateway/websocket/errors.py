from __future__ import annotations


def build_error_payload(code: str, message: str, *, expected: str = "", actual: str = "", recoverable: bool = True, suggested_fix: str = "") -> dict:
    return {
        "code": code,
        "message": message,
        "expected": expected,
        "actual": actual,
        "recoverable": recoverable,
        "suggestedFix": suggested_fix,
    }
