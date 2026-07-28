import { createEnvironmentSocket } from "../socket";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  url: string;
  protocols: string | string[] | undefined;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  closeCalls = 0;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
    FakeWebSocket.instances.push(this);
  }

  close(): void {
    this.closeCalls += 1;
  }
}

// Flushes the microtask queue so pending `await getToken()` calls inside
// `connect()` resolve before assertions run.
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createEnvironmentSocket", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("opens a WebSocket at the environment URL with the jwt subprotocol using a freshly read token", async () => {
    const getToken = jest.fn().mockResolvedValue("token-abc");
    createEnvironmentSocket("env-123", getToken, { onMessage: jest.fn() });

    await flushMicrotasks();

    expect(getToken).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(1);
    const instance = FakeWebSocket.instances[0];
    expect(instance.url).toBe("ws://localhost:8000/ws/environments/env-123/");
    expect(instance.protocols).toEqual(["jwt", "token-abc"]);
  });

  test("does not open a socket when getToken resolves to null", async () => {
    const getToken = jest.fn().mockResolvedValue(null);
    createEnvironmentSocket("env-123", getToken, { onMessage: jest.fn() });

    await flushMicrotasks();

    expect(getToken).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  test("calls onOpen when the socket opens", async () => {
    const getToken = jest.fn().mockResolvedValue("token-abc");
    const onOpen = jest.fn();
    createEnvironmentSocket("env-123", getToken, { onMessage: jest.fn(), onOpen });

    await flushMicrotasks();

    const instance = FakeWebSocket.instances[0];
    instance.onopen?.();

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test("parses incoming JSON messages and hands them to onMessage", async () => {
    const getToken = jest.fn().mockResolvedValue("token-abc");
    const onMessage = jest.fn();
    createEnvironmentSocket("env-123", getToken, { onMessage });

    await flushMicrotasks();

    const instance = FakeWebSocket.instances[0];
    instance.onmessage?.({ data: '{"kind":"ping"}' });

    expect(onMessage).toHaveBeenCalledWith({ kind: "ping" });
  });

  test("swallows malformed JSON messages without throwing", async () => {
    const getToken = jest.fn().mockResolvedValue("token-abc");
    const onMessage = jest.fn();
    createEnvironmentSocket("env-123", getToken, { onMessage });

    await flushMicrotasks();

    const instance = FakeWebSocket.instances[0];
    expect(() => instance.onmessage?.({ data: "not json" })).not.toThrow();
    expect(onMessage).not.toHaveBeenCalled();
  });

  test("calls onClose when the socket closes", async () => {
    jest.useFakeTimers();
    const getToken = jest.fn().mockResolvedValue("token-abc");
    const onClose = jest.fn();
    createEnvironmentSocket("env-123", getToken, { onMessage: jest.fn(), onClose });

    await flushMicrotasks();

    const instance = FakeWebSocket.instances[0];
    instance.onclose?.();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("reconnects with capped exponential backoff after an unexpected close, re-reading the token each time", async () => {
    jest.useFakeTimers();
    const getToken = jest.fn().mockResolvedValue("token-abc");
    createEnvironmentSocket("env-123", getToken, { onMessage: jest.fn() });

    await flushMicrotasks();
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(getToken).toHaveBeenCalledTimes(1);

    // First drop: reconnect after ~1s.
    FakeWebSocket.instances[0].onclose?.();
    expect(FakeWebSocket.instances).toHaveLength(1);
    jest.advanceTimersByTime(999);
    expect(FakeWebSocket.instances).toHaveLength(1);
    jest.advanceTimersByTime(1);
    await flushMicrotasks();
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(getToken).toHaveBeenCalledTimes(2);

    // Second drop: reconnect after ~2s.
    FakeWebSocket.instances[1].onclose?.();
    jest.advanceTimersByTime(1999);
    expect(FakeWebSocket.instances).toHaveLength(2);
    jest.advanceTimersByTime(1);
    await flushMicrotasks();
    expect(FakeWebSocket.instances).toHaveLength(3);
    expect(getToken).toHaveBeenCalledTimes(3);

    // Third drop: reconnect after ~4s.
    FakeWebSocket.instances[2].onclose?.();
    jest.advanceTimersByTime(3999);
    expect(FakeWebSocket.instances).toHaveLength(3);
    jest.advanceTimersByTime(1);
    await flushMicrotasks();
    expect(FakeWebSocket.instances).toHaveLength(4);
    expect(getToken).toHaveBeenCalledTimes(4);
  });

  test("reconnect uses the current token value returned by getToken, not the stale captured one", async () => {
    jest.useFakeTimers();
    const getToken = jest.fn().mockResolvedValue("token-v1");
    createEnvironmentSocket("env-123", getToken, { onMessage: jest.fn() });

    await flushMicrotasks();
    expect(FakeWebSocket.instances[0].protocols).toEqual(["jwt", "token-v1"]);

    getToken.mockResolvedValue("token-v2");

    FakeWebSocket.instances[0].onclose?.();
    jest.advanceTimersByTime(1000);
    await flushMicrotasks();

    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(FakeWebSocket.instances[1].protocols).toEqual(["jwt", "token-v2"]);
  });

  test("caps backoff at ~15s across repeated drops", async () => {
    jest.useFakeTimers();
    const getToken = jest.fn().mockResolvedValue("token-abc");
    createEnvironmentSocket("env-123", getToken, { onMessage: jest.fn() });
    await flushMicrotasks();

    // Drive through several reconnect cycles: 1s, 2s, 4s, 8s, 16s->capped 15s.
    const delays = [1000, 2000, 4000, 8000, 15000, 15000];
    for (let i = 0; i < delays.length; i += 1) {
      const before = FakeWebSocket.instances.length;
      FakeWebSocket.instances[before - 1].onclose?.();
      jest.advanceTimersByTime(delays[i]);
      await flushMicrotasks();
      expect(FakeWebSocket.instances).toHaveLength(before + 1);
    }
  });

  test("does not reconnect after close() is called intentionally", async () => {
    jest.useFakeTimers();
    const getToken = jest.fn().mockResolvedValue("token-abc");
    const socket = createEnvironmentSocket("env-123", getToken, { onMessage: jest.fn() });

    await flushMicrotasks();
    expect(FakeWebSocket.instances).toHaveLength(1);
    const instance = FakeWebSocket.instances[0];

    socket.close();
    expect(instance.closeCalls).toBe(1);

    // Simulate the underlying close event firing after close() was called.
    instance.onclose?.();
    jest.advanceTimersByTime(30000);
    await flushMicrotasks();

    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
