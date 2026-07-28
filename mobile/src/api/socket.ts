import { config } from "@/config";

export type SocketHandlers = {
  onMessage: (data: unknown) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

export type EnvironmentSocket = {
  close(): void;
};

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 15000;

/**
 * Opens a WebSocket connection to an environment's real-time channel,
 * authenticating via the `["jwt", accessToken]` subprotocol. The token is
 * read fresh via `getToken()` on every (re)connect so an expired captured
 * token isn't reused forever; if it resolves to null, the socket does not
 * open. Incoming messages are JSON-parsed and handed to `onMessage`
 * (malformed payloads are swallowed). If the connection drops and `close()`
 * was not called, it reconnects automatically with a capped exponential
 * backoff, reusing the same envId/getToken/handlers.
 */
export function createEnvironmentSocket(
  envId: string,
  getToken: () => Promise<string | null>,
  handlers: SocketHandlers,
): EnvironmentSocket {
  let closed = false;
  let socket: WebSocket | null = null;
  let backoffMs = INITIAL_BACKOFF_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  async function connect(): Promise<void> {
    const token = await getToken();

    if (closed) {
      return;
    }

    if (!token) {
      return;
    }

    const url = `${config.wsBaseUrl}/ws/environments/${envId}/`;
    socket = new WebSocket(url, ["jwt", token]);

    socket.onopen = () => {
      backoffMs = INITIAL_BACKOFF_MS;
      handlers.onOpen?.();
    };

    socket.onmessage = (event: { data: unknown }) => {
      try {
        const parsed = JSON.parse(event.data as string);
        handlers.onMessage(parsed);
      } catch {
        // Swallow malformed payloads.
      }
    };

    socket.onclose = () => {
      handlers.onClose?.();

      if (closed) {
        return;
      }

      reconnectTimer = setTimeout(() => {
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
        void connect();
      }, backoffMs);
    };
  }

  void connect();

  return {
    close(): void {
      closed = true;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      socket?.close();
    },
  };
}
