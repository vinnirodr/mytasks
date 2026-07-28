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
 * authenticating via the `["jwt", accessToken]` subprotocol. Incoming
 * messages are JSON-parsed and handed to `onMessage` (malformed payloads are
 * swallowed). If the connection drops and `close()` was not called, it
 * reconnects automatically with a capped exponential backoff, reusing the
 * same envId/token/handlers.
 */
export function createEnvironmentSocket(
  envId: string,
  accessToken: string,
  handlers: SocketHandlers,
): EnvironmentSocket {
  let closed = false;
  let socket: WebSocket | null = null;
  let backoffMs = INITIAL_BACKOFF_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    const url = `${config.wsBaseUrl}/ws/environments/${envId}/`;
    socket = new WebSocket(url, ["jwt", accessToken]);

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
        connect();
      }, backoffMs);
    };
  }

  connect();

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
