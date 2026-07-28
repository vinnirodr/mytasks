import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useState } from "react";

import type { AuthUser } from "@/api/auth";
import { boardApi, type Occurrence } from "@/api/board";
import type { Environment } from "@/api/environments";
import type { Member } from "@/api/members";
import { deriveBoard, type BoardValue } from "@/env/BoardProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";

import { useAuth } from "@/auth/useAuth";
import { useActiveEnvironment } from "@/env/useActiveEnvironment";
import { useBoard } from "@/env/useBoard";
import { useMembers } from "@/env/useMembers";

import HomeScreen from "../index";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock("@/api/board", () => {
  const actual = jest.requireActual("@/api/board");
  return {
    ...actual,
    boardApi: { ...actual.boardApi, completeOccurrence: jest.fn() },
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

function staticBoard(overrides: Partial<BoardValue> = {}): BoardValue {
  const occurrences = overrides.occurrences ?? [];
  const derived = deriveBoard(occurrences);
  return {
    occurrences,
    heroStats: derived.heroStats,
    sections: derived.sections,
    loading: false,
    error: null,
    refetch: jest.fn(),
    applyLocal: jest.fn(),
    connected: false,
    ...overrides,
  };
}

/** A live (stateful) board mock, so applyLocal actually reorders/re-derives for the undo flow. */
function useLiveBoard(initial: Occurrence[]) {
  const [occurrences, setOccurrences] = useState(initial);
  const derived = deriveBoard(occurrences);
  return {
    occurrences,
    heroStats: derived.heroStats,
    sections: derived.sections,
    loading: false,
    error: null,
    refetch: jest.fn(),
    applyLocal: (updater: (prev: Occurrence[]) => Occurrence[]) =>
      setOccurrences((prev) => updater(prev)),
    connected: false,
  };
}

function renderScreen() {
  return render(
    <ThemeProvider>
      <HomeScreen />
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
    members: [marina],
    byId: new Map([["user-1", marina]]),
    loading: false,
    error: null,
  });
  mockUseBoard.mockReturnValue(staticBoard());
  // Sane default so an undo-window timer that fires (including the
  // flush-on-unmount safety net) never calls `.catch()` on `undefined`;
  // tests exercising the error path override this with mockRejectedValue.
  mockCompleteOccurrence.mockResolvedValue(occurrence({ status: "DONE" }));
});

// ---------------------------------------------------------------------------
// Header + hero + sections
// ---------------------------------------------------------------------------

test("renders the header greeting and the hero fraction/pct from the board", () => {
  mockUseBoard.mockReturnValue(
    staticBoard({
      occurrences: [
        occurrence({ id: "a", status: "DONE" }),
        occurrence({ id: "b", status: "PENDING" }),
        occurrence({ id: "c", status: "PENDING" }),
      ],
    }),
  );

  renderScreen();

  expect(screen.getByText(/Marina/)).toBeTruthy();
  expect(screen.getByText("33%")).toBeTruthy();
  // The fraction is two nested <Text> — the outer node's computed text
  // content merges both ("1" + the inner "/3"), so assert the merge.
  expect(screen.getByText("1/3")).toBeTruthy();
});

test("splits occurrences into Atrasadas/Hoje and renders a TaskCard per occurrence", () => {
  mockUseBoard.mockReturnValue(
    staticBoard({
      occurrences: [
        occurrence({ id: "late-1", status: "LATE", title: "Tirar o lixo reciclável" }),
        occurrence({ id: "today-1", status: "PENDING", title: "Lavar a louça do almoço" }),
      ],
    }),
  );

  renderScreen();

  expect(screen.getByText("Atrasadas")).toBeTruthy();
  expect(screen.getByText("Hoje")).toBeTruthy();
  expect(screen.getByTestId("task-card-late-1")).toBeTruthy();
  expect(screen.getByTestId("task-card-today-1")).toBeTruthy();
});

test("hides the Atrasadas section when there are no late occurrences", () => {
  mockUseBoard.mockReturnValue(
    staticBoard({ occurrences: [occurrence({ id: "today-1", status: "PENDING" })] }),
  );

  renderScreen();

  expect(screen.queryByText("Atrasadas")).toBeNull();
  expect(screen.getByText("Hoje")).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Live WS indicator (Plan 6d, Task 7)
// ---------------------------------------------------------------------------

test("the hero's live dot reflects board.connected", () => {
  mockUseBoard.mockReturnValue(staticBoard({ connected: false }));
  const disconnected = renderScreen();
  const disconnectedStyle = disconnected.getByTestId("live-dot").props.style;
  disconnected.unmount();

  mockUseBoard.mockReturnValue(staticBoard({ connected: true }));
  const connected = renderScreen();
  const connectedStyle = connected.getByTestId("live-dot").props.style;

  expect(connectedStyle).not.toEqual(disconnectedStyle);
});

// ---------------------------------------------------------------------------
// Empty / loading / error states
// ---------------------------------------------------------------------------

test("shows a CTA to join an environment when there is no active environment", () => {
  mockUseActiveEnvironment.mockReturnValue({
    environments: [],
    active: null,
    setActive: jest.fn(),
    loading: false,
    error: null,
    reload: jest.fn(),
  });

  renderScreen();

  expect(screen.getByTestId("no-environment-cta")).toBeTruthy();
  fireEvent.press(screen.getByText("Entrar com código"));
  expect(mockPush).toHaveBeenCalledWith("/(auth)/join");
});

test("shows a friendly empty state (keeping the 0/0 hero) when there are no occurrences today", () => {
  renderScreen();

  expect(screen.getByTestId("board-empty")).toBeTruthy();
  expect(screen.getByText("0/0")).toBeTruthy();
});

test("shows a retry button wired to refetch when the board errors", () => {
  const refetch = jest.fn();
  mockUseBoard.mockReturnValue(staticBoard({ error: new Error("boom"), refetch }));

  renderScreen();

  fireEvent.press(screen.getByText("Tentar de novo"));
  expect(refetch).toHaveBeenCalledTimes(1);
});

// ---------------------------------------------------------------------------
// Optimistic complete + 5s undo
// ---------------------------------------------------------------------------

describe("completing a task", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("tapping the checkbox marks it DONE locally, moves it to the end, and shows Desfazer", () => {
    mockUseBoard.mockImplementation(() =>
      useLiveBoard([
        occurrence({ id: "a", title: "Regar as plantas", status: "PENDING" }),
        occurrence({ id: "b", title: "Lavar a louça", status: "PENDING" }),
      ]),
    );

    renderScreen();

    act(() => {
      fireEvent.press(screen.getAllByTestId("task-checkbox")[0]!);
    });

    expect(screen.getByText("Desfazer")).toBeTruthy();
    expect(mockCompleteOccurrence).not.toHaveBeenCalled();

    const cards = screen.getAllByText(/Regar as plantas|Lavar a louça/);
    expect(cards[cards.length - 1]!.props.children).toBe("Regar as plantas");
  });

  test("after 5s without undo, completeOccurrence is called", async () => {
    mockCompleteOccurrence.mockResolvedValue(occurrence({ id: "a", status: "DONE" }));
    mockUseBoard.mockImplementation(() =>
      useLiveBoard([occurrence({ id: "a", title: "Regar as plantas", status: "PENDING" })]),
    );

    renderScreen();

    act(() => {
      fireEvent.press(screen.getAllByTestId("task-checkbox")[0]!);
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockCompleteOccurrence).toHaveBeenCalledWith("a");
    expect(screen.queryByText("Desfazer")).toBeNull();
  });

  test("pressing Desfazer cancels the timer, never calls the API, and restores the task", async () => {
    mockUseBoard.mockImplementation(() =>
      useLiveBoard([occurrence({ id: "a", title: "Regar as plantas", status: "PENDING" })]),
    );

    renderScreen();

    act(() => {
      fireEvent.press(screen.getAllByTestId("task-checkbox")[0]!);
    });

    act(() => {
      fireEvent.press(screen.getByTestId("undo-button"));
    });

    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    expect(mockCompleteOccurrence).not.toHaveBeenCalled();
    expect(screen.queryByText("Desfazer")).toBeNull();
  });

  test("an API error reverts the optimistic completion and shows a dismissible notice", async () => {
    mockCompleteOccurrence.mockRejectedValue(new Error("network down"));
    mockUseBoard.mockImplementation(() =>
      useLiveBoard([occurrence({ id: "a", title: "Regar as plantas", status: "PENDING" })]),
    );

    renderScreen();

    act(() => {
      fireEvent.press(screen.getAllByTestId("task-checkbox")[0]!);
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.queryByText("Desfazer")).toBeNull());
    expect(mockCompleteOccurrence).toHaveBeenCalledWith("a");
    expect(screen.getByText("Regar as plantas")).toBeTruthy();

    // The missing-feedback finding: a failed completion must not be silent.
    expect(screen.getByTestId("complete-error-banner")).toBeTruthy();
    expect(screen.getByText("Não foi possível concluir. Tente de novo.")).toBeTruthy();

    fireEvent.press(screen.getByTestId("complete-error-dismiss"));
    expect(screen.queryByTestId("complete-error-banner")).toBeNull();
  });

  test("retrying a completion clears a stale error notice", async () => {
    mockCompleteOccurrence.mockRejectedValueOnce(new Error("network down"));
    mockUseBoard.mockImplementation(() =>
      useLiveBoard([
        occurrence({ id: "a", title: "Regar as plantas", status: "PENDING" }),
        occurrence({ id: "b", title: "Lavar a louça", status: "PENDING" }),
      ]),
    );

    renderScreen();

    act(() => {
      fireEvent.press(screen.getAllByTestId("task-checkbox")[0]!);
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("complete-error-banner")).toBeTruthy();

    mockCompleteOccurrence.mockResolvedValueOnce(occurrence({ id: "b", status: "DONE" }));

    act(() => {
      fireEvent.press(screen.getAllByTestId("task-checkbox")[0]!);
    });

    expect(screen.queryByTestId("complete-error-banner")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Placeholder actions
// ---------------------------------------------------------------------------

test("bell/avatar/FAB placeholders don't crash when pressed", () => {
  renderScreen();

  fireEvent.press(screen.getByTestId("notifications-button"));
  fireEvent.press(screen.getByTestId("profile-avatar-button"));
  fireEvent.press(screen.getByTestId("fab-new-task"));
});

// ---------------------------------------------------------------------------
// Hosting the TaskDetail modal (Plan 6d, Task 6)
// ---------------------------------------------------------------------------

describe("task detail hosting", () => {
  test("tapping a TaskCard opens TaskDetail instead of pushing a route", () => {
    mockUseBoard.mockReturnValue(
      staticBoard({
        occurrences: [occurrence({ id: "today-1", title: "Lavar a louça do almoço" })],
      }),
    );

    renderScreen();

    expect(screen.queryByTestId("task-detail-modal")).toBeNull();

    fireEvent.press(screen.getByTestId("task-card-today-1"));

    expect(screen.getByTestId("task-detail-modal")).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining("/task/"));
  });

  test("closing TaskDetail clears the selection", () => {
    mockUseBoard.mockReturnValue(
      staticBoard({ occurrences: [occurrence({ id: "today-1" })] }),
    );

    renderScreen();

    fireEvent.press(screen.getByTestId("task-card-today-1"));
    expect(screen.getByTestId("task-detail-modal")).toBeTruthy();

    fireEvent.press(screen.getByTestId("task-detail-close"));

    expect(screen.queryByTestId("task-detail-modal")).toBeNull();
  });
});
