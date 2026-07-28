import logging

import requests

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_push(tokens, title, body, data=None):
    """Best-effort Expo push. Returns True on a 2xx POST, False otherwise. Never raises."""
    if not tokens:
        return False
    messages = [{"to": token, "title": title, "body": body, "data": data or {}} for token in tokens]
    try:
        response = requests.post(
            EXPO_PUSH_URL,
            json=messages,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            timeout=10,
        )
    except requests.RequestException:
        logger.warning("Expo push request failed", exc_info=True)
        return False
    if not 200 <= response.status_code < 300:
        logger.warning("Expo push returned %s", response.status_code)
        return False
    return True
