# Real-time (WebSocket) — running locally

The app is ASGI (Django Channels). To serve WebSockets you must run an ASGI
server, not plain WSGI:

    # dev (Channels' daphne, via runserver — "daphne" is first in INSTALLED_APPS)
    python manage.py runserver

    # or explicitly with daphne
    daphne config.asgi:application

Requires Redis running (the production channel layer). Install deps with:

    CBOR2_BUILD_C_EXTENSION=0 pip install -r requirements.txt

(cbor2 is pinned to 5.6.5 and built pure-Python; cbor2 >= 5.7 needs a Rust
toolchain with no Python 3.14 wheel.)

WebSocket endpoint: `ws/environments/<env_id>/`. Authenticate by sending the
JWT access token as the second WebSocket subprotocol: `["jwt", "<token>"]`.
Under pytest the channel layer is in-memory, so tests need no Redis.
