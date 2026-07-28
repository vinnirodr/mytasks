import { act, render } from "@testing-library/react-native";
import { useState } from "react";
import { Text } from "react-native";

import type { Occurrence } from "@/api/board";

import {
  applyServerOccurrence,
  moveToEndAsDone,
  restoreOccurrence,
  useUndoableComplete,
} from "../useUndoableComplete";

function occurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    id: "occ-1",
    title: "Regar as plantas",
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

describe("moveToEndAsDone (pure)", () => {
  test("marks the occurrence DONE and moves it to the end, preserving the rest of the order", () => {
    const list = [occurrence({ id: "a" }), occurrence({ id: "b" }), occurrence({ id: "c" })];

    const result = moveToEndAsDone(list, 0);

    expect(result.map((o) => o.id)).toEqual(["b", "c", "a"]);
    expect(result[2]!.status).toBe("DONE");
    expect(result[2]!.completedAt).not.toBeNull();
  });

  test("is a no-op for an out-of-range index", () => {
    const list = [occurrence({ id: "a" })];
    expect(moveToEndAsDone(list, 5)).toBe(list);
  });
});

describe("restoreOccurrence (pure)", () => {
  test("removes the moved item and reinserts the original at its snapshot index", () => {
    const original = occurrence({ id: "a", status: "PENDING" });
    const list = [occurrence({ id: "b" }), occurrence({ id: "c" }), { ...original, status: "DONE" as const }];

    const result = restoreOccurrence(list, { id: "a", index: 0, occurrence: original });

    expect(result.map((o) => o.id)).toEqual(["a", "b", "c"]);
    expect(result[0]!.status).toBe("PENDING");
  });
});

describe("applyServerOccurrence (pure)", () => {
  test("replaces the matching occurrence in place, without reordering", () => {
    const list = [
      occurrence({ id: "b" }),
      occurrence({ id: "c" }),
      occurrence({ id: "a", status: "DONE", completedAt: "2026-07-28T10:00:00.000Z" }),
    ];
    const serverOccurrence = occurrence({
      id: "a",
      status: "DONE",
      completedAt: "2026-07-28T10:00:03.000Z",
      completedBy: "user-9",
    });

    const result = applyServerOccurrence(list, serverOccurrence);

    expect(result.map((o) => o.id)).toEqual(["b", "c", "a"]);
    expect(result[2]).toBe(serverOccurrence);
  });

  test("is a no-op when the occurrence is no longer present", () => {
    const list = [occurrence({ id: "b" })];
    const result = applyServerOccurrence(list, occurrence({ id: "a", status: "DONE" }));
    expect(result).toBe(list);
  });
});

// ---------------------------------------------------------------------------
// Hook integration (fake timers)
// ---------------------------------------------------------------------------

type Harness = {
  getOccurrences: () => Occurrence[];
  getPending: () => ReturnType<typeof useUndoableComplete>["pending"];
  complete: (occurrence: Occurrence) => void;
  undo: () => void;
};

