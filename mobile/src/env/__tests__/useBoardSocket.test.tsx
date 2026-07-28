import { act, render } from "@testing-library/react-native";
import { useState } from "react";
import { Text } from "react-native";

import type { Occurrence } from "@/api/board";
import type { SocketHandlers } from "@/api/socket";
import { createEnvironmentSocket } from "@/api/socket";
import { tokenStore } from "@/api/tokenStore";

import { useBoardSocket } from "../useBoardSocket";

jest.mock("@/api/socket", () => ({
  createEnvironmentSocket: jest.fn(),
}));
jest.mock("@/api/tokenStore", () => ({
  tokenStore: { getAccess: jest.fn() },
}));

const mockCreateSocket = createEnvironmentSocket as jest.Mock;

function occurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    id: "occ-1",
    title: "Lavar louça",
    date: "2026-07-28",
    time: "08:00:00",
    assignee: "user-1",
    status: "PENDING",
    isOneOff: false,
    isCancelled: false,
    recurringTask: "task-1",
    taskDefinition: "def-1",
    completedBy: null,
    completedAt: null,
    ...overrides,
  };
}

type Harness = {
  getConnected: () => boolean;
  getOccurrences: () => Occurrence[];
  getRefetchCalls: () => number;
  setEnvId: (id: string | undefined) => void;
};

/**
 * Renders `useBoardSocket` behind a small probe component so the hook's
 * `envId` prop can change across a rerender (to exercise the
 * close-old/open-new path) and `occurrences`/`applyLocal` behave like the
 * real `BoardProvider` (state fed back through `applyLocal`).
 */
