import { act, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { boardApi, type Occurrence } from "@/api/board";

import { useAgendaWeek } from "../useAgendaWeek";

jest.mock("@/api/board", () => {
  const actual = jest.requireActual("@/api/board");
  return { ...actual, boardApi: { ...actual.boardApi, getWeek: jest.fn() } };
});

const mockGetWeek = boardApi.getWeek as jest.Mock;

function occurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    id: "occ-1",
    title: "Regar plantas",
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

let latest: ReturnType<typeof useAgendaWeek> | undefined;

function Probe({ envId, weekStart }: { envId: string | null; weekStart: string }) {
  latest = useAgendaWeek(envId, weekStart);
  return <Text testID="probe">{latest.loading ? "loading" : "loaded"}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  latest = undefined;
});

test("fetches the given week for the given environment", async () => {
  mockGetWeek.mockResolvedValue([occurrence()]);

  render(<Probe envId="env-a" weekStart="2026-07-27" />);

  await waitFor(() => expect(latest?.loading).toBe(false));

  expect(mockGetWeek).toHaveBeenCalledWith("env-a", "2026-07-27");
  expect(latest?.occurrences).toEqual([occurrence()]);
  expect(latest?.error).toBe(false);
});

test("a null envId clears occurrences without calling the API", () => {
  render(<Probe envId={null} weekStart="2026-07-27" />);

  expect(mockGetWeek).not.toHaveBeenCalled();
  expect(latest?.occurrences).toEqual([]);
  expect(latest?.loading).toBe(false);
});

test("an API error is exposed without throwing", async () => {
  mockGetWeek.mockRejectedValue(new Error("boom"));

  render(<Probe envId="env-a" weekStart="2026-07-27" />);

  await waitFor(() => expect(latest?.loading).toBe(false));
  expect(latest?.error).toBe(true);
  expect(latest?.occurrences).toEqual([]);
});

test("a changed weekStart refetches the new week", async () => {
  mockGetWeek.mockResolvedValueOnce([occurrence({ id: "wk1" })]).mockResolvedValueOnce([occurrence({ id: "wk2" })]);

  const { rerender } = render(<Probe envId="env-a" weekStart="2026-07-27" />);
  await waitFor(() => expect(latest?.occurrences[0]?.id).toBe("wk1"));

  await act(async () => {
    rerender(<Probe envId="env-a" weekStart="2026-08-03" />);
  });

  await waitFor(() => expect(mockGetWeek).toHaveBeenCalledWith("env-a", "2026-08-03"));
  await waitFor(() => expect(latest?.occurrences[0]?.id).toBe("wk2"));
});

test("refetch() re-requests the current week", async () => {
  mockGetWeek.mockResolvedValue([occurrence()]);

  render(<Probe envId="env-a" weekStart="2026-07-27" />);
  await waitFor(() => expect(latest?.loading).toBe(false));

  mockGetWeek.mockClear();
  await act(async () => {
    latest?.refetch();
  });

  await waitFor(() => expect(mockGetWeek).toHaveBeenCalledWith("env-a", "2026-07-27"));
});
