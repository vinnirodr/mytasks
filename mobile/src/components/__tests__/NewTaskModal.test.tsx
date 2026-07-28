import { act, fireEvent, render, screen } from "@testing-library/react-native";

import type { Environment } from "@/api/environments";
import type { Member } from "@/api/members";
import { tasksApi } from "@/api/tasks";
import { useActiveEnvironment } from "@/env/useActiveEnvironment";
import { useBoard } from "@/env/useBoard";
import { useMembers } from "@/env/useMembers";
import { ThemeProvider } from "@/theme/ThemeProvider";

import {
  canContinueStep1,
  createRoutine,
  DAY_CHIPS,
  isValidTime,
  NewTaskModal,
  toggleWeekday,
  weekdayName,
} from "../NewTaskModal";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/api/tasks", () => ({
  tasksApi: {
    createDefinition: jest.fn(),
    createRecurring: jest.fn(),
  },
}));

jest.mock("@/env/useActiveEnvironment", () => ({ useActiveEnvironment: jest.fn() }));
jest.mock("@/env/useBoard", () => ({ useBoard: jest.fn() }));
jest.mock("@/env/useMembers", () => ({ useMembers: jest.fn() }));

const mockUseActiveEnvironment = useActiveEnvironment as jest.Mock;
const mockUseBoard = useBoard as jest.Mock;
const mockUseMembers = useMembers as jest.Mock;
const mockCreateDefinition = tasksApi.createDefinition as jest.Mock;
const mockCreateRecurring = tasksApi.createRecurring as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const adminEnv: Environment = {
  id: "env-a",
  name: "Casa da Rua Aurora",
  envType: "HOUSE",
  timezone: "America/Sao_Paulo",
  role: "ADMIN",
};

const memberEnv: Environment = { ...adminEnv, role: "MEMBER" };

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

