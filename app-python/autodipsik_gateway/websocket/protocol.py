from __future__ import annotations

import json


ALLOWED_MESSAGE_TYPES = {
    "HELLO",
    "PING",
    "FILE_PICKER_OPEN_REQUEST",
    "FILE_PICKER_OPEN_MULTIPLE_REQUEST",
    "FILE_CONTENT_REQUEST",
    "FILE_CONTENT_BY_PATH_REQUEST",
    "FILE_SELECT_BY_ID_REQUEST",
    "SAVE_DEEPSEEK_RESPONSE_JSON",
    "SAVE_DEEPSEEK_WORKFLOW_RUN_JSON",
    "SAVE_DEEPSEEK_WORKFLOW_AHK_FILE",
}


def parse_message(raw_message: str) -> dict:
    data = json.loads(raw_message)
    if "type" not in data:
        raise ValueError("Missing message type.")
    if data["type"] not in ALLOWED_MESSAGE_TYPES:
        raise ValueError(f"Unsupported message type: {data['type']}")
    if not data.get("id"):
        raise ValueError("Missing message id.")
    return data
