from autodipsik_gateway.websocket.protocol import parse_message


def test_valid_hello_message_passes() -> None:
    message = parse_message('{"id":"1","type":"HELLO","payload":{}}')
    assert message["type"] == "HELLO"


def test_invalid_message_type_fails() -> None:
    try:
        parse_message('{"id":"1","type":"BAD","payload":{}}')
        assert False
    except ValueError:
        assert True


def test_missing_id_fails() -> None:
    try:
        parse_message('{"type":"HELLO","payload":{}}')
        assert False
    except ValueError:
        assert True


def test_file_content_by_path_message_passes() -> None:
    message = parse_message('{"id":"2","type":"FILE_CONTENT_BY_PATH_REQUEST","payload":{"path":"C:/tmp/sample.xlsx"}}')
    assert message["type"] == "FILE_CONTENT_BY_PATH_REQUEST"


def test_file_picker_open_multiple_message_passes() -> None:
    message = parse_message('{"id":"2b","type":"FILE_PICKER_OPEN_MULTIPLE_REQUEST","payload":{}}')
    assert message["type"] == "FILE_PICKER_OPEN_MULTIPLE_REQUEST"


def test_file_select_by_id_message_passes() -> None:
    message = parse_message('{"id":"2c","type":"FILE_SELECT_BY_ID_REQUEST","payload":{"fileId":"abc"}}')
    assert message["type"] == "FILE_SELECT_BY_ID_REQUEST"


def test_save_deepseek_response_json_message_passes() -> None:
    message = parse_message('{"id":"3","type":"SAVE_DEEPSEEK_RESPONSE_JSON","payload":{"fileId":"abc","traceId":"trace_1","response":{"text":"ok"}}}')
    assert message["type"] == "SAVE_DEEPSEEK_RESPONSE_JSON"


def test_save_deepseek_workflow_run_json_message_passes() -> None:
    message = parse_message('{"id":"4","type":"SAVE_DEEPSEEK_WORKFLOW_RUN_JSON","payload":{"fileId":"abc","traceId":"trace_1","workflowId":"wf_1","workflowRun":{"status":"completed"}}}')
    assert message["type"] == "SAVE_DEEPSEEK_WORKFLOW_RUN_JSON"


def test_save_deepseek_workflow_ahk_file_message_passes() -> None:
    message = parse_message('{"id":"5","type":"SAVE_DEEPSEEK_WORKFLOW_AHK_FILE","payload":{"fileId":"abc","traceId":"trace_1","workflowId":"wf_1","workflowRun":{"status":"completed"}}}')
    assert message["type"] == "SAVE_DEEPSEEK_WORKFLOW_AHK_FILE"