function renderBoardSocket(initialOccurrences: Occurrence[], initialEnvId: string | undefined) {
  let harness: Harness | undefined;
  const refetch = jest.fn();
  let setEnvIdImpl: (id: string | undefined) => void = () => {};

  function Probe() {
    const [envId, setEnvId] = useState<string | undefined>(initialEnvId);
    const [occurrences, setOccurrences] = useState(initialOccurrences);
    setEnvIdImpl = setEnvId;

    const applyLocal = (updater: (prev: Occurrence[]) => Occurrence[]) => {
      setOccurrences((prev) => updater(prev));
    };

    const { connected } = useBoardSocket({ envId, occurrences, applyLocal, refetch });

    harness = {
      getConnected: () => connected,
      getOccurrences: () => occurrences,
      getRefetchCalls: () => refetch.mock.calls.length,
      setEnvId: (id) => setEnvIdImpl(id),
    };

    return <Text testID="probe">{connected ? "connected" : "disconnected"}</Text>;
  }

  render(<Probe />);
  return () => harness!;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useBoardSocket", () => {
  test("opens a socket for the given envId using tokenStore.getAccess when envId is set", () => {
    const close = jest.fn();
    mockCreateSocket.mockReturnValue({ close });

    renderBoardSocket([occurrence({ id: "1" })], "env-a");

    expect(mockCreateSocket).toHaveBeenCalledTimes(1);
    expect(mockCreateSocket).toHaveBeenCalledWith(
      "env-a",
      tokenStore.getAccess,
      expect.objectContaining({
        onMessage: expect.any(Function),
        onOpen: expect.any(Function),
        onClose: expect.any(Function),
      }),
    );
  });

  test("does not open a socket when envId is undefined", () => {
    renderBoardSocket([], undefined);
    expect(mockCreateSocket).not.toHaveBeenCalled();
  });

  test("closes the previous socket and opens a new one when envId changes", () => {
    const closeA = jest.fn();
    const closeB = jest.fn();
    mockCreateSocket.mockReturnValueOnce({ close: closeA }).mockReturnValueOnce({ close: closeB });

    const getHarness = renderBoardSocket([occurrence({ id: "1" })], "env-a");

    act(() => {
      getHarness().setEnvId("env-b");
    });

    expect(closeA).toHaveBeenCalledTimes(1);
    expect(mockCreateSocket).toHaveBeenCalledTimes(2);
    expect(mockCreateSocket.mock.calls[1]![0]).toBe("env-b");
    expect(closeB).not.toHaveBeenCalled();
  });

  test("closes the socket on unmount", () => {
    const close = jest.fn();
    mockCreateSocket.mockReturnValue({ close });

    function Probe() {
      useBoardSocket({
        envId: "env-a",
        occurrences: [],
        applyLocal: jest.fn(),
        refetch: jest.fn(),
      });
      return null;
    }

    const view = render(<Probe />);
    expect(close).not.toHaveBeenCalled();
    view.unmount();
    expect(close).toHaveBeenCalledTimes(1);
  });

  test("board_update for a present occurrence patches only its status via applyLocal, without refetching", () => {
    let handlers: SocketHandlers | undefined;
    mockCreateSocket.mockImplementation((_envId, _getToken, h: SocketHandlers) => {
      handlers = h;
      return { close: jest.fn() };
    });

    const getHarness = renderBoardSocket(
      [occurrence({ id: "1", status: "PENDING" }), occurrence({ id: "2", status: "PENDING" })],
      "env-a",
    );

    act(() => {
      handlers!.onMessage({ kind: "board_update", occurrence_id: "1", status: "DONE" });
    });

    const occurrences = getHarness().getOccurrences();
    expect(occurrences.find((o) => o.id === "1")!.status).toBe("DONE");
    expect(occurrences.find((o) => o.id === "2")!.status).toBe("PENDING");
    expect(getHarness().getRefetchCalls()).toBe(0);
  });

  test("board_update for an absent occurrence_id triggers a debounced refetch (coalesced across a burst)", () => {
    let handlers: SocketHandlers | undefined;
    mockCreateSocket.mockImplementation((_envId, _getToken, h: SocketHandlers) => {
      handlers = h;
      return { close: jest.fn() };
    });

    const getHarness = renderBoardSocket([occurrence({ id: "1" })], "env-a");

    act(() => {
      handlers!.onMessage({ kind: "board_update", occurrence_id: "new-1", status: "PENDING" });
      handlers!.onMessage({ kind: "board_update", occurrence_id: "new-2", status: "PENDING" });
    });

    expect(getHarness().getRefetchCalls()).toBe(0);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(getHarness().getRefetchCalls()).toBe(1);
  });

  test("activity messages never mutate occurrences or trigger refetch", () => {
    let handlers: SocketHandlers | undefined;
    mockCreateSocket.mockImplementation((_envId, _getToken, h: SocketHandlers) => {
      handlers = h;
      return { close: jest.fn() };
    });

    const original = [occurrence({ id: "1", status: "PENDING" })];
    const getHarness = renderBoardSocket(original, "env-a");

    act(() => {
      handlers!.onMessage({ kind: "activity", event: { type: "task_completed" } });
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(getHarness().getOccurrences()).toEqual(original);
    expect(getHarness().getRefetchCalls()).toBe(0);
  });

  test("ignores malformed or unknown-kind payloads safely", () => {
    let handlers: SocketHandlers | undefined;
    mockCreateSocket.mockImplementation((_envId, _getToken, h: SocketHandlers) => {
      handlers = h;
      return { close: jest.fn() };
    });

    const original = [occurrence({ id: "1", status: "PENDING" })];
    const getHarness = renderBoardSocket(original, "env-a");

    expect(() => {
      act(() => {
        handlers!.onMessage(null);
        handlers!.onMessage("nonsense");
        handlers!.onMessage({ kind: "mystery" });
        handlers!.onMessage({ kind: "board_update" });
      });
    }).not.toThrow();

    expect(getHarness().getOccurrences()).toEqual(original);
    expect(getHarness().getRefetchCalls()).toBe(0);
  });

  test("board_update with an invalid status is ignored (no board mutation, no refetch)", () => {
    let handlers: SocketHandlers | undefined;
    mockCreateSocket.mockImplementation((_envId, _getToken, h: SocketHandlers) => {
      handlers = h;
      return { close: jest.fn() };
    });

    const original = [occurrence({ id: "1", status: "PENDING" })];
    const getHarness = renderBoardSocket(original, "env-a");

    act(() => {
      handlers!.onMessage({ kind: "board_update", occurrence_id: "1", status: "BOGUS" });
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(getHarness().getOccurrences()).toEqual(original);
    expect(getHarness().getRefetchCalls()).toBe(0);
  });

  test("onOpen/onClose toggle connected", () => {
    let handlers: SocketHandlers | undefined;
    mockCreateSocket.mockImplementation((_envId, _getToken, h: SocketHandlers) => {
      handlers = h;
      return { close: jest.fn() };
    });

    const getHarness = renderBoardSocket([], "env-a");
    expect(getHarness().getConnected()).toBe(false);

    act(() => {
      handlers!.onOpen?.();
    });
    expect(getHarness().getConnected()).toBe(true);

    act(() => {
      handlers!.onClose?.();
    });
    expect(getHarness().getConnected()).toBe(false);
  });
});
