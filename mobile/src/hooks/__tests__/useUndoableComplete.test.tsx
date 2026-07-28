import { act, render } from "@testing-library/react-native";
import { useState } from "react";
import { Text } from "react-native";

import type { Occurrence } from "@/api/board";

import { moveToEndAsDone, restoreOccurrence, useUndoableComplete } from "../useUndoableComplete";

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
