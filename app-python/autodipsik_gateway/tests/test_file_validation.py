from pathlib import Path

from autodipsik_gateway.files.validators import validate_file


def test_xlsx_is_accepted(tmp_path: Path) -> None:
    path = tmp_path / "sample.xlsx"
    path.write_bytes(b"ok")
    result = validate_file(path, allowed_extensions=(".xlsx", ".xls", ".csv"), max_file_size_bytes=100)
    assert result.valid is True


def test_pdf_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "sample.pdf"
    path.write_bytes(b"bad")
    result = validate_file(path, allowed_extensions=(".xlsx", ".xls", ".csv"), max_file_size_bytes=100)
    assert result.valid is False
    assert result.code == "FILE_EXTENSION_NOT_ALLOWED"


def test_missing_file_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "missing.xlsx"
    result = validate_file(path, allowed_extensions=(".xlsx", ".xls", ".csv"), max_file_size_bytes=100)
    assert result.valid is False
    assert result.code == "FILE_NOT_FOUND"
