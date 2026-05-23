from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from autodipsik_gateway.files.file_store import StoredFile
from autodipsik_gateway.files.response_writer import write_deepseek_response_json, write_deepseek_workflow_run_json


def build_selected_file(path: Path) -> StoredFile:
    return StoredFile(
        file_id="file-123",
        path=path,
        name=path.name,
        extension=path.suffix.lower(),
        size_bytes=path.stat().st_size,
        last_modified="2026-05-20T03:25:01.462Z",
    )


def build_payload(file_id: str = "file-123", text: str = "Respuesta final con tilde á") -> dict:
    return {
        "fileId": file_id,
        "traceId": "trace_123",
        "workflowId": "wf_123",
        "response": {
            "capturedAt": "2026-05-20T03:25:01.462Z",
            "url": "https://chat.deepseek.com/a/chat/s/test",
            "title": "Analisis semanal - DeepSeek",
            "selectorUsed": ".ds-markdown.ds-assistant-message-main-content",
            "selectedMessageIndex": 0,
            "text": text,
            "textLength": len(text),
            "stabilityMs": 3000,
            "pollIntervalMs": 250,
            "elapsedMs": 18420,
            "completionSignals": {
                "assistantMessageFound": True,
                "textStable": True,
                "composerDisabledObserved": True,
                "sendButtonDisabledObserved": True,
            },
        },
    }


def fixed_clock() -> datetime:
    return datetime(2026, 5, 20, 3, 25, 1, tzinfo=timezone.utc)


def build_workflow_run_payload(file_id: str = "file-123") -> dict:
    return {
        "fileId": file_id,
        "traceId": "trace_workflow_123",
        "workflowId": "mvp_tipo_flow",
        "definitionSummary": {
            "flowVersion": 1,
            "startNodeId": "prompt_1",
            "nodeCount": 7,
        },
        "workflowRun": {
            "status": "completed",
            "visitedNodeIds": ["prompt_1", "extract_tipo", "decision_tipo", "prompt_tipo_1", "end"],
            "variables": {"tipo": "tipo_1"},
            "turns": [
                {
                    "nodeId": "prompt_1",
                    "response": {
                        "text": "Result [[TIPO: tipo_1]]",
                        "textLength": 23,
                    },
                },
                {
                    "nodeId": "prompt_tipo_1",
                    "response": {
                        "text": "Final response",
                        "textLength": 14,
                    },
                },
            ],
            "extractions": {
                "extract_tipo": {
                    "nodeId": "extract_tipo",
                    "status": "matched",
                }
            },
            "decisions": {
                "decision_tipo": {
                    "nodeId": "decision_tipo",
                    "status": "matched",
                    "nextNodeId": "prompt_tipo_1",
                }
            },
            "finalNodeId": "end",
            "error": None,
        },
    }


def test_writes_json_beside_selected_excel(tmp_path: Path) -> None:
    excel_path = tmp_path / "Analisis comida.xlsx"
    excel_path.write_bytes(b"xlsx")
    result = write_deepseek_response_json(build_selected_file(excel_path), build_payload(), output_clock=fixed_clock)
    output_path = Path(result["outputPath"])
    assert output_path.parent == tmp_path
    assert output_path.name == "Analisis comida.deepseek-response.20260520-032501.json"
    data = json.loads(output_path.read_text(encoding="utf-8"))
    assert data["capture"]["text"] == "Respuesta final con tilde á"
    assert data["sourceFile"]["fileId"] == "file-123"


def test_duplicate_timestamp_suffixes_filename(tmp_path: Path) -> None:
    excel_path = tmp_path / "Analisis comida.xlsx"
    excel_path.write_bytes(b"xlsx")
    selected_file = build_selected_file(excel_path)
    write_deepseek_response_json(selected_file, build_payload(), output_clock=fixed_clock)
    second = write_deepseek_response_json(selected_file, build_payload(), output_clock=fixed_clock)
    assert second["fileName"] == "Analisis comida.deepseek-response.20260520-032501.2.json"


def test_rejects_empty_response_text(tmp_path: Path) -> None:
    excel_path = tmp_path / "Analisis comida.xlsx"
    excel_path.write_bytes(b"xlsx")
    try:
        write_deepseek_response_json(build_selected_file(excel_path), build_payload(text="   "), output_clock=fixed_clock)
        assert False
    except ValueError as error:
        assert str(error).startswith("DEEPSEEK_CAPTURED_RESPONSE_EMPTY|")


def test_rejects_mismatched_file_id(tmp_path: Path) -> None:
    excel_path = tmp_path / "Analisis comida.xlsx"
    excel_path.write_bytes(b"xlsx")
    try:
        write_deepseek_response_json(build_selected_file(excel_path), build_payload(file_id="other-file"), output_clock=fixed_clock)
        assert False
    except ValueError as error:
        assert str(error).startswith("GATEWAY_SELECTED_FILE_MISMATCH|")


def test_writes_workflow_run_json_beside_selected_excel(tmp_path: Path) -> None:
    excel_path = tmp_path / "Analisis comida.xlsx"
    excel_path.write_bytes(b"xlsx")
    result = write_deepseek_workflow_run_json(build_selected_file(excel_path), build_workflow_run_payload(), output_clock=fixed_clock)
    output_path = Path(result["outputPath"])
    assert output_path.parent == tmp_path
    assert output_path.name == "Analisis comida.deepseek-workflow-run.20260520-032501.json"
    data = json.loads(output_path.read_text(encoding="utf-8"))
    assert data["schemaVersion"] == 2
    assert data["workflowType"] == "conditional_prompt_flow"
    assert len(data["execution"]["turns"]) == 2
    assert data["execution"]["variables"]["tipo"] == "tipo_1"
    assert len(data["execution"]["decisions"]) == 1


def test_workflow_run_json_duplicate_timestamp_suffixes_filename(tmp_path: Path) -> None:
    excel_path = tmp_path / "Analisis comida.xlsx"
    excel_path.write_bytes(b"xlsx")
    selected_file = build_selected_file(excel_path)
    write_deepseek_workflow_run_json(selected_file, build_workflow_run_payload(), output_clock=fixed_clock)
    second = write_deepseek_workflow_run_json(selected_file, build_workflow_run_payload(), output_clock=fixed_clock)
    assert second["fileName"] == "Analisis comida.deepseek-workflow-run.20260520-032501.2.json"


def test_workflow_run_json_rejects_mismatched_file_id(tmp_path: Path) -> None:
    excel_path = tmp_path / "Analisis comida.xlsx"
    excel_path.write_bytes(b"xlsx")
    try:
        write_deepseek_workflow_run_json(build_selected_file(excel_path), build_workflow_run_payload(file_id="other-file"), output_clock=fixed_clock)
        assert False
    except ValueError as error:
        assert str(error).startswith("GATEWAY_SELECTED_FILE_MISMATCH|")