function renderModal(props: Partial<Parameters<typeof NewTaskModal>[0]> = {}) {
  return render(
    <ThemeProvider>
      <NewTaskModal visible onClose={jest.fn()} {...props} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseActiveEnvironment.mockReturnValue({
    environments: [adminEnv],
    active: adminEnv,
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
  mockUseBoard.mockReturnValue({ refetch: jest.fn() });
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe("DAY_CHIPS (label -> weekday mapping)", () => {
  test("visual order D S T Q Q S S maps to the backend's Monday-first weekday", () => {
    expect(DAY_CHIPS.map((chip) => chip.label)).toEqual(["D", "S", "T", "Q", "Q", "S", "S"]);
    expect(DAY_CHIPS.map((chip) => chip.weekday)).toEqual([6, 0, 1, 2, 3, 4, 5]);
  });
});

describe("weekdayName", () => {
  test("maps 0..6 to Segunda..Domingo", () => {
    expect(weekdayName(0)).toBe("Segunda");
    expect(weekdayName(2)).toBe("Quarta");
    expect(weekdayName(6)).toBe("Domingo");
  });
});

describe("isValidTime", () => {
  test.each(["00:00", "09:30", "23:59"])("accepts %s", (value) => {
    expect(isValidTime(value)).toBe(true);
  });

  test.each(["24:00", "12:60", "9:30", "12:5", "", "abc", "12:30:00"])("rejects %s", (value) => {
    expect(isValidTime(value)).toBe(false);
  });
});

describe("toggleWeekday", () => {
  test("adds a weekday not yet selected", () => {
    expect(toggleWeekday([0], 2)).toEqual([0, 2]);
  });

  test("removes a weekday already selected", () => {
    expect(toggleWeekday([0, 2], 0)).toEqual([2]);
  });
});

describe("canContinueStep1", () => {
  const base = { title: "Lavar louça", assignee: "user-1", weekdays: [0], time: "08:00" };

  test("true when every field is filled and time is valid", () => {
    expect(canContinueStep1(base)).toBe(true);
  });

  test("false without a title", () => {
    expect(canContinueStep1({ ...base, title: "   " })).toBe(false);
  });

  test("false without any weekday", () => {
    expect(canContinueStep1({ ...base, weekdays: [] })).toBe(false);
  });

  test("false without an assignee", () => {
    expect(canContinueStep1({ ...base, assignee: null })).toBe(false);
  });

  test("false with an invalid time", () => {
    expect(canContinueStep1({ ...base, time: "9:3" })).toBe(false);
  });
});

describe("createRoutine (orchestration)", () => {
  const api = { createDefinition: jest.fn(), createRecurring: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("creates one definition then one recurring task per weekday", async () => {
    api.createDefinition.mockResolvedValue({ id: "def-1", name: "Lavar louça", icon: "" });
    api.createRecurring.mockImplementation((_envId, input) =>
      Promise.resolve({ id: `rt-${input.weekday}`, ...input, active: true }),
    );

    const result = await createRoutine(api, "env-a", {
      title: "Lavar louça",
      assignee: "user-1",
      weekdays: [0, 2],
      time: "08:00",
    });

    expect(api.createDefinition).toHaveBeenCalledTimes(1);
    expect(api.createDefinition).toHaveBeenCalledWith("env-a", { name: "Lavar louça", icon: "" });

    expect(api.createRecurring).toHaveBeenCalledTimes(2);
    expect(api.createRecurring).toHaveBeenCalledWith("env-a", {
      taskDefinition: "def-1",
      weekday: 0,
      time: "08:00",
      assignee: "user-1",
    });
    expect(api.createRecurring).toHaveBeenCalledWith("env-a", {
      taskDefinition: "def-1",
      weekday: 2,
      time: "08:00",
      assignee: "user-1",
    });

    expect(result.definitionId).toBe("def-1");
    expect(result.created).toHaveLength(2);
    expect(result.failedWeekdays).toEqual([]);
  });

  test("collects failed weekdays without aborting the others", async () => {
    api.createDefinition.mockResolvedValue({ id: "def-1", name: "X", icon: "" });
    api.createRecurring.mockImplementation((_envId, input) =>
      input.weekday === 2
        ? Promise.reject(new Error("boom"))
        : Promise.resolve({ id: `rt-${input.weekday}`, ...input, active: true }),
    );

    const result = await createRoutine(api, "env-a", {
      title: "X",
      assignee: "user-1",
      weekdays: [0, 2, 4],
      time: "08:00",
    });

    expect(result.created).toHaveLength(2);
    expect(result.failedWeekdays).toEqual([2]);
  });

  test("propagates a createDefinition rejection", async () => {
    api.createDefinition.mockRejectedValue(new Error("nope"));

    await expect(
      createRoutine(api, "env-a", { title: "X", assignee: "user-1", weekdays: [0], time: "08:00" }),
    ).rejects.toThrow("nope");
    expect(api.createRecurring).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Admin gate
// ---------------------------------------------------------------------------

test("renders nothing when not visible", () => {
  renderModal({ visible: false });
  expect(screen.queryByTestId("new-task-modal")).toBeNull();
});

test("non-admin sees the notice, no form, and never calls tasksApi", () => {
  mockUseActiveEnvironment.mockReturnValue({
    environments: [memberEnv],
    active: memberEnv,
    setActive: jest.fn(),
    loading: false,
    error: null,
    reload: jest.fn(),
  });

  renderModal();

  expect(screen.getByText("Só administradores definem a rotina")).toBeTruthy();
  expect(screen.queryByText("Quem faz")).toBeNull();
  expect(screen.queryByTestId("new-task-continue")).toBeNull();
  expect(mockCreateDefinition).not.toHaveBeenCalled();
  expect(mockCreateRecurring).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText("Fechar"));
});

test("no active environment also shows the admin notice", () => {
  mockUseActiveEnvironment.mockReturnValue({
    environments: [],
    active: null,
    setActive: jest.fn(),
    loading: false,
    error: null,
    reload: jest.fn(),
  });

  renderModal();

  expect(screen.getByText("Só administradores definem a rotina")).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Step 1 validation
// ---------------------------------------------------------------------------

describe("step 1 validation", () => {
  test("Continuar starts disabled", () => {
    renderModal();
    expect(screen.getByTestId("new-task-continue").props.accessibilityState.disabled).toBe(true);
  });

  test("enables once title, one day, one responsável, and a valid time are all set", () => {
    renderModal();

    fireEvent.changeText(screen.getByPlaceholderText("Nome da tarefa"), "Lavar louça");
    fireEvent.press(screen.getByTestId("assignee-chip-user-1"));
    fireEvent.press(screen.getByTestId("day-chip-0"));
    fireEvent.changeText(screen.getByPlaceholderText("HH:MM"), "08:00");

    expect(screen.getByTestId("new-task-continue").props.accessibilityState.disabled).toBe(false);
  });

  test("stays disabled with an invalid time", () => {
    renderModal();

    fireEvent.changeText(screen.getByPlaceholderText("Nome da tarefa"), "Lavar louça");
    fireEvent.press(screen.getByTestId("assignee-chip-user-1"));
    fireEvent.press(screen.getByTestId("day-chip-0"));
    fireEvent.changeText(screen.getByPlaceholderText("HH:MM"), "9:3");

    expect(screen.getByTestId("new-task-continue").props.accessibilityState.disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Day-label -> weekday mapping through the actual UI
// ---------------------------------------------------------------------------

function fillStep1AndContinue({
  title = "Lavar louça",
  assigneeUserId = "user-1",
  weekdayTestIds = ["day-chip-0"],
  time = "08:00",
}: {
  title?: string;
  assigneeUserId?: string;
  weekdayTestIds?: string[];
  time?: string;
} = {}) {
  fireEvent.changeText(screen.getByPlaceholderText("Nome da tarefa"), title);
  fireEvent.press(screen.getByTestId(`assignee-chip-${assigneeUserId}`));
  weekdayTestIds.forEach((testId) => fireEvent.press(screen.getByTestId(testId)));
  fireEvent.changeText(screen.getByPlaceholderText("HH:MM"), time);
  fireEvent.press(screen.getByTestId("new-task-continue"));
}

describe("confirming (step 2)", () => {
  test("Segunda + Quarta send weekday 0 and 2", async () => {
    mockCreateDefinition.mockResolvedValue({ id: "def-1", name: "Lavar louça", icon: "" });
    mockCreateRecurring.mockImplementation((_envId, input) =>
      Promise.resolve({ id: `rt-${input.weekday}`, ...input, active: true }),
    );

    renderModal();
    fillStep1AndContinue({ weekdayTestIds: ["day-chip-0", "day-chip-2"] });

    await act(async () => {
      fireEvent.press(screen.getByTestId("new-task-confirm"));
      await Promise.resolve();
      await Promise.resolve();
    });

    const weekdaysSent = mockCreateRecurring.mock.calls.map(([, input]) => input.weekday);
    expect(weekdaysSent.sort()).toEqual([0, 2]);
  });

  test("calls createDefinition once and createRecurring N times, then closes and refetches on success", async () => {
    const refetch = jest.fn();
    mockUseBoard.mockReturnValue({ refetch });
    mockCreateDefinition.mockResolvedValue({ id: "def-1", name: "Lavar louça", icon: "" });
    mockCreateRecurring.mockImplementation((_envId, input) =>
      Promise.resolve({ id: `rt-${input.weekday}`, ...input, active: true }),
    );
    const onClose = jest.fn();

    renderModal({ onClose });
    fillStep1AndContinue({
      title: "Lavar louça",
      assigneeUserId: "user-2",
      weekdayTestIds: ["day-chip-0", "day-chip-2", "day-chip-4"],
      time: "07:15",
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId("new-task-confirm"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockCreateDefinition).toHaveBeenCalledTimes(1);
    expect(mockCreateDefinition).toHaveBeenCalledWith("env-a", { name: "Lavar louça", icon: "" });

    expect(mockCreateRecurring).toHaveBeenCalledTimes(3);
    for (const call of mockCreateRecurring.mock.calls) {
      expect(call[1]).toMatchObject({ taskDefinition: "def-1", assignee: "user-2", time: "07:15" });
    }

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a failed createDefinition shows a notice and stays on step 2", async () => {
    mockCreateDefinition.mockRejectedValue(new Error("network down"));
    const onClose = jest.fn();

    renderModal({ onClose });
    fillStep1AndContinue();

    await act(async () => {
      fireEvent.press(screen.getByTestId("new-task-confirm"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("new-task-error-banner")).toBeTruthy();
    expect(screen.getByText("Não foi possível criar a tarefa. Tente de novo.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("new-task-summary")).toBeTruthy();
  });

  test("a partial createRecurring failure shows a notice, keeps successes, and doesn't close silently", async () => {
    mockCreateDefinition.mockResolvedValue({ id: "def-1", name: "Lavar louça", icon: "" });
    mockCreateRecurring.mockImplementation((_envId, input) =>
      input.weekday === 2
        ? Promise.reject(new Error("boom"))
        : Promise.resolve({ id: `rt-${input.weekday}`, ...input, active: true }),
    );
    const onClose = jest.fn();
    const refetch = jest.fn();
    mockUseBoard.mockReturnValue({ refetch });

    renderModal({ onClose });
    fillStep1AndContinue({ weekdayTestIds: ["day-chip-0", "day-chip-2"] });

    await act(async () => {
      fireEvent.press(screen.getByTestId("new-task-confirm"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("new-task-error-banner")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });

  test("voltar returns to step 1 without losing the entered data", () => {
    renderModal();
    fillStep1AndContinue({ title: "Lavar louça" });

    expect(screen.getByTestId("new-task-summary")).toBeTruthy();

    fireEvent.press(screen.getByTestId("new-task-back"));

    expect(screen.getByDisplayValue("Lavar louça")).toBeTruthy();
  });

  test("closing resets the form for next time", () => {
    const onClose = jest.fn();
    const { rerender } = renderModal({ onClose });

    fillStep1AndContinue({ title: "Lavar louça" });
    expect(screen.getByTestId("new-task-summary")).toBeTruthy();

    fireEvent.press(screen.getByTestId("new-task-close"));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <ThemeProvider>
        <NewTaskModal visible onClose={onClose} />
      </ThemeProvider>,
    );

    expect(screen.queryByTestId("new-task-summary")).toBeNull();
    expect(screen.getByPlaceholderText("Nome da tarefa").props.value).toBe("");
  });
});
