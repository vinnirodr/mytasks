import { render, screen } from "@testing-library/react-native";

import type { Occurrence } from "@/api/board";
import type { Member } from "@/api/members";
import { ThemeProvider } from "@/theme/ThemeProvider";

import { AgendaList, barColorForStatus, partitionByTime } from "../AgendaList";

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

function renderList(occurrences: Occurrence[], byId: Map<string, Member> = new Map()) {
  return render(
    <ThemeProvider>
      <AgendaList occurrences={occurrences} byId={byId} />
    </ThemeProvider>,
  );
}

describe("partitionByTime", () => {
  test("splits timed/untimed while preserving relative order in each group", () => {
    const timedA = occurrence({ id: "a", time: "08:00:00" });
    const untimedA = occurrence({ id: "b", time: null });
    const timedB = occurrence({ id: "c", time: "09:00:00" });
    const untimedB = occurrence({ id: "d", time: null });

    const { timed, untimed } = partitionByTime([timedA, untimedA, timedB, untimedB]);
    expect(timed.map((o) => o.id)).toEqual(["a", "c"]);
    expect(untimed.map((o) => o.id)).toEqual(["b", "d"]);
  });
});

describe("barColorForStatus", () => {
  test("LATE is danger, DONE is forest (day) / accent (night)", () => {
    expect(barColorForStatus("LATE", false)).toBe("#C7381F");
    expect(barColorForStatus("DONE", false)).toBe("#123B2E");
    expect(barColorForStatus("DONE", true)).toBe("#F2C744");
  });

  test("PENDING/MISSED/POSTPONED share the neutral idle tone", () => {
    expect(barColorForStatus("PENDING", false)).toBe("#C9BFB2");
    expect(barColorForStatus("MISSED", false)).toBe("#C9BFB2");
    expect(barColorForStatus("POSTPONED", false)).toBe("#C9BFB2");
  });
});

test("renders timed items before the 'Sem horário' separator, untimed after", () => {
  const morning = occurrence({ id: "occ-1", title: "Regar plantas", time: "08:00:00" });
  const noTime = occurrence({ id: "occ-2", title: "Organizar armário", time: null });

  renderList([morning, noTime], new Map([["user-1", marina]]));

  expect(screen.getByText("SEM HORÁRIO")).toBeTruthy();
  expect(screen.getByText("Regar plantas")).toBeTruthy();
  expect(screen.getByText("Organizar armário")).toBeTruthy();
  expect(screen.getByText("08:00")).toBeTruthy();
});

test("does not render the separator when every item has a time", () => {
  renderList([occurrence({ time: "08:00:00" })]);
  expect(screen.queryByText("SEM HORÁRIO")).toBeNull();
});

test("resolves the assignee's name and initials via byId", () => {
  renderList([occurrence({ assignee: "user-1" })], new Map([["user-1", marina]]));

  expect(screen.getByText("Marina")).toBeTruthy();
  expect(screen.getByText("MA")).toBeTruthy();
});

test("falls back to a placeholder when the assignee can't be resolved", () => {
  renderList([occurrence({ assignee: null })]);
  expect(screen.getByText("Sem responsável")).toBeTruthy();
});

test("POSTPONED renders a dashed, unfilled card (no status bar)", () => {
  renderList([occurrence({ id: "occ-9", status: "POSTPONED" })]);

  const card = screen.getByTestId("agenda-card-occ-9");
  const flatStyle = Array.isArray(card.props.style)
    ? Object.assign({}, ...card.props.style)
    : card.props.style;

  expect(flatStyle.borderStyle).toBe("dashed");
  expect(flatStyle.backgroundColor).toBe("transparent");
  expect(screen.queryByTestId("agenda-bar-occ-9")).toBeNull();
});

test("LATE renders the status bar in danger", () => {
  renderList([occurrence({ id: "occ-7", status: "LATE" })]);

  const bar = screen.getByTestId("agenda-bar-occ-7");
  const flatStyle = Array.isArray(bar.props.style)
    ? Object.assign({}, ...bar.props.style)
    : bar.props.style;

  expect(flatStyle.backgroundColor).toBe("#C7381F");
});
