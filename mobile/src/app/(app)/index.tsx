/**
 * Organizados — Quadro do dia ("Hoje" tab home)
 *
 * Plan 6d, Task 5. Replaces the Expo starter home screen with the daily
 * board (docs/design/handoff/README.md, "8. Quadro do dia"): header +
 * hero (fraction + `ProgressRing` + a placeholder presence row) +
 * "Atrasadas"/"Hoje" sections of `TaskCard` + a "Nova tarefa" FAB. Sourced
 * from `useActiveEnvironment()`/`useBoard()` (Plan 6d Task 4) and the new
 * `useMembers()` hook; completing a task is optimistic with a 5s undo via
 * `useUndoableComplete` (see the task-5 report for the UI decisions behind
 * this screen — ring/fade approximations, the status→checkbox mapping, and
 * how the undo window is implemented).
 *
 * The bell/avatar/FAB lead to 6e/6f screens that don't exist yet — they're
 * wired to a no-op `comingSoon()` placeholder here rather than a new route.
 * The only new route this task pushes to is `/task/[id]` (T6 builds it);
 * `TaskCard.onPress` already points there.
 */

import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { boardApi } from '@/api/board';
import { useAuth } from '@/auth/useAuth';
import { Avatar, AvatarStack } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { ProgressRing } from '@/components/ProgressRing';
import { SectionHeader } from '@/components/SectionHeader';
import { Splash } from '@/components/Splash';
import { TaskCard } from '@/components/TaskCard';
import { Body, Display, Mono, Text } from '@/components/Text';
import { useActiveEnvironment } from '@/env/useActiveEnvironment';
import { useBoard } from '@/env/useBoard';
import { useMembers } from '@/env/useMembers';
import { useUndoableComplete } from '@/hooks/useUndoableComplete';
import { darkColors, lightColors } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

// ---------------------------------------------------------------------------
// Copy helpers
// ---------------------------------------------------------------------------

const WEEKDAY_ABBR = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
const MONTH_ABBR = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
];

