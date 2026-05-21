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


def test_save_deepseek_response_json_message_passes() -> None:
    message = parse_message('{"id":"3","type":"SAVE_DEEPSEEK_RESPONSE_JSON","payload":{"fileId":"abc","traceId":"trace_1","response":{"text":"ok"}}}')
    assert message["type"] == "SAVE_DEEPSEEK_RESPONSE_JSON"
