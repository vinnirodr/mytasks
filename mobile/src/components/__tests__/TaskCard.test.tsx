import { fireEvent, render, screen } from "@testing-library/react-native";

import type { Occurrence } from "@/api/board";
import type { Member } from "@/api/members";
import { ThemeProvider } from "@/theme/ThemeProvider";

import { checkboxStateForStatus, TaskCard, taskCardMeta } from "../TaskCard";

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

const marina: Member = {
  id: "mem-1",
  userId: "user-1",
  displayName: "Marina",
  initials: "MA",
  role: "ADMIN",
  isMe: true,
};

function renderCard(props: Partial<Parameters<typeof TaskCard>[0]> = {}) {
  return render(
    <ThemeProvider>
      <TaskCard
        occurrence={occurrence()}
        member={marina}
        onToggleComplete={jest.fn()}
        onPress={jest.fn()}
        {...props}
      />
    </ThemeProvider>,
  );
}

describe("checkboxStateForStatus", () => {
  test("maps DONE/POSTPONED/others", () => {
    expect(checkboxStateForStatus("DONE")).toBe("done");
    expect(checkboxStateForStatus("POSTPONED")).toBe("deferred");
    expect(checkboxStateForStatus("PENDING")).toBe("idle");
    expect(checkboxStateForStatus("LATE")).toBe("idle");
    expect(checkboxStateForStatus("MISSED")).toBe("idle");
  });
});

describe("taskCardMeta", () => {
  test("formats a pending occurrence's time and assignee", () => {
    expect(taskCardMeta(occurrence({ status: "PENDING", time: "14:00:00" }), "Marina")).toBe(
      "14:00 · Marina",
    );
  });

  test("falls back to 'Sem horário' when time is null", () => {
    expect(taskCardMeta(occurrence({ status: "PENDING", time: null }))).toBe("Sem horário");
  });

  test("prefixes 'Feito' with the completion time for DONE", () => {
    const meta = taskCardMeta(
      occurrence({ status: "DONE", completedAt: "2026-07-28T08:12:00" }),
      "Joana",
    );
    expect(meta).toBe("Feito 08:12 · Joana");
  });

  test("uses 'Adiada' for POSTPONED regardless of time", () => {
    expect(taskCardMeta(occurrence({ status: "POSTPONED", time: "09:00:00" }))).toBe("Adiada");
  });
});

test("renders the title and metadata, and resolves the assignee avatar via the member prop", () => {
  renderCard();

  expect(screen.getByText("Lavar a louça do almoço")).toBeTruthy();
  expect(screen.getByText("14:00 · MARINA")).toBeTruthy();
  expect(screen.getByText("MA")).toBeTruthy();
});

test("DONE cards render the title struck through and do not call onToggleComplete", () => {
  const onToggleComplete = jest.fn();
  renderCard({ occurrence: occurrence({ status: "DONE", completedAt: "2026-07-28T08:12:00" }), onToggleComplete });

  const title = screen.getByText("Lavar a louça do almoço");
  const flatStyle = Array.isArray(title.props.style)
    ? Object.assign({}, ...title.props.style)
    : title.props.style;
  expect(flatStyle.textDecorationLine).toBe("line-through");

  fireEvent.press(screen.getByTestId("task-checkbox"));
  expect(onToggleComplete).not.toHaveBeenCalled();
});

test("non-DONE cards call onToggleComplete when the checkbox is pressed", () => {
  const onToggleComplete = jest.fn();
  renderCard({ onToggleComplete });

  fireEvent.press(screen.getByTestId("task-checkbox"));
  expect(onToggleComplete).toHaveBeenCalledTimes(1);
});

test("pressing the card body calls onPress", () => {
  const onPress = jest.fn();
  renderCard({ onPress });

  fireEvent.press(screen.getByTestId("task-card-occ-1"));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test("LATE cards render with the danger metadata color", () => {
  renderCard({ occurrence: occurrence({ status: "LATE", time: "20:00:00" }) });

  const meta = screen.getByText("20:00 · MARINA");
  const flatStyle = Array.isArray(meta.props.style)
    ? Object.assign({}, ...meta.props.style)
    : meta.props.style;
  expect(flatStyle.color).toBe("#C7381F");
});

test("POSTPONED cards render at reduced opacity", () => {
  renderCard({ occurrence: occurrence({ status: "POSTPONED" }) });

  const card = screen.getByTestId("task-card-occ-1");
  const flatStyle = Array.isArray(card.props.style)
    ? Object.assign({}, ...card.props.style)
    : card.props.style;
  expect(flatStyle.opacity).toBe(0.72);
});
