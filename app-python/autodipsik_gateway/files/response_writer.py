from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from autodipsik_gateway.files.file_store import StoredFile


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def sanitize_filename_stem(value: str) -> str:
    normalized = re.sub(r"[<>:\"/\\|?*\x00-\x1f]+", " ", str(value or ""))
    normalized = re.sub(r"\s+", " ", normalized).strip().rstrip(".")
    return normalized or "deepseek-response"


def build_timestamp_fragment(timestamp: datetime) -> str:
    return timestamp.astimezone(timezone.utc).strftime("%Y%m%d-%H%M%S")


def build_output_path(selected_file: StoredFile, timestamp: datetime) -> Path:
    base_stem = sanitize_filename_stem(selected_file.path.stem)
    timestamp_fragment = build_timestamp_fragment(timestamp)
    output_dir = selected_file.path.parent
    base_name = f"{base_stem}.deepseek-response.{timestamp_fragment}"
    candidate = output_dir / f"{base_name}.json"
    suffix = 2
    while candidate.exists():
        candidate = output_dir / f"{base_name}.{suffix}.json"
        suffix += 1
    return candidate


def build_workflow_run_output_path(selected_file: StoredFile, timestamp: datetime) -> Path:
    base_stem = sanitize_filename_stem(selected_file.path.stem)
    timestamp_fragment = build_timestamp_fragment(timestamp)
    output_dir = selected_file.path.parent
    base_name = f"{base_stem}.deepseek-workflow-run.{timestamp_fragment}"
    candidate = output_dir / f"{base_name}.json"
    suffix = 2
    while candidate.exists():
        candidate = output_dir / f"{base_name}.{suffix}.json"
        suffix += 1
    return candidate


def build_output_payload(selected_file: StoredFile, payload: dict, timestamp: datetime) -> dict:
    response = payload["response"]
    return {
        "schemaVersion": 1,
        "source": "deepseek",
        "capturedAt": response["capturedAt"],
        "url": response.get("url", ""),
        "title": response.get("title", ""),
        "traceId": payload.get("traceId", ""),
        "workflowId": payload.get("workflowId", ""),
        "sourceFile": {
            "fileId": selected_file.file_id,
            "name": selected_file.name,
            "extension": selected_file.extension,
            "sizeBytes": selected_file.size_bytes,
        },
        "capture": {
            "selectorUsed": response.get("selectorUsed", ""),
            "selectedMessageIndex": response.get("selectedMessageIndex", -1),
            "text": response["text"],
            "textLength": response["textLength"],
            "stabilityMs": response.get("stabilityMs", 0),
            "pollIntervalMs": response.get("pollIntervalMs", 0),
            "elapsedMs": response.get("elapsedMs", 0),
            "completionSignals": response.get("completionSignals", {}),
        },
        "savedAt": timestamp.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
    }


def normalize_collection(value: object) -> list:
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return list(value.values())
    return []


def build_workflow_run_output_payload(selected_file: StoredFile, payload: dict, timestamp: datetime) -> dict:
    workflow_run = payload["workflowRun"]
    definition_summary = payload.get("definitionSummary") or {}
    return {
        "schemaVersion": 2,
        "source": "deepseek",
        "workflowType": "conditional_prompt_flow",
        "savedAt": timestamp.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "traceId": payload.get("traceId", ""),
        "workflowId": payload.get("workflowId", ""),
        "sourceFile": {
            "fileId": selected_file.file_id,
            "name": selected_file.name,
            "extension": selected_file.extension,
            "sizeBytes": selected_file.size_bytes,
        },
        "definitionSummary": {
            "flowVersion": definition_summary.get("flowVersion", 0),
            "startNodeId": definition_summary.get("startNodeId", ""),
            "nodeCount": definition_summary.get("nodeCount", 0),
        },
        "execution": {
            "status": workflow_run.get("status", ""),
            "visitedNodeIds": workflow_run.get("visitedNodeIds", []),
            "variables": workflow_run.get("variables", {}),
            "turns": normalize_collection(workflow_run.get("turns")),
            "extractions": normalize_collection(workflow_run.get("extractions")),
            "decisions": normalize_collection(workflow_run.get("decisions")),
            "finalNodeId": workflow_run.get("finalNodeId", ""),
            "error": workflow_run.get("error"),
        },
    }


def write_deepseek_response_json(
    selected_file: StoredFile,
    payload: dict,
    output_clock: Callable[[], datetime] | None = None,
) -> dict:
    response = payload.get("response") or {}
    text = str(response.get("text") or "")
    if not text.strip():
        raise ValueError("DEEPSEEK_CAPTURED_RESPONSE_EMPTY|Captured response text should be non-empty.|Captured response text should be non-empty.|response.text was empty or missing.")

    if payload.get("fileId") != selected_file.file_id:
        raise ValueError("GATEWAY_SELECTED_FILE_MISMATCH|Selected file id mismatch.|Payload fileId should match FileStore selected fileId.|Payload fileId did not match selected fileId.")

    clock = output_clock or utc_now
    timestamp = clock()
    output_path = build_output_path(selected_file, timestamp)
    output_payload = build_output_payload(selected_file, payload, timestamp)
    output_text = json.dumps(output_payload, ensure_ascii=False, indent=2)
    output_path.write_text(output_text, encoding="utf-8")

    return {
        "status": "completed",
        "outputPath": str(output_path),
        "fileName": output_path.name,
        "bytesWritten": len(output_text.encode("utf-8")),
    }


def write_deepseek_workflow_run_json(
    selected_file: StoredFile,
    payload: dict,
    output_clock: Callable[[], datetime] | None = None,
) -> dict:
    workflow_run = payload.get("workflowRun") or {}
    if not isinstance(workflow_run, dict):
        raise ValueError("DEEPSEEK_WORKFLOW_RUN_MISSING|Workflow run payload should be present.|workflowRun should be a structured object.|workflowRun was missing or invalid.")

    if payload.get("fileId") != selected_file.file_id:
        raise ValueError("GATEWAY_SELECTED_FILE_MISMATCH|Selected file id mismatch.|Payload fileId should match FileStore selected fileId.|Payload fileId did not match selected fileId.")

    if not str(payload.get("traceId") or "").strip():
        raise ValueError("TRACE_ID_REQUIRED|Trace id is required.|payload.traceId should be a non-empty string.|traceId was empty or missing.")

    if not str(payload.get("workflowId") or "").strip():
        raise ValueError("WORKFLOW_ID_REQUIRED|Workflow id is required.|payload.workflowId should be a non-empty string.|workflowId was empty or missing.")

    clock = output_clock or utc_now
    timestamp = clock()
    output_path = build_workflow_run_output_path(selected_file, timestamp)
    output_payload = build_workflow_run_output_payload(selected_file, payload, timestamp)
    output_text = json.dumps(output_payload, ensure_ascii=False, indent=2)
    output_path.write_text(output_text, encoding="utf-8")

    return {
        "status": "completed",
        "outputPath": str(output_path),
        "fileName": output_path.name,
        "bytesWritten": len(output_text.encode("utf-8")),
    }