function renderHook(completeOccurrence: jest.Mock, onError?: () => void) {
  let harness: Harness | undefined;
  let occurrences = [occurrence({ id: "a" }), occurrence({ id: "b" }), occurrence({ id: "c" })];

  function Probe() {
    const [state, setState] = useState(occurrences);
    occurrences = state;

    const applyLocal = (updater: (prev: Occurrence[]) => Occurrence[]) => {
      setState((prev: Occurrence[]) => updater(prev));
    };

    const controller = useUndoableComplete({
      occurrences: state,
      applyLocal,
      completeOccurrence,
      onError,
    });

    harness = {
      getOccurrences: () => state,
      getPending: () => controller.pending,
      complete: controller.complete,
      undo: controller.undo,
    };

    return <Text testID="probe">{controller.pending ? "pending" : "idle"}</Text>;
  }

  render(<Probe />);
  return () => harness!;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test("completing marks the occurrence DONE locally, moves it to the end, and shows a pending undo", () => {
  const completeOccurrence = jest.fn().mockResolvedValue(occurrence({ id: "a", status: "DONE" }));
  const getHarness = renderHook(completeOccurrence);

  act(() => {
    getHarness().complete(occurrence({ id: "a" }));
  });

  const occurrences = getHarness().getOccurrences();
  expect(occurrences.map((o) => o.id)).toEqual(["b", "c", "a"]);
  expect(occurrences[2]!.status).toBe("DONE");
  expect(getHarness().getPending()).toEqual({ occurrenceId: "a", title: "Regar as plantas" });
  expect(completeOccurrence).not.toHaveBeenCalled();
});

test("after 5s with no undo, completeOccurrence is called and the pending banner clears", async () => {
  const completeOccurrence = jest.fn().mockResolvedValue(occurrence({ id: "a", status: "DONE" }));
  const getHarness = renderHook(completeOccurrence);

  act(() => {
    getHarness().complete(occurrence({ id: "a" }));
  });

  await act(async () => {
    jest.advanceTimersByTime(5000);
  });

  expect(completeOccurrence).toHaveBeenCalledWith("a");
  expect(getHarness().getPending()).toBeNull();
});

test("pressing undo before 5s cancels the timer, never calls the API, and restores the occurrence", async () => {
  const completeOccurrence = jest.fn().mockResolvedValue(occurrence({ id: "a", status: "DONE" }));
  const getHarness = renderHook(completeOccurrence);

  act(() => {
    getHarness().complete(occurrence({ id: "a" }));
  });

  act(() => {
    jest.advanceTimersByTime(2000);
  });

  act(() => {
    getHarness().undo();
  });

  await act(async () => {
    jest.advanceTimersByTime(10000);
  });

  expect(completeOccurrence).not.toHaveBeenCalled();
  expect(getHarness().getPending()).toBeNull();
  expect(getHarness().getOccurrences().map((o) => o.id)).toEqual(["a", "b", "c"]);
  expect(getHarness().getOccurrences()[0]!.status).toBe("PENDING");
});

test("an API error reverts the optimistic change and calls onError", async () => {
  const completeOccurrence = jest.fn().mockRejectedValue(new Error("network down"));
  const onError = jest.fn();
  const getHarness = renderHook(completeOccurrence, onError);

  act(() => {
    getHarness().complete(occurrence({ id: "a" }));
  });

  await act(async () => {
    jest.advanceTimersByTime(5000);
    // Let the rejected promise's .catch() microtask settle.
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(completeOccurrence).toHaveBeenCalledWith("a");
  expect(onError).toHaveBeenCalledTimes(1);
  expect(getHarness().getOccurrences().map((o) => o.id)).toEqual(["a", "b", "c"]);
  expect(getHarness().getOccurrences()[0]!.status).toBe("PENDING");
});

test("completing an already-DONE occurrence is a no-op", () => {
  const completeOccurrence = jest.fn();
  const getHarness = renderHook(completeOccurrence);

  act(() => {
    getHarness().complete(occurrence({ id: "a", status: "DONE" }));
  });

  expect(getHarness().getPending()).toBeNull();
  expect(getHarness().getOccurrences().map((o) => o.id)).toEqual(["a", "b", "c"]);
});

test("on success, the server's canonical occurrence replaces the optimistic guess in state", async () => {
  const serverOccurrence = occurrence({
    id: "a",
    status: "DONE",
    completedAt: "2026-07-28T12:34:00.000Z",
    completedBy: "user-9",
  });
  const completeOccurrence = jest.fn().mockResolvedValue(serverOccurrence);
  const getHarness = renderHook(completeOccurrence);

  act(() => {
    getHarness().complete(occurrence({ id: "a" }));
  });

  await act(async () => {
    jest.advanceTimersByTime(5000);
    // Let the resolved promise's .then() microtask settle.
    await Promise.resolve();
    await Promise.resolve();
  });

  const applied = getHarness().getOccurrences().find((item) => item.id === "a");
  expect(applied).toEqual(serverOccurrence);
});

// ---------------------------------------------------------------------------
// Only one pending undo at a time (findings from the task-5 review)
// ---------------------------------------------------------------------------

test("completing a second item while one is pending flushes the first immediately, then the second after its own delay", async () => {
  const completeOccurrence = jest.fn().mockResolvedValue(occurrence({ id: "x", status: "DONE" }));
  const getHarness = renderHook(completeOccurrence);

  act(() => {
    getHarness().complete(occurrence({ id: "a" }));
  });

  act(() => {
    jest.advanceTimersByTime(2000);
  });

  // Completing "b" while "a" is still within its undo window should settle
  // "a" right away (send its API call now) rather than drop it silently.
  act(() => {
    getHarness().complete(occurrence({ id: "b" }));
  });

  expect(completeOccurrence).toHaveBeenCalledTimes(1);
  expect(completeOccurrence).toHaveBeenNthCalledWith(1, "a");

  // "b" hasn't hit its own 5s window yet.
  expect(completeOccurrence).not.toHaveBeenCalledWith("b");
  expect(getHarness().getPending()).toEqual({ occurrenceId: "b", title: "Regar as plantas" });

  await act(async () => {
    jest.advanceTimersByTime(5000);
  });

  expect(completeOccurrence).toHaveBeenCalledTimes(2);
  expect(completeOccurrence).toHaveBeenNthCalledWith(2, "b");
  expect(getHarness().getPending()).toBeNull();
});

test("unmounting while a completion is pending flushes it instead of dropping it", () => {
  const completeOccurrence = jest.fn().mockResolvedValue(occurrence({ id: "a", status: "DONE" }));
  let harness: Harness | undefined;

  function Probe() {
    const [state, setState] = useState([
      occurrence({ id: "a" }),
      occurrence({ id: "b" }),
      occurrence({ id: "c" }),
    ]);

    const applyLocal = (updater: (prev: Occurrence[]) => Occurrence[]) => {
      setState((prev) => updater(prev));
    };

    const controller = useUndoableComplete({
      occurrences: state,
      applyLocal,
      completeOccurrence,
    });

    harness = {
      getOccurrences: () => state,
      getPending: () => controller.pending,
      complete: controller.complete,
      undo: controller.undo,
    };

    return <Text testID="probe">{controller.pending ? "pending" : "idle"}</Text>;
  }

  const view = render(<Probe />);

  act(() => {
    harness!.complete(occurrence({ id: "a" }));
  });

  expect(completeOccurrence).not.toHaveBeenCalled();

  act(() => {
    view.unmount();
  });

  // The undo window is moot once unmounted — the pending completion is sent
  // immediately rather than silently dropped (which would leave it
  // optimistically DONE locally but never persisted server-side).
  expect(completeOccurrence).toHaveBeenCalledWith("a");
});
