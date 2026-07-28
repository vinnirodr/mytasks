/**
 * Organizados — Agenda (2nd tab, read-only)
 *
 * Plan 6e, Task 2. Replaces the Expo starter "Explore" screen (docs/design/
 * handoff/README.md, "9. Agenda") with a read-only weekly view: a `WeekStrip`
 * of the loaded week + a chronological `AgendaList` of the selected day.
 *
 * The route file/name stays `explore.tsx` / `/explore` deliberately — only
 * the tab *label* changes (`app-tabs.tsx`/`app-tabs.web.tsx`, "Explore" →
 * "Agenda"). `NativeTabs`/`expo-router/ui Tabs` only register routes
 * declared as tab triggers (see the 6d-task-6 report), so renaming the file
 * would mean re-declaring the trigger too — out of scope for this task,
 * which the brief calls out as the *only* permitted `app-tabs` change.
 *
 * No actions here (no complete/postpone/pickup/reassign) — this slice is
 * strictly read-only; those live on the daily board (`index.tsx`) and
 * `TaskDetail`.
 */

import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { router } from "expo-router";

import { weekStartISO } from "@/api/board";
import { AgendaList } from "@/components/agenda/AgendaList";
import { localISO, monthAbbr } from "@/components/agenda/date";
import { WeekStrip } from "@/components/agenda/WeekStrip";
import { Button } from "@/components/Button";
import { Splash } from "@/components/Splash";
import { Body, Display, Mono } from "@/components/Text";
import { useActiveEnvironment } from "@/env/useActiveEnvironment";
import { useAgendaWeek } from "@/env/useAgendaWeek";
import { useMembers } from "@/env/useMembers";
import { useTheme } from "@/theme/useTheme";

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function AgendaScreen() {
  const theme = useTheme();
  const { colors, spacing } = theme;

  const { active, loading: envLoading } = useActiveEnvironment();
  const { byId } = useMembers(active?.id);

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const selectedISO = localISO(selectedDate);
  const weekStart = useMemo(() => weekStartISO(selectedDate), [selectedDate]);

  const week = useAgendaWeek(active?.id, weekStart);

  const dayOccurrences = useMemo(
    () => week.occurrences.filter((occurrence) => occurrence.date === selectedISO),
    [week.occurrences, selectedISO],
  );

  const handleSelectDay = useCallback((iso: string) => {
    // `T00:00:00` local (not UTC) keeps the parsed date on the intended
    // calendar day regardless of device timezone offset.
    const [year, month, day] = iso.split("-").map(Number);
    setSelectedDate(new Date(year, (month ?? 1) - 1, day ?? 1));
  }, []);

  if (envLoading) {
    return <Splash />;
  }

  if (!active) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <SafeAreaView style={styles.centeredSafeArea}>
          <View
            testID="no-environment-cta"
            style={[styles.emptyState, { paddingHorizontal: spacing.screenX }]}
          >
            <Display size={28} style={styles.emptyStateTitle}>
              Você ainda não participa de um ambiente
            </Display>
            <Body color="inkMuted" style={styles.emptyStateBody}>
              Entre com um código de convite para começar a organizar as tarefas da casa.
            </Body>
            <Button title="Entrar com código" onPress={() => router.push("/(auth)/join")} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]} testID="agenda-screen">
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: spacing.screenX, paddingBottom: 140 },
          ]}
        >
          <View style={styles.header}>
            <Display size={30}>Agenda</Display>
            <View style={[styles.monthPill, { backgroundColor: colors.surface }]}>
              <Mono size={11}>{monthAbbr(selectedDate)}</Mono>
            </View>
          </View>

          <WeekStrip weekStart={weekStart} selectedISO={selectedISO} onSelect={handleSelectDay} />

          {week.error ? (
            <View testID="agenda-error" style={styles.stateBlock}>
              <Body color="inkMuted" style={styles.stateText}>
                Não foi possível carregar a agenda desta semana.
              </Body>
              <Button title="Tentar de novo" variant="outline" onPress={week.refetch} />
            </View>
          ) : week.loading && week.occurrences.length === 0 ? (
            <View testID="agenda-loading" style={styles.stateBlock}>
              <ActivityIndicator color={colors.forest} />
            </View>
          ) : dayOccurrences.length === 0 ? (
            <View testID="agenda-day-empty" style={styles.stateBlock}>
              <Display size={22} style={styles.emptyDayTitle}>
                Nada por aqui
              </Display>
              <Body color="inkMuted" style={styles.stateText}>
                Não há tarefas para este dia.
              </Body>
            </View>
          ) : (
            <AgendaList occurrences={dayOccurrences} byId={byId} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  centeredSafeArea: {
    flex: 1,
    justifyContent: "center",
  },
  scrollContent: {
    paddingTop: 12,
    gap: 20,
  },
  emptyState: {
    gap: 14,
    alignItems: "flex-start",
  },
  emptyStateTitle: {
    marginBottom: 2,
  },
  emptyStateBody: {
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthPill: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  stateBlock: {
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 24,
  },
  emptyDayTitle: {
    marginBottom: 2,
  },
  stateText: {
    marginBottom: 4,
  },
});
