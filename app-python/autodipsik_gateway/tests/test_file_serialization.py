import base64
from pathlib import Path

from autodipsik_gateway.files.serializers import serialize_file_to_base64


def test_file_is_encoded_as_base64(tmp_path: Path) -> None:
    path = tmp_path / "sample.csv"
    path.write_bytes(b"a,b,c")
    payload = serialize_file_to_base64(path)
    assert base64.b64decode(payload["contentBase64"]) == b"a,b,c"


def test_mime_type_is_correct_for_xlsx(tmp_path: Path) -> None:
    path = tmp_path / "sample.xlsx"
    path.write_bytes(b"xlsx")
    payload = serialize_file_to_base64(path)
    assert payload["mimeType"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def test_sha256_is_generated(tmp_path: Path) -> None:
    path = tmp_path / "sample.csv"
    path.write_bytes(b"hello")
    payload = serialize_file_to_base64(path)
    assert len(payload["sha256"]) == 64
