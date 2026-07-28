/**
 * Organizados — AgendaList
 *
 * Agenda screen (docs/design/handoff/README.md, screen 9 "Agenda"): the
 * selected day's occurrences, chronological, read-only (no checkbox/press
 * actions — that's the daily board's `TaskCard`, not this screen). Each row
 * is a 46px time column (blank once past the "SEM HORÁRIO" separator) plus a
 * card carrying a 4px vertical status-color bar; `POSTPONED` rows swap the
 * bar for a dashed, unfilled card border instead ("cartão tracejado sem
 * fundo") rather than a colored bar, since a postponed task has no single
 * "state color" to show — the dashing itself is the signal.
 *
 * Deliberately its own card (not `TaskCard` reuse, per the task brief) — the
 * daily board's card leads with a 30px tri-state checkbox and drives its own
 * complete/pickup actions; this one is read-only and leads with a time
 * column instead.
 */

import { StyleSheet, View } from "react-native";

import type { Occurrence, OccurrenceStatus } from "@/api/board";
import type { Member } from "@/api/members";
import { darkColors, lightColors } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

import { Avatar } from "../Avatar";
import { Caption, Mono, Text } from "../Text";

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing without rendering)
// ---------------------------------------------------------------------------

/** Splits a day's occurrences into timed/untimed, preserving the backend's own order in each group. */
export function partitionByTime(occurrences: Occurrence[]): {
  timed: Occurrence[];
  untimed: Occurrence[];
} {
  const timed: Occurrence[] = [];
  const untimed: Occurrence[] = [];

  for (const occurrence of occurrences) {
    if (occurrence.time) {
      timed.push(occurrence);
    } else {
      untimed.push(occurrence);
    }
  }

  return { timed, untimed };
}

/** `"HH:MM:SS"` → `"HH:MM"`. */
function formatHHMM(time: string): string {
  return time.slice(0, 5);
}

/**
 * The card's 4px status bar color. `DONE` mirrors `TaskCheckbox`/`StatusChip`'s
 * existing day/night split (`forest` day, `accent` night — night has no
 * separate "done" hex, `accent` is the only night accent per the handoff),
 * not a literal `butter` fill at night. `PENDING`/`MISSED` share a neutral
 * tone (the same `checkbox-idle`/`ink-faint` day/night pair `TaskCheckbox`
 * uses for its idle ring, since neither has a dedicated Agenda-bar hex of
 * its own).
 */
export function barColorForStatus(status: OccurrenceStatus, isDark: boolean): string {
  switch (status) {
    case "LATE":
      return isDark ? darkColors.danger : lightColors.danger;
    case "DONE":
      return isDark ? darkColors.accent : lightColors.forest;
    case "PENDING":
    case "MISSED":
    case "POSTPONED":
    default:
      return isDark ? darkColors.inkFaint : lightColors.checkboxIdle;
  }
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

type AgendaRowProps = {
  occurrence: Occurrence;
  member?: Member;
};

function AgendaRow({ occurrence, member }: AgendaRowProps) {
  const theme = useTheme();
  const { colors, isDark } = theme;

  const isPostponed = occurrence.status === "POSTPONED";
  const barColor = barColorForStatus(occurrence.status, isDark);
  const dashedBorderColor = isDark ? darkColors.borderStrong : lightColors.borderDashed;

  return (
    <View style={styles.row} testID={`agenda-row-${occurrence.id}`}>
      <View style={styles.timeColumn}>
        {occurrence.time ? <Mono size={13}>{formatHHMM(occurrence.time)}</Mono> : null}
      </View>

      <View
        testID={`agenda-card-${occurrence.id}`}
        style={[
          styles.card,
          {
            borderRadius: 16,
            backgroundColor: isPostponed ? "transparent" : colors.surface,
            borderWidth: isPostponed ? 1.5 : 0,
            borderStyle: isPostponed ? "dashed" : "solid",
            borderColor: isPostponed ? dashedBorderColor : "transparent",
          },
        ]}
      >
        {isPostponed ? null : (
          <View testID={`agenda-bar-${occurrence.id}`} style={[styles.bar, { backgroundColor: barColor }]} />
        )}
        <View style={styles.cardContent}>
          <Text variant="title" weight="bold" size={15.5}>
            {occurrence.title}
          </Text>
          <View style={styles.assigneeRow}>
            <Avatar name={member?.displayName} initials={member?.initials} size={22} />
            <Caption>{member?.displayName ?? "Sem responsável"}</Caption>
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export type AgendaListProps = {
  /** The selected day's occurrences, in the backend's own order. */
  occurrences: Occurrence[];
  /** Resolves `Occurrence.assignee` (a user id) to a `Member`, same as the daily board. */
  byId: Map<string, Member>;
};

export function AgendaList({ occurrences, byId }: AgendaListProps) {
  const { timed, untimed } = partitionByTime(occurrences);

  return (
    <View style={styles.list} testID="agenda-list">
      {timed.map((occurrence) => (
        <AgendaRow
          key={occurrence.id}
          occurrence={occurrence}
          member={occurrence.assignee ? byId.get(occurrence.assignee) : undefined}
        />
      ))}

      {untimed.length > 0 ? (
        <View style={styles.separator} testID="agenda-no-time-separator">
          <Mono size={11}>Sem horário</Mono>
        </View>
      ) : null}

      {untimed.map((occurrence) => (
        <AgendaRow
          key={occurrence.id}
          occurrence={occurrence}
          member={occurrence.assignee ? byId.get(occurrence.assignee) : undefined}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  timeColumn: {
    width: 46,
    paddingTop: 14,
    alignItems: "flex-start",
  },
  card: {
    flex: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  bar: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  assigneeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  separator: {
    paddingVertical: 4,
    paddingLeft: 56,
  },
});
