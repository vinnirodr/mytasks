/**
 * Organizados — TaskCard
 *
 * Daily-board row (docs/design/handoff/README.md, "Quadro do dia"): a
 * `radius.task` (22) surface with a 30px `TaskCheckbox` at the leading edge,
 * a title + Mono metadata line in the middle, and a 34px `Avatar` for the
 * assignee at the trailing edge.
 *
 * Status → visuals (per the 6d-task-5 brief, since the card communicates
 * state through the checkbox/color rather than a `StatusChip`):
 *  - DONE: checkbox `done`, title struck through + faint, metadata "FEITO …".
 *  - POSTPONED: checkbox `deferred`, whole card at 0.72 opacity, "ADIADA".
 *  - LATE: `dangerBg` fill, metadata in `danger`; checkbox stays `idle`
 *    (TaskCheckbox has no danger-tinted ring — see the task-5 report for
 *    why that's an acceptable approximation rather than a component change).
 *  - PENDING/MISSED: default `idle` checkbox, formatted time or "SEM HORÁRIO".
 *
 * Only non-DONE occurrences call `onToggleComplete` when the checkbox is
 * pressed — the backend has no "un-complete" action, so a DONE checkbox is
 * inert by design (brief: "mantenha o checkbox de tarefas DONE inerte").
 */

import { Pressable, View } from "react-native";

import type { Occurrence, OccurrenceStatus } from "@/api/board";
import type { Member } from "@/api/members";
import { useTheme } from "@/theme/useTheme";

import { Avatar } from "./Avatar";
import { TaskCheckbox, type TaskCheckboxState } from "./TaskCheckbox";
import { Mono, Text } from "./Text";

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing without rendering)
// ---------------------------------------------------------------------------

export function checkboxStateForStatus(status: OccurrenceStatus): TaskCheckboxState {
  switch (status) {
    case "DONE":
      return "done";
    case "POSTPONED":
      return "deferred";
    case "PENDING":
    case "LATE":
    case "MISSED":
    default:
      return "idle";
  }
}

/** `"HH:MM:SS"` → `"HH:MM"`. */
function formatHHMM(time: string): string {
  return time.slice(0, 5);
}

/** An ISO datetime (`completedAt`) → local `"HH:MM"`. */
function formatIsoTime(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Builds the card's Mono metadata line (`Mono` uppercases it for display). */
export function taskCardMeta(occurrence: Occurrence, assigneeName?: string): string {
  let base: string;

  if (occurrence.status === "DONE") {
    const doneTime = occurrence.completedAt
      ? formatIsoTime(occurrence.completedAt)
      : occurrence.time
        ? formatHHMM(occurrence.time)
        : null;
    base = doneTime ? `Feito ${doneTime}` : "Feito";
  } else if (occurrence.status === "POSTPONED") {
    base = "Adiada";
  } else {
    base = occurrence.time ? formatHHMM(occurrence.time) : "Sem horário";
  }

  return assigneeName ? `${base} · ${assigneeName}` : base;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type TaskCardProps = {
  occurrence: Occurrence;
  member?: Member;
  onToggleComplete: () => void;
  onPress: () => void;
};

export function TaskCard({ occurrence, member, onToggleComplete, onPress }: TaskCardProps) {
  const theme = useTheme();
  const { colors, radius, shadow, isDark } = theme;

  const isDone = occurrence.status === "DONE";
  const isLate = occurrence.status === "LATE";
  const isPostponed = occurrence.status === "POSTPONED";

  const checkboxState = checkboxStateForStatus(occurrence.status);
  const meta = taskCardMeta(occurrence, member?.displayName);

  return (
    <Pressable
      testID={`task-card-${occurrence.id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          borderRadius: radius.task,
          paddingVertical: 16,
          paddingHorizontal: 18,
          backgroundColor: isLate ? colors.dangerBg : colors.surface,
          opacity: isPostponed ? 0.72 : 1,
        },
        isDark ? undefined : shadow.card,
      ]}
    >
      <TaskCheckbox
        state={checkboxState}
        onToggle={() => {
          if (!isDone) onToggleComplete();
        }}
      />
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          variant="title"
          weight="bold"
          size={17}
          color={isDone ? "inkFaint" : "ink"}
          style={isDone ? { textDecorationLine: "line-through" } : undefined}
        >
          {occurrence.title}
        </Text>
        <Mono size={11.5} color={isLate ? "danger" : "inkFaint"}>
          {meta}
        </Mono>
      </View>
      <Avatar name={member?.displayName} initials={member?.initials} size={34} />
    </Pressable>
  );
}
