import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { boardApi, type Occurrence } from "@/api/board";
import type { Environment } from "@/api/environments";
import type { Member } from "@/api/members";
import { useActiveEnvironment } from "@/env/useActiveEnvironment";
import { useMembers } from "@/env/useMembers";
import { ThemeProvider } from "@/theme/ThemeProvider";

import AgendaScreen from "../explore";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock("@/api/board", () => {
  const actual = jest.requireActual("@/api/board");
  return { ...actual, boardApi: { ...actual.boardApi, getWeek: jest.fn() } };
});

jest.mock("@/env/useActiveEnvironment", () => ({ useActiveEnvironment: jest.fn() }));
jest.mock("@/env/useMembers", () => ({ useMembers: jest.fn() }));

const mockUseActiveEnvironment = useActiveEnvironment as jest.Mock;
const mockUseMembers = useMembers as jest.Mock;
const mockGetWeek = boardApi.getWeek as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures — the loaded week is Mon 2026-07-27 .. Sun 2026-08-02 (system date
// per CLAUDE.md is 2026-07-28, a Tuesday, so "today" defaults selection there).
// ---------------------------------------------------------------------------

const env: Environment = {
  id: "env-a",
  name: "Casa da Rua Aurora",
  envType: "HOUSE",
  timezone: "America/Sao_Paulo",
  role: "ADMIN",
};

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

function renderScreen() {
  return render(
    <ThemeProvider>
      <AgendaScreen />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date(2026, 6, 28)); // Tue 28 Jul 2026
  mockUseActiveEnvironment.mockReturnValue({ active: env, loading: false, error: null });
  mockUseMembers.mockReturnValue({
    members: [marina],
    byId: new Map([["user-1", marina]]),
    loading: false,
    error: null,
  });
  mockGetWeek.mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
});

test("shows a loading state while the active environment resolves", () => {
  mockUseActiveEnvironment.mockReturnValue({ active: null, loading: true, error: null });

  renderScreen();

  expect(screen.getByText("A CASA EM DIA")).toBeTruthy();
});

test("shows a CTA to join an environment when there is none", () => {
  mockUseActiveEnvironment.mockReturnValue({ active: null, loading: false, error: null });

  renderScreen();

  expect(screen.getByTestId("no-environment-cta")).toBeTruthy();

  fireEvent.press(screen.getByText("Entrar com código"));
  expect(mockPush).toHaveBeenCalledWith("/(auth)/join");
});

test("loads the week containing today and lists today's occurrences, resolving the assignee via byId", async () => {
  mockGetWeek.mockResolvedValue([
    occurrence({ id: "today-1", date: "2026-07-28", title: "Tarefa de hoje" }),
    occurrence({ id: "tomorrow-1", date: "2026-07-29", title: "Tarefa de amanhã" }),
  ]);

  renderScreen();

  await waitFor(() => expect(mockGetWeek).toHaveBeenCalledWith("env-a", "2026-07-27"));
  expect(await screen.findByText("Tarefa de hoje")).toBeTruthy();
  expect(screen.queryByText("Tarefa de amanhã")).toBeNull();
  expect(screen.getByText("Marina")).toBeTruthy();
});

test("selecting a different day in the WeekStrip switches the list to that day", async () => {
  mockGetWeek.mockResolvedValue([
    occurrence({ id: "today-1", date: "2026-07-28", title: "Tarefa de hoje" }),
    occurrence({ id: "wed-1", date: "2026-07-29", title: "Tarefa de quarta" }),
  ]);

  renderScreen();
  expect(await screen.findByText("Tarefa de hoje")).toBeTruthy();

  fireEvent.press(screen.getByTestId("week-strip-day-2026-07-29"));

  expect(await screen.findByText("Tarefa de quarta")).toBeTruthy();
  expect(screen.queryByText("Tarefa de hoje")).toBeNull();
});

test("shows a friendly empty state when the selected day has no occurrences", async () => {
  mockGetWeek.mockResolvedValue([]);

  renderScreen();

  await waitFor(() => expect(mockGetWeek).toHaveBeenCalled());
  expect(await screen.findByTestId("agenda-day-empty")).toBeTruthy();
});

test("shows an error state with a retry that re-fetches the week", async () => {
  mockGetWeek.mockRejectedValueOnce(new Error("boom"));

  renderScreen();

  expect(await screen.findByTestId("agenda-error")).toBeTruthy();

  mockGetWeek.mockResolvedValueOnce([occurrence({ title: "Depois do retry" })]);
  fireEvent.press(screen.getByText("Tentar de novo"));

  expect(await screen.findByText("Depois do retry")).toBeTruthy();
});

test("selecting another day within the same loaded week does not re-fetch", async () => {
  mockGetWeek.mockResolvedValue([
    occurrence({ id: "today-1", date: "2026-07-28", title: "Tarefa de hoje" }),
    occurrence({ id: "sun-1", date: "2026-08-02", title: "Tarefa de domingo" }),
  ]);

  renderScreen();
  await waitFor(() => expect(mockGetWeek).toHaveBeenCalledTimes(1));

  fireEvent.press(screen.getByTestId("week-strip-day-2026-08-02")); // this week's Sunday
  expect(await screen.findByText("Tarefa de domingo")).toBeTruthy();

  // Same week (boardApi.weekStartISO("2026-08-02") === "2026-07-27" too) — no
  // extra request; `useAgendaWeek`'s own "changed weekStart refetches" case
  // is covered directly in src/env/__tests__/useAgendaWeek.test.tsx.
  expect(mockGetWeek).toHaveBeenCalledTimes(1);
});
