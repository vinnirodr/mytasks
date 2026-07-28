import { act, fireEvent, render, screen } from "@testing-library/react-native";

import type { AuthUser } from "@/api/auth";
import { boardApi, type Occurrence } from "@/api/board";
import type { Environment } from "@/api/environments";
import type { Member } from "@/api/members";
import { useAuth } from "@/auth/useAuth";
import { useActiveEnvironment } from "@/env/useActiveEnvironment";
import { useBoard } from "@/env/useBoard";
import { useMembers } from "@/env/useMembers";
import { ThemeProvider } from "@/theme/ThemeProvider";

import {
  isPostponeEnabled,
  patchOccurrence,
  repeatKindLabel,
  repeatTimeLabel,
  TaskDetail,
} from "../TaskDetail";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/api/board", () => {
  const actual = jest.requireActual("@/api/board");
  return {
    ...actual,
    boardApi: {
      ...actual.boardApi,
      completeOccurrence: jest.fn(),
      postponeOccurrence: jest.fn(),
      reassignOccurrence: jest.fn(),
      pickupOccurrence: jest.fn(),
    },
  };
});

jest.mock("@/auth/useAuth", () => ({ useAuth: jest.fn() }));
jest.mock("@/env/useActiveEnvironment", () => ({ useActiveEnvironment: jest.fn() }));
jest.mock("@/env/useBoard", () => ({ useBoard: jest.fn() }));
jest.mock("@/env/useMembers", () => ({ useMembers: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const mockUseActiveEnvironment = useActiveEnvironment as jest.Mock;
const mockUseBoard = useBoard as jest.Mock;
const mockUseMembers = useMembers as jest.Mock;

const mockCompleteOccurrence = boardApi.completeOccurrence as jest.Mock;
const mockPostponeOccurrence = boardApi.postponeOccurrence as jest.Mock;
const mockReassignOccurrence = boardApi.reassignOccurrence as jest.Mock;
const mockPickupOccurrence = boardApi.pickupOccurrence as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const env: Environment = {
  id: "env-a",
  name: "Casa da Rua Aurora",
  envType: "HOUSE",
  timezone: "America/Sao_Paulo",
  role: "ADMIN",
};

const authUser: AuthUser = { id: "user-1", email: "marina@example.com", displayName: "Marina Silva" };

const marina: Member = {
  id: "mem-1",
  userId: "user-1",
  displayName: "Marina",
  initials: "MA",
  role: "ADMIN",
  isMe: true,
};

const pedro: Member = {
  id: "mem-2",
  userId: "user-2",
  displayName: "Pedro",
  initials: "PE",
  role: "MEMBER",
  isMe: false,
};

function occurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    id: "occ-1",
    title: "Lavar a louça do almoço",
    date: "2026-07-28",
    time: "14:00:00",
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

function boardValue(occurrences: Occurrence[], applyLocal = jest.fn()) {
  return {
    occurrences,
    heroStats: { done: 0, total: occurrences.length, pct: 0 },
    sections: { atrasadas: [], hoje: occurrences },
    loading: false,
    error: null,
    refetch: jest.fn(),
    applyLocal,
  };
}

function renderDetail(props: Partial<Parameters<typeof TaskDetail>[0]> = {}) {
  return render(
    <ThemeProvider>
      <TaskDetail occurrenceId="occ-1" onClose={jest.fn()} {...props} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: authUser });
  mockUseActiveEnvironment.mockReturnValue({
    environments: [env],
    active: env,
    setActive: jest.fn(),
    loading: false,
    error: null,
    reload: jest.fn(),
  });
  mockUseMembers.mockReturnValue({
    members: [marina, pedro],
    byId: new Map([
      ["user-1", marina],
      ["user-2", pedro],
    ]),
    loading: false,
    error: null,
  });
  mockUseBoard.mockReturnValue(boardValue([occurrence()]));
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe("repeatKindLabel / repeatTimeLabel", () => {
  test("one-off occurrence", () => {
    expect(repeatKindLabel(occurrence({ isOneOff: true }))).toBe("Tarefa avulsa");
  });

  test("recurring occurrence", () => {
    expect(repeatKindLabel(occurrence({ isOneOff: false }))).toBe("Tarefa recorrente");
  });

  test("formats the time as HH:MM", () => {
    expect(repeatTimeLabel(occurrence({ time: "09:30:00" }))).toBe("09:30");
  });

  test("falls back to a placeholder without a time", () => {
    expect(repeatTimeLabel(occurrence({ time: null }))).toBe("Sem horário");
  });
});

describe("isPostponeEnabled", () => {
  test("enabled for PENDING/LATE only", () => {
    expect(isPostponeEnabled("PENDING")).toBe(true);
    expect(isPostponeEnabled("LATE")).toBe(true);
    expect(isPostponeEnabled("DONE")).toBe(false);
    expect(isPostponeEnabled("POSTPONED")).toBe(false);
    expect(isPostponeEnabled("MISSED")).toBe(false);
  });
});

describe("patchOccurrence (pure)", () => {
  test("patches the matching item in place without reordering", () => {
    const list = [occurrence({ id: "a" }), occurrence({ id: "b" })];
    const result = patchOccurrence(list, "b", { status: "POSTPONED" });
    expect(result.map((o) => o.id)).toEqual(["a", "b"]);
    expect(result[1]!.status).toBe("POSTPONED");
  });

  test("is a no-op when the id isn't present", () => {
    const list = [occurrence({ id: "a" })];
    expect(patchOccurrence(list, "missing", { status: "DONE" })).toBe(list);
  });
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

test("renders nothing when occurrenceId is null", () => {
  renderDetail({ occurrenceId: null });
  expect(screen.queryByTestId("task-detail-modal")).toBeNull();
});

test("renders nothing when the occurrence id isn't found on the board", () => {
  mockUseBoard.mockReturnValue(boardValue([]));
  renderDetail({ occurrenceId: "missing" });
  expect(screen.queryByTestId("task-detail-modal")).toBeNull();
});

test("closes safely if the selected occurrence disappears from the board", () => {
  const onClose = jest.fn();
  const { rerender } = render(
    <ThemeProvider>
      <TaskDetail occurrenceId="occ-1" onClose={onClose} />
    </ThemeProvider>,
  );

  mockUseBoard.mockReturnValue(boardValue([]));

  rerender(
    <ThemeProvider>
      <TaskDetail occurrenceId="occ-1" onClose={onClose} />
    </ThemeProvider>,
  );

  expect(onClose).toHaveBeenCalled();
});

test("renders title, StatusChip, assignee, and the REPETE card", () => {
  mockUseBoard.mockReturnValue(
    boardValue([occurrence({ status: "LATE", time: "08:00:00", isOneOff: false })]),
  );

  renderDetail();

  expect(screen.getByText("Lavar a louça do almoço")).toBeTruthy();
  expect(screen.getByText("ATRASADA")).toBeTruthy();
  expect(screen.getByText("Marina")).toBeTruthy();
  expect(screen.getByText("Tarefa recorrente")).toBeTruthy();
  expect(screen.getByText("08:00")).toBeTruthy();
  expect(screen.getByText("Em breve")).toBeTruthy();
  expect(screen.getByText("Sem histórico ainda")).toBeTruthy();
});

test("shows 'Sem responsável' when the occurrence has no assignee", () => {
  mockUseBoard.mockReturnValue(boardValue([occurrence({ assignee: null })]));
  renderDetail();
  expect(screen.getByText("Sem responsável")).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Postpone
// ---------------------------------------------------------------------------

describe("adiar", () => {
  test("is disabled for DONE/POSTPONED/MISSED", () => {
    mockUseBoard.mockReturnValue(boardValue([occurrence({ status: "DONE" })]));
    renderDetail();
    expect(screen.getByTestId("task-detail-postpone").props.accessibilityState.disabled).toBe(true);
  });

  test("is enabled for PENDING/LATE and calls postponeOccurrence optimistically", () => {
    mockPostponeOccurrence.mockResolvedValue(occurrence({ status: "POSTPONED" }));
    const applyLocal = jest.fn();
    mockUseBoard.mockReturnValue(boardValue([occurrence({ status: "PENDING" })], applyLocal));

    renderDetail();

    fireEvent.press(screen.getByTestId("task-detail-postpone"));

    expect(mockPostponeOccurrence).toHaveBeenCalledWith("occ-1");
    expect(applyLocal).toHaveBeenCalled();
    const updated = applyLocal.mock.calls[0]![0]([occurrence({ status: "PENDING" })]);
    expect(updated[0].status).toBe("POSTPONED");
  });

  test("reverts and shows a notice on error", async () => {
    mockPostponeOccurrence.mockRejectedValue(new Error("network down"));
    mockUseBoard.mockReturnValue(boardValue([occurrence({ status: "PENDING" })]));

    renderDetail();

    await act(async () => {
      fireEvent.press(screen.getByTestId("task-detail-postpone"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("task-detail-error-banner")).toBeTruthy();
    expect(screen.getByText("Não foi possível adiar. Tente de novo.")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Complete
// ---------------------------------------------------------------------------

describe("concluir", () => {
  test("is hidden when the occurrence is already DONE", () => {
    mockUseBoard.mockReturnValue(boardValue([occurrence({ status: "DONE" })]));
    renderDetail();
    expect(screen.queryByTestId("task-detail-complete")).toBeNull();
  });

  test("calls completeOccurrence, applies the optimistic move, and closes the modal", () => {
    mockCompleteOccurrence.mockResolvedValue(occurrence({ status: "DONE" }));
    const applyLocal = jest.fn();
    const onClose = jest.fn();
    mockUseBoard.mockReturnValue(boardValue([occurrence({ status: "PENDING" })], applyLocal));

    renderDetail({ onClose });

    fireEvent.press(screen.getByTestId("task-detail-complete"));

    expect(mockCompleteOccurrence).toHaveBeenCalledWith("occ-1");
    expect(applyLocal).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test("on error, reverts locally and calls onCompleteError", async () => {
    mockCompleteOccurrence.mockRejectedValue(new Error("network down"));
    const applyLocal = jest.fn();
    const onCompleteError = jest.fn();
    mockUseBoard.mockReturnValue(boardValue([occurrence({ status: "PENDING" })], applyLocal));

    renderDetail({ onCompleteError });

    await act(async () => {
      fireEvent.press(screen.getByTestId("task-detail-complete"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onCompleteError).toHaveBeenCalledTimes(1);
    // Two applyLocal calls: the optimistic move, then the revert.
    expect(applyLocal).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Reassign / pickup
// ---------------------------------------------------------------------------

describe("reatribuir", () => {
  test("opens the member picker sheet", () => {
    renderDetail();
    fireEvent.press(screen.getByTestId("task-detail-reassign"));
    expect(screen.getByTestId("member-picker-sheet")).toBeTruthy();
  });

  test("picking a member calls reassignOccurrence and applies optimistically", () => {
    mockReassignOccurrence.mockResolvedValue(occurrence({ assignee: "user-2" }));
    const applyLocal = jest.fn();
    mockUseBoard.mockReturnValue(boardValue([occurrence({ assignee: "user-1" })], applyLocal));

    renderDetail();

    fireEvent.press(screen.getByTestId("task-detail-reassign"));
    fireEvent.press(screen.getByTestId("member-picker-member-user-2"));

    expect(mockReassignOccurrence).toHaveBeenCalledWith("occ-1", "user-2");
    expect(applyLocal).toHaveBeenCalled();
    expect(screen.queryByTestId("member-picker-sheet")).toBeNull();
  });

  test("'Pegar para mim' calls pickupOccurrence with the current user", () => {
    mockPickupOccurrence.mockResolvedValue(occurrence({ assignee: "user-1" }));
    const applyLocal = jest.fn();
    mockUseBoard.mockReturnValue(boardValue([occurrence({ assignee: "user-2" })], applyLocal));

    renderDetail();

    fireEvent.press(screen.getByTestId("task-detail-reassign"));
    fireEvent.press(screen.getByTestId("member-picker-pickup"));

    expect(mockPickupOccurrence).toHaveBeenCalledWith("occ-1");
    expect(applyLocal).toHaveBeenCalled();
  });

  test("reverts and shows a notice when reassign fails", async () => {
    mockReassignOccurrence.mockRejectedValue(new Error("network down"));
    mockUseBoard.mockReturnValue(boardValue([occurrence({ assignee: "user-1" })]));

    renderDetail();

    fireEvent.press(screen.getByTestId("task-detail-reassign"));

    await act(async () => {
      fireEvent.press(screen.getByTestId("member-picker-member-user-2"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("task-detail-error-banner")).toBeTruthy();
    expect(screen.getByText("Não foi possível reatribuir. Tente de novo.")).toBeTruthy();
  });
});