/** "SEG, 28 JUL" — local date, pt-BR weekday/month abbreviations (no new deps). */
function formatHeaderDate(date: Date): string {
  const weekday = WEEKDAY_ABBR[date.getDay()];
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTH_ABBR[date.getMonth()];
  return `${weekday}, ${day} ${month}`;
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function presenceLabel(count: number): string {
  if (count === 0) return 'Nenhum membro por aqui ainda';
  if (count === 1) return '1 pessoa no ambiente';
  return `${count} pessoas no ambiente`;
}

/**
 * Placeholder for the bell/avatar/FAB actions — their real screens are 6e
 * (nova tarefa, notificações) and 6f (perfil). A literal no-op keeps this
 * task from inventing throwaway routes or a toast component that the next
 * slice would just delete; `testID`s on the pressables let tests assert the
 * controls exist and don't crash when pressed.
 */
function comingSoon() {}

/**
 * Navigates to the task-detail route. `/task/[id]` doesn't exist yet (T6
 * builds it) — expo-router's typed routes only know about routes that
 * exist on disk, so `router.push` would reject this literal template path
 * at compile time until then. The cast is the documented escape hatch for
 * exactly that "route arrives in a later task" situation; drop it once T6
 * lands and this path is a recognized typed route.
 */
function goToTaskDetail(occurrenceId: string) {
  router.push(`/task/${occurrenceId}` as Parameters<typeof router.push>[0]);
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const theme = useTheme();
  const { colors, spacing, radius, shadow, isDark, action } = theme;
  const { user } = useAuth();
  const { active, loading: envLoading } = useActiveEnvironment();
  const board = useBoard();
  const { members, byId } = useMembers(active?.id);

  const handleUndoError = useCallback(() => {
    // The optimistic change already reverted inside useUndoableComplete;
    // the board's own error/refetch affordance covers recovery from here.
  }, []);

  const { pending, complete, undo } = useUndoableComplete({
    occurrences: board.occurrences,
    applyLocal: board.applyLocal,
    completeOccurrence: boardApi.completeOccurrence,
    onError: handleUndoError,
  });

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
            <Button title="Entrar com código" onPress={() => router.push('/(auth)/join')} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const now = new Date();
  const firstName = user?.displayName?.trim().split(/\s+/)[0] || 'você';
  const headerDate = formatHeaderDate(now);
  const greeting = `${greetingForHour(now.getHours())}, ${firstName}`;

  // `butter` (day) / `accent` (night) per the handoff — these are the only
  // hex sources for the ring's progress stroke/label, so read them directly
  // from the token palettes rather than `theme.colors` (whose resolved type
  // is a light/dark union TS can't narrow just from the `isDark` boolean).
  const progressColor = isDark ? darkColors.accent : lightColors.butter;
  const progressLabelColor = isDark ? 'accent' : 'butter';

  const doneCount = board.heroStats.total === 0 ? 0 : board.heroStats.done;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]} testID="daily-board-screen">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: spacing.screenX, paddingBottom: 168 },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Mono size={11} style={styles.headerDate}>
                {headerDate}
              </Mono>
              <Display size={30}>{greeting}</Display>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                testID="notifications-button"
                accessibilityRole="button"
                accessibilityLabel="Notificações"
                onPress={comingSoon}
                style={[
                  styles.iconButton,
                  { backgroundColor: colors.surface },
                  isDark ? undefined : shadow.card,
                ]}
              >
                <MaterialIcons name="notifications" size={21} color={colors.ink} />
                <View
                  style={[
                    styles.notificationDot,
                    { backgroundColor: colors.tangerine, borderColor: colors.surface },
                  ]}
                />
              </Pressable>
              <Pressable
                testID="profile-avatar-button"
                accessibilityRole="button"
                accessibilityLabel="Perfil"
                onPress={comingSoon}
              >
                <Avatar name={user?.displayName} size={38} />
              </Pressable>
            </View>
          </View>

          <View style={[styles.hero, { backgroundColor: colors.forest, borderRadius: radius.hero }]}>
            <View style={styles.heroTop}>
              <View>
                <Text variant="display" size={56} color="onForest">
                  {String(doneCount)}
                  <Text variant="display" size={56} color="forestSoft">
                    /{board.heroStats.total}
                  </Text>
                </Text>
                <Body size={14} color="forestSoft" style={styles.heroCaption}>
                  tarefas concluídas hoje
                </Body>
              </View>
              <ProgressRing pct={board.heroStats.pct} trackColor={action} progressColor={progressColor}>
                <Mono size={15} color={progressLabelColor} monoWeight="regular">
                  {board.heroStats.pct}%
                </Mono>
              </ProgressRing>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.presenceRow}>
              <AvatarStack
                people={members.map((member) => ({
                  id: member.id,
                  name: member.displayName,
                  initials: member.initials,
                }))}
                size={30}
                max={3}
                borderColor={colors.forest}
              />
              <Body size={13} color="forestSoft" style={styles.presenceLabel}>
                {presenceLabel(members.length)}
              </Body>
              <View style={styles.liveDotHalo}>
                <View style={[styles.liveDot, { backgroundColor: colors.live }]} />
              </View>
            </View>
          </View>

          {pending ? (
            <View
              testID="undo-banner"
              style={[styles.undoBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Body size={14}>Concluída</Body>
              <Pressable testID="undo-button" onPress={undo} hitSlop={8}>
                <Text variant="bodyStrong" size={14} color="tangerine">
                  Desfazer
                </Text>
              </Pressable>
            </View>
          ) : null}

          {board.error ? (
            <View testID="board-error" style={styles.stateBlock}>
              <Body color="inkMuted" style={styles.stateText}>
                Não foi possível carregar o quadro de hoje.
              </Body>
              <Button title="Tentar de novo" variant="outline" onPress={board.refetch} />
            </View>
          ) : board.loading && board.occurrences.length === 0 ? (
            <View testID="board-loading" style={styles.stateBlock}>
              <ActivityIndicator color={colors.forest} />
            </View>
          ) : board.occurrences.length === 0 ? (
            <View testID="board-empty" style={styles.stateBlock}>
              <Display size={22} style={styles.emptyBoardTitle}>
                Nada para hoje 🎉
              </Display>
              <Body color="inkMuted" style={styles.stateText}>
                Volte mais tarde ou confira a Agenda para os próximos dias.
              </Body>
            </View>
          ) : (
            <View style={styles.sections}>
              {board.sections.atrasadas.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeader
                    title="Atrasadas"
                    count={board.sections.atrasadas.length}
                    tone="danger"
                  />
                  {board.sections.atrasadas.map((occurrence) => (
                    <TaskCard
                      key={occurrence.id}
                      occurrence={occurrence}
                      member={occurrence.assignee ? byId.get(occurrence.assignee) : undefined}
                      onToggleComplete={() => complete(occurrence)}
                      onPress={() => goToTaskDetail(occurrence.id)}
                    />
                  ))}
                </View>
              ) : null}

              <View style={styles.section}>
                <SectionHeader title="Hoje" count={board.sections.hoje.length} />
                {board.sections.hoje.map((occurrence) => (
                  <TaskCard
                    key={occurrence.id}
                    occurrence={occurrence}
                    member={occurrence.assignee ? byId.get(occurrence.assignee) : undefined}
                    onToggleComplete={() => complete(occurrence)}
                    onPress={() => goToTaskDetail(occurrence.id)}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <View style={[styles.fabWrap, { paddingHorizontal: spacing.screenX, backgroundColor: colors.bg }]}>
        <Pressable
          testID="fab-new-task"
          accessibilityRole="button"
          accessibilityLabel="Nova tarefa"
          onPress={comingSoon}
          style={[
            styles.fab,
            { backgroundColor: isDark ? darkColors.accent : lightColors.tangerine },
            isDark ? undefined : shadow.primaryTangerine,
          ]}
        >
          <MaterialIcons
            name="add"
            size={22}
            color={isDark ? darkColors.onAccent : lightColors.onForest}
          />
          <Text variant="title" weight="bold" size={16} color={isDark ? 'onAccent' : 'onForest'}>
            Nova tarefa
          </Text>
        </Pressable>
      </View>
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
    justifyContent: 'center',
  },
  scrollContent: {
    paddingTop: 12,
    gap: 18,
  },
  emptyState: {
    gap: 14,
    alignItems: 'flex-start',
  },
  emptyStateTitle: {
    marginBottom: 2,
  },
  emptyStateBody: {
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerText: {
    gap: 4,
    flexShrink: 1,
  },
  headerDate: {
    letterSpacing: 1.76,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
  hero: {
    padding: 22,
    paddingBottom: 18,
    gap: 18,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroCaption: {
    marginTop: 6,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(242,237,228,0.14)',
  },
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  presenceLabel: {
    flex: 1,
  },
  liveDotHalo: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  undoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  stateBlock: {
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 24,
  },
  emptyBoardTitle: {
    marginBottom: 2,
  },
  stateText: {
    marginBottom: 4,
  },
  sections: {
    gap: 20,
  },
  section: {
    gap: 12,
  },
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 24,
    paddingBottom: 34,
  },
  fab: {
    height: 58,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
