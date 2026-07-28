import requests

from push.expo import EXPO_PUSH_URL, send_push


class _FakeResponse:
    def __init__(self, status_code):
        self.status_code = status_code


def test_send_push_posts_one_message_per_token(monkeypatch):
    captured = {}

    def fake_post(url, json, headers, timeout):
        captured["url"] = url
        captured["json"] = json
        return _FakeResponse(200)

    monkeypatch.setattr(requests, "post", fake_post)
    ok = send_push(["ExponentPushToken[a]", "ExponentPushToken[b]"], "T", "B", {"x": 1})
    assert ok is True
    assert captured["url"] == EXPO_PUSH_URL
    assert [m["to"] for m in captured["json"]] == [
        "ExponentPushToken[a]",
        "ExponentPushToken[b]",
    ]
    assert captured["json"][0]["title"] == "T"
    assert captured["json"][0]["body"] == "B"
    assert captured["json"][0]["data"] == {"x": 1}


def test_send_push_empty_tokens_is_noop():
    assert send_push([], "T", "B") is False


def test_send_push_swallows_errors(monkeypatch):
    def boom(*args, **kwargs):
        raise requests.RequestException("network down")

    monkeypatch.setattr(requests, "post", boom)
    assert send_push(["ExponentPushToken[a]"], "T", "B") is False
