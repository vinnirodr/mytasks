import { act, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { boardApi, todayISO, type Occurrence } from "@/api/board";
import type { Environment } from "@/api/environments";

import { BoardProvider, deriveBoard } from "../BoardProvider";
import { useActiveEnvironment } from "../useActiveEnvironment";
import { useBoard } from "../useBoard";

jest.mock("@/api/board");
jest.mock("../useActiveEnvironment", () => ({
  useActiveEnvironment: jest.fn(),
}));

const mockGetBoard = boardApi.getBoard as jest.Mock;
const mockTodayISO = todayISO as jest.Mock;
const mockUseActiveEnvironment = useActiveEnvironment as jest.Mock;

const env: Environment = {
  id: "env-a",
  name: "Casa",
  envType: "HOUSE",
  timezone: "America/Sao_Paulo",
  role: "ADMIN",
};

function occurrence(overrides: Partial<Occurrence>): Occurrence {
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

let latest: ReturnType<typeof useBoard> | undefined;

function Probe() {
  latest = useBoard();
  return (
    <Text testID="probe">
      {latest.loading ? "loading" : "loaded"}|{latest.occurrences.length}
    </Text>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  latest = undefined;
  mockTodayISO.mockReturnValue("2026-07-28");
});

describe("deriveBoard (pure derivation)", () => {
  test("splits LATE into atrasadas and keeps the rest in hoje, preserving order", () => {
    const late = occurrence({ id: "1", status: "LATE" });
    const done = occurrence({ id: "2", status: "DONE" });
    const pending = occurrence({ id: "3", status: "PENDING" });
    const postponed = occurrence({ id: "4", status: "POSTPONED" });
    const missed = occurrence({ id: "5", status: "MISSED" });

    const result = deriveBoard([late, done, pending, postponed, missed]);

    expect(result.sections.atrasadas).toEqual([late]);
    expect(result.sections.hoje).toEqual([done, pending, postponed, missed]);
  });

  test("computes heroStats — 2 done out of 5 is 40%", () => {
    const occurrences = [
      occurrence({ id: "1", status: "LATE" }),
      occurrence({ id: "2", status: "DONE" }),
      occurrence({ id: "3", status: "DONE" }),
      occurrence({ id: "4", status: "PENDING" }),
      occurrence({ id: "5", status: "POSTPONED" }),
    ];

    const result = deriveBoard(occurrences);

    expect(result.heroStats).toEqual({ done: 2, total: 5, pct: 40 });
  });

  test("returns zeroed heroStats and empty sections for an empty list", () => {
    const result = deriveBoard([]);

    expect(result.heroStats).toEqual({ done: 0, total: 0, pct: 0 });
    expect(result.sections).toEqual({ atrasadas: [], hoje: [] });
  });
});

describe("BoardProvider", () => {
  test("fetches the board for the active environment and derives heroStats/sections", async () => {
    mockUseActiveEnvironment.mockReturnValue({ active: env });
    const occ1 = occurrence({ id: "1", status: "DONE" });
    const occ2 = occurrence({ id: "2", status: "PENDING" });
    mockGetBoard.mockResolvedValue([occ1, occ2]);

    render(
      <BoardProvider>
        <Probe />
      </BoardProvider>,
    );

    expect(latest?.loading).toBe(true);

    await waitFor(() => {
      expect(latest?.loading).toBe(false);
    });

    expect(mockGetBoard).toHaveBeenCalledWith("env-a", "2026-07-28");
    expect(latest?.occurrences).toEqual([occ1, occ2]);
    expect(latest?.heroStats).toEqual({ done: 1, total: 2, pct: 50 });
    expect(latest?.sections).toEqual({ atrasadas: [], hoje: [occ1, occ2] });
    expect(latest?.error).toBeNull();
  });

  test("stays empty without loading or erroring when there is no active environment", async () => {
    mockUseActiveEnvironment.mockReturnValue({ active: null });

    render(
      <BoardProvider>
        <Probe />
      </BoardProvider>,
    );

    await waitFor(() => {
      expect(latest?.loading).toBe(false);
    });

    expect(mockGetBoard).not.toHaveBeenCalled();
    expect(latest?.occurrences).toEqual([]);
    expect(latest?.error).toBeNull();
  });

  test("captures a network error in `error` without throwing", async () => {
    mockUseActiveEnvironment.mockReturnValue({ active: env });
    const error = new Error("network down");
    mockGetBoard.mockRejectedValue(error);

    render(
      <BoardProvider>
        <Probe />
      </BoardProvider>,
    );

    await waitFor(() => {
      expect(latest?.loading).toBe(false);
    });

    expect(latest?.error).toBe(error);
  });

  test("refetch() re-fetches the board for the current active environment", async () => {
    mockUseActiveEnvironment.mockReturnValue({ active: env });
    mockGetBoard.mockResolvedValue([occurrence({ id: "1" })]);

    render(
      <BoardProvider>
        <Probe />
      </BoardProvider>,
    );

    await waitFor(() => {
      expect(latest?.loading).toBe(false);
    });

    mockGetBoard.mockClear();
    mockGetBoard.mockResolvedValue([occurrence({ id: "1" }), occurrence({ id: "2" })]);

    await act(async () => {
      latest?.refetch();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(latest?.occurrences).toHaveLength(2);
    });

    expect(mockGetBoard).toHaveBeenCalledWith("env-a", "2026-07-28");
  });

  test("applyLocal patches occurrences locally (e.g. optimistic complete) and derived values recompute", async () => {
    mockUseActiveEnvironment.mockReturnValue({ active: env });
    const occ1 = occurrence({ id: "1", status: "PENDING" });
    mockGetBoard.mockResolvedValue([occ1]);

    render(
      <BoardProvider>
        <Probe />
      </BoardProvider>,
    );

    await waitFor(() => {
      expect(latest?.occurrences).toEqual([occ1]);
    });

    act(() => {
      latest?.applyLocal((prev) =>
        prev.map((o) => (o.id === "1" ? { ...o, status: "DONE" } : o)),
      );
    });

    expect(latest?.occurrences[0].status).toBe("DONE");
    expect(latest?.heroStats).toEqual({ done: 1, total: 1, pct: 100 });
    expect(mockGetBoard).toHaveBeenCalledTimes(1);
  });

  test("reloads the board when the active environment id changes", async () => {
    const envB: Environment = { ...env, id: "env-b" };
    mockUseActiveEnvironment.mockReturnValue({ active: env });
    mockGetBoard.mockResolvedValue([occurrence({ id: "1" })]);

    const { rerender } = render(
      <BoardProvider>
        <Probe />
      </BoardProvider>,
    );

    await waitFor(() => {
      expect(latest?.loading).toBe(false);
    });

    expect(mockGetBoard).toHaveBeenLastCalledWith("env-a", "2026-07-28");

    mockUseActiveEnvironment.mockReturnValue({ active: envB });
    mockGetBoard.mockResolvedValue([occurrence({ id: "2" }), occurrence({ id: "3" })]);

    rerender(
      <BoardProvider>
        <Probe />
      </BoardProvider>,
    );

    await waitFor(() => {
      expect(latest?.occurrences).toHaveLength(2);
    });

    expect(mockGetBoard).toHaveBeenLastCalledWith("env-b", "2026-07-28");
  });

  test("useBoard throws when used outside the provider", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/BoardProvider/);
    consoleError.mockRestore();
  });
});
