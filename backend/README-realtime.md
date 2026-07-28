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

## Background jobs (Celery)

Push reminders and the maintenance sweeps run under Celery (Redis broker):

    celery -A config worker -l info
    celery -A config beat -l info

Beat schedules: reminders every minute, status refresh every 5 minutes,
materialization daily at 00:05. Under pytest, Celery runs eagerly (no worker
or broker needed). Devices register their Expo token via `POST /api/push-tokens/`.
