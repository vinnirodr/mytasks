/**
 * Organizados — WeekStrip
 *
 * Agenda screen (docs/design/handoff/README.md, screen 9 "Agenda"): a
 * 76px-tall, radius-20 day strip. Renders the 7 days (Mon..Sun) of the
 * currently loaded week — the handoff's literal "faixa de 5 dias" describes
 * a month-scroller that can show neighboring-week days without a background;
 * since this slice only ever has one week's occurrences loaded at a time
 * (`boardApi.getWeek`), showing all 7 loaded days avoids inventing a
 * secondary out-of-week fetch/scroll just to center a 5-cell window (see the
 * task report for the full 5-vs-7 rationale).
 *
 * Selected-day styling mirrors `Chip`'s `day` variant exactly (same
 * forest/creme + `butter` dot logic) — that component's own doc comment
 * already names "the Agenda strip" as one of its call sites, but its 46px
 * square shape is sized for the task-creation "quando" step, not this
 * screen's taller 76px cell, so this is a sibling component rather than a
 * `Chip` reuse.
 */

import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

import { localISO, weekDates, weekdayAbbr } from "./date";
import { Mono, Text } from "../Text";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WeekStripProps = {
  /** Monday (`YYYY-MM-DD`) of the week to render — see `boardApi.weekStartISO()`. */
  weekStart: string;
  /** Selected day (`YYYY-MM-DD`); highlighted if it falls within this week. */
  selectedISO: string;
  onSelect: (dateISO: string) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WeekStrip({ weekStart, selectedISO, onSelect }: WeekStripProps) {
  const theme = useTheme();
  const { colors, isDark } = theme;

  const days = weekDates(weekStart);

  // Night has no dedicated "selected day" hex in the handoff — same
  // forest-becomes-structure substitution `Chip`'s `day` variant already
  // uses ("o verde-mata vira estrutura"): the creme `ink` tone stands in for
  // `forest` as the selection fill at night, with `bg` (the darkest night
  // token) as its high-contrast label color.
  const selectedBg = isDark ? colors.ink : colors.forest;
  const selectedText = isDark ? colors.bg : colors.onForest;

  return (
    <View style={styles.row} testID="week-strip">
      {days.map((date) => {
        const iso = localISO(date);
        const selected = iso === selectedISO;

        return (
          <Pressable
            key={iso}
            testID={`week-strip-day-${iso}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(iso)}
            style={[
              styles.cell,
              {
                borderRadius: 20,
                backgroundColor: selected ? selectedBg : "transparent",
              },
            ]}
          >
            <Mono size={11} color={selected ? selectedText : "inkFaint"}>
              {weekdayAbbr(date)}
            </Mono>
            <Text variant="title" weight="bold" size={17} color={selected ? selectedText : "ink"}>
              {date.getDate()}
            </Text>
            {selected ? <View style={[styles.dot, { backgroundColor: colors.butter }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 6,
  },
  cell: {
    flex: 1,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    position: "absolute",
    bottom: 10,
    width: 5,
    height: 5,
    borderRadius: 999,
  },
});
