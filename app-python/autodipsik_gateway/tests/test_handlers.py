from __future__ import annotations

import asyncio
from pathlib import Path

from autodipsik_gateway.files.file_picker import MultiFileSelectionResult
from autodipsik_gateway.config import Settings
from autodipsik_gateway.files.file_store import FileStore
from autodipsik_gateway.observability import JsonlLogger
from autodipsik_gateway.websocket.handlers import GatewayHandlers


def build_handlers(tmp_path: Path) -> tuple[GatewayHandlers, FileStore]:
    settings = Settings()
    file_store = FileStore()
    logger = JsonlLogger(tmp_path / "runtime")
    return GatewayHandlers(settings, file_store, logger), file_store


def build_ahk_message(file_id: str) -> dict:
    return {
        "id": "test_1",
        "type": "SAVE_DEEPSEEK_WORKFLOW_AHK_FILE",
        "payload": {
            "fileId": file_id,
            "traceId": "trace_test",
            "workflowId": "workflow_test",
            "workflowRun": {
                "status": "completed",
                "turns": [
                    {
                        "nodeId": "prompt_pregrado",
                        "response": {
                            "text": "<<<archivo ahk>>>\n#SingleInstance force\nSend, ABC{Tab}123\n<<</archivo ahk>>>"
                        },
                    }
                ],
            },
        },
    }


def test_save_deepseek_workflow_ahk_file_handler_writes_file(tmp_path: Path) -> None:
    handlers, file_store = build_handlers(tmp_path)
    excel_path = tmp_path / "student.xlsx"
    excel_path.write_bytes(b"xlsx")
    stored = file_store.set_selected_path(excel_path)

    response = asyncio.run(handlers.handle(build_ahk_message(stored.file_id)))

    output_path = tmp_path / "student.ahk"
    assert response["type"] == "DEEPSEEK_WORKFLOW_AHK_FILE_SAVED"
    assert output_path.exists()
    assert output_path.read_text(encoding="utf-8") == "#SingleInstance force\nSend, ABC{Tab}123"
    assert "<<<archivo ahk>>>" not in output_path.read_text(encoding="utf-8")
    assert response["payload"]["outputPath"] == str(output_path)


def test_save_deepseek_workflow_ahk_file_handler_rejects_missing_selected_file(tmp_path: Path) -> None:
    handlers, _ = build_handlers(tmp_path)
    response = asyncio.run(handlers.handle(build_ahk_message("missing-file")))
    assert response["type"] == "ERROR"
    assert response["payload"]["code"] == "GATEWAY_FILE_NOT_SELECTED"


def test_save_deepseek_workflow_ahk_file_handler_rejects_missing_tags(tmp_path: Path) -> None:
    handlers, file_store = build_handlers(tmp_path)
    excel_path = tmp_path / "student.xlsx"
    excel_path.write_bytes(b"xlsx")
    stored = file_store.set_selected_path(excel_path)
    message = build_ahk_message(stored.file_id)
    message["payload"]["workflowRun"]["turns"][0]["response"]["text"] = "respuesta sin etiquetas"

    response = asyncio.run(handlers.handle(message))

    assert response["type"] == "ERROR"
    assert response["payload"]["code"] == "AHK_CODE_TAGS_MISSING"


def test_multi_file_picker_selects_and_sets_first_active_file(tmp_path: Path, monkeypatch) -> None:
    handlers, file_store = build_handlers(tmp_path)
    first = tmp_path / "first.xlsx"
    second = tmp_path / "second.xlsx"
    first.write_bytes(b"xlsx")
    second.write_bytes(b"xlsx")

    def fake_open_multi_file_picker(*_args, **_kwargs) -> MultiFileSelectionResult:
        return MultiFileSelectionResult(selected=True, paths=[first, second])

    monkeypatch.setattr("autodipsik_gateway.websocket.file_handlers.open_multi_file_picker", fake_open_multi_file_picker)

    response = asyncio.run(
        handlers.handle({"id": "test_multi", "type": "FILE_PICKER_OPEN_MULTIPLE_REQUEST", "payload": {}})
    )

    assert response["type"] == "FILES_SELECTED"
    assert response["payload"]["count"] == 2
    assert [item["name"] for item in response["payload"]["files"]] == ["first.xlsx", "second.xlsx"]
    assert response["payload"]["selectedFile"]["fileId"] == file_store.get_selected_file().file_id
    assert len(file_store.get_selected_files()) == 2


def test_file_select_by_id_activates_existing_batch_file(tmp_path: Path) -> None:
    handlers, file_store = build_handlers(tmp_path)
    first = tmp_path / "first.xlsx"
    second = tmp_path / "second.xlsx"
    first.write_bytes(b"xlsx")
    second.write_bytes(b"xlsx")
    stored_files = file_store.set_selected_paths([first, second])

    response = asyncio.run(
        handlers.handle(
            {
                "id": "select_1",
                "type": "FILE_SELECT_BY_ID_REQUEST",
                "payload": {"fileId": stored_files[1].file_id},
            }
        )
    )

    assert response["type"] == "FILE_SELECTED"
    assert response["payload"]["fileId"] == stored_files[1].file_id
    assert file_store.get_selected_file().file_id == stored_files[1].file_id


def test_file_select_by_id_rejects_unknown_file_id(tmp_path: Path) -> None:
    handlers, file_store = build_handlers(tmp_path)
    excel_path = tmp_path / "first.xlsx"
    excel_path.write_bytes(b"xlsx")
    file_store.set_selected_path(excel_path)

    response = asyncio.run(
        handlers.handle(
            {
                "id": "select_missing",
                "type": "FILE_SELECT_BY_ID_REQUEST",
                "payload": {"fileId": "missing"},
            }
        )
    )

    assert response["type"] == "ERROR"
    assert response["payload"]["code"] == "UNKNOWN_SELECTED_FILE_ID"
