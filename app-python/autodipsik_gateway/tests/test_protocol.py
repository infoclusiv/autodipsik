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
