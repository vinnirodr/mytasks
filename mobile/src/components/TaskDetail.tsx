/**
 * Organizados — TaskDetail (Plan 6d, Task 6)
 *
 * Task-detail overlay (docs/design/handoff/README.md, "10. Detalhe da
 * tarefa"), presented as a `Modal` over the daily board rather than a route
 * — the `(app)` group's tab navigators (`NativeTabs` native / `expo-router/ui
 * Tabs` web) only register routes declared as tab triggers, so a sibling
 * `task/[id]` route wouldn't be reachable via `router.push` without
 * restructuring the tabs (deferred to 6e/6f). Instead this is controlled by
 * `selectedOccurrenceId` state in the board screen and shares its
 * `BoardProvider` state directly, via `useBoard()`.
 *
 * Layout: a `forest`(day)/`surface`(night) header with 32px bottom corners
 * (back + a no-op "more" placeholder, a `StatusChip`, the title, and the
 * assignee row), a body with two side-by-side cards — REPETE (derived only
 * from the occurrence: `isOneOff` → "avulsa" else "recorrente", plus its
 * time) and SEQUÊNCIA (placeholder, no backend this slice) — and a
 * HISTÓRICO card (placeholder, no per-occurrence history endpoint this
 * slice). Footer: 58px circular "adiar"/"reatribuir" buttons + a "Concluir"
 * pill filling the rest.
 *
 * Actions are optimistic + reconciled against `board.applyLocal`, reusing
 * the same pure list-patch helpers `useUndoableComplete.ts` already exports
 * (`moveToEndAsDone`/`restoreOccurrence` for the complete flow's reorder;
 * `applyServerOccurrence` to drop in either a server response or a revert
 * snapshot in place). "Concluir" closes the modal right away (optimistic —
 * per the brief, there's no undo timer here, unlike the board's checkbox
 * flow) and calls `onCompleteError` if the deferred API call then fails,
 * since TaskDetail is no longer the thing on screen to show its own notice.
 * Postpone/reassign/pickup keep the modal open, so their errors show inline
 * via a small dismissible banner instead.
 */

import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MaterialIcons } from "@expo/vector-icons";

import { boardApi, type Occurrence } from "@/api/board";
import type { Member } from "@/api/members";
import { useAuth } from "@/auth/useAuth";
import { useActiveEnvironment } from "@/env/useActiveEnvironment";
import { useBoard } from "@/env/useBoard";
import { useMembers } from "@/env/useMembers";
import { applyServerOccurrence, moveToEndAsDone, restoreOccurrence } from "@/hooks/useUndoableComplete";
import { darkColors, lightColors } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

import { Avatar } from "./Avatar";
import { MemberPickerSheet } from "./MemberPickerSheet";
import { StatusChip } from "./StatusChip";
import { taskStatusForOccurrence } from "./statusMap";
import { Body, BodyStrong, Display, Mono } from "./Text";

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing without rendering)
// ---------------------------------------------------------------------------

/** `"HH:MM:SS"` → `"HH:MM"`. */
function formatHHMM(time: string): string {
  return time.slice(0, 5);
}

/** REPETE card's first line — derived only from the occurrence, no backend. */
export function repeatKindLabel(occurrence: Occurrence): string {
  return occurrence.isOneOff ? "Tarefa avulsa" : "Tarefa recorrente";
}

/** REPETE card's second line — formatted time, or a placeholder when unset. */
export function repeatTimeLabel(occurrence: Occurrence): string {
  return occurrence.time ? formatHHMM(occurrence.time) : "Sem horário";
}

export function isPostponeEnabled(status: Occurrence["status"]): boolean {
  return status === "PENDING" || status === "LATE";
}

/** Patches `list[id]` in place with `patch`, without reordering. A no-op if the id isn't present. */
export function patchOccurrence(
  list: Occurrence[],
  id: string,
  patch: Partial<Occurrence>,
): Occurrence[] {
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) return list;
  return [...list.slice(0, index), { ...list[index]!, ...patch }, ...list.slice(index + 1)];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type TaskDetailProps = {
  occurrenceId: string | null;
  onClose: () => void;
  /**
   * Fires when the optimistic "Concluir" action's deferred API call fails.
   * By then the modal has already closed and the local change was
   * reverted — the host is expected to surface a short notice itself (the
   * board screen reuses its existing checkbox-complete error banner).
   */
  onCompleteError?: () => void;
};

function comingSoon() {}

export function TaskDetail({ occurrenceId, onClose, onCompleteError }: TaskDetailProps) {
  const theme = useTheme();
  const { colors, radius, isDark } = theme;
  const board = useBoard();
  const { active } = useActiveEnvironment();
  const { members, byId } = useMembers(active?.id);
  const { user } = useAuth();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const occurrence = occurrenceId
    ? board.occurrences.find((item) => item.id === occurrenceId)
    : undefined;

  // Safety net: if the selected occurrence disappears from the board (e.g. a
  // refetch replaced the list) while the modal is open, close it rather than
  // rendering a stale/undefined detail.
  useEffect(() => {
    if (occurrenceId && !occurrence) {
      onClose();
    }
  }, [occurrenceId, occurrence, onClose]);

  const visible = Boolean(occurrenceId && occurrence);

  if (!occurrence) {
    return null;
  }

  const assigneeMember = occurrence.assignee ? byId.get(occurrence.assignee) : undefined;
  const postponeEnabled = isPostponeEnabled(occurrence.status);
  const showComplete = occurrence.status !== "DONE";

  const headerBg = isDark ? colors.surface : colors.forest;
  const headerFg = isDark ? colors.ink : colors.onForest;
  // Translucent circular-button fill on the header — no dedicated "overlay
  // on forest" day token exists, so day uses a hand-picked onForest-tinted
  // rgba (mirrors the night `overlaySoft` role) rather than inventing a hex
  // that isn't in the tokens table.
  const headerIconBg = isDark ? darkColors.overlaySoft : "rgba(242,237,228,0.14)";
  // "cor de ação: tangerine dia / accent noite" (brief) — the same
  // non-token-driven day/night pair the FAB on the board uses, since
  // neither `Button` variant matches this exact combination.
  const completeBg = isDark ? darkColors.accent : lightColors.tangerine;
  const completeFg = isDark ? darkColors.onAccent : lightColors.onForest;

  function handleComplete() {
    const current = occurrence;
    if (!current || current.status === "DONE") return;

    const index = board.occurrences.findIndex((item) => item.id === current.id);
    if (index === -1) return;
    const snapshot = { id: current.id, index, occurrence: current };

    board.applyLocal((prev) =>
      moveToEndAsDone(prev, prev.findIndex((item) => item.id === current.id)),
    );
    onClose();

    boardApi
      .completeOccurrence(current.id)
      .then((server) => {
        board.applyLocal((prev) => applyServerOccurrence(prev, server));
      })
      .catch(() => {
        board.applyLocal((prev) => restoreOccurrence(prev, snapshot));
        onCompleteError?.();
      });
  }

  function handlePostpone() {
    const previous = occurrence;
    if (!previous || !isPostponeEnabled(previous.status)) return;

    setActionError(null);
    board.applyLocal((prev) => patchOccurrence(prev, previous.id, { status: "POSTPONED" }));

    boardApi
      .postponeOccurrence(previous.id)
      .then((server) => {
        board.applyLocal((prev) => applyServerOccurrence(prev, server));
      })
      .catch(() => {
        board.applyLocal((prev) => applyServerOccurrence(prev, previous));
        setActionError("Não foi possível adiar. Tente de novo.");
      });
  }

  function handleReassign(member: Member) {
    const previous = occurrence;
    if (!previous) return;

    setPickerOpen(false);
    setActionError(null);
    board.applyLocal((prev) => patchOccurrence(prev, previous.id, { assignee: member.userId }));

    boardApi
      .reassignOccurrence(previous.id, member.userId)
      .then((server) => {
        board.applyLocal((prev) => applyServerOccurrence(prev, server));
      })
      .catch(() => {
        board.applyLocal((prev) => applyServerOccurrence(prev, previous));
        setActionError("Não foi possível reatribuir. Tente de novo.");
      });
  }

  function handlePickupForMe() {
    const previous = occurrence;
    if (!previous || !user) return;

    setPickerOpen(false);
    setActionError(null);
    board.applyLocal((prev) => patchOccurrence(prev, previous.id, { assignee: user.id }));

    boardApi
      .pickupOccurrence(previous.id)
      .then((server) => {
        board.applyLocal((prev) => applyServerOccurrence(prev, server));
      })
      .catch(() => {
        board.applyLocal((prev) => applyServerOccurrence(prev, previous));
        setActionError("Não foi possível assumir a tarefa. Tente de novo.");
      });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID="task-detail-modal"
    >
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <SafeAreaView style={styles.safeArea}>
          <View
            style={[
              styles.header,
              { backgroundColor: headerBg, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
            ]}
          >
            <View style={styles.headerTopRow}>
              <Pressable
                testID="task-detail-close"
                accessibilityRole="button"
                accessibilityLabel="Fechar"
                onPress={onClose}
                style={[styles.iconButton, { backgroundColor: headerIconBg }]}
              >
                <MaterialIcons name="arrow-back" size={20} color={headerFg} />
              </Pressable>
              <Pressable
                testID="task-detail-more"
                accessibilityRole="button"
                accessibilityLabel="Mais opções"
                onPress={comingSoon}
                style={[styles.iconButton, { backgroundColor: headerIconBg }]}
              >
                <MaterialIcons name="more-horiz" size={20} color={headerFg} />
              </Pressable>
            </View>

            <StatusChip status={taskStatusForOccurrence(occurrence.status)} />

            <Display size={34} color={isDark ? "ink" : "onForest"} numberOfLines={2} style={styles.title}>
              {occurrence.title}
            </Display>

            <View style={styles.assigneeRow}>
              <Avatar
                name={assigneeMember?.displayName}
                initials={assigneeMember?.initials}
                size={30}
              />
              <Body size={14} color={isDark ? "ink" : "onForest"}>
                {assigneeMember ? assigneeMember.displayName : "Sem responsável"}
              </Body>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.cardsRow}>
              <View
                testID="task-detail-repeat-card"
                style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.small }]}
              >
                <Mono size={11} color="inkFaint">
                  Repete
                </Mono>
                <BodyStrong size={15.5} style={styles.cardLine}>
                  {repeatKindLabel(occurrence)}
                </BodyStrong>
                <Mono size={11.5} color="inkMuted">
                  {repeatTimeLabel(occurrence)}
                </Mono>
              </View>

              <View
                testID="task-detail-sequence-card"
                style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.small }]}
              >
                <Mono size={11} color="inkFaint">
                  Sequência
                </Mono>
                <BodyStrong size={15.5} style={styles.cardLine}>
                  Em breve
                </BodyStrong>
              </View>
            </View>

            <View
              testID="task-detail-history-card"
              style={[styles.historyCard, { backgroundColor: colors.surface, borderRadius: radius.small }]}
            >
              <Mono size={11} color="inkFaint">
                Histórico
              </Mono>
              <Body color="inkMuted" style={styles.cardLine}>
                Sem histórico ainda
              </Body>
            </View>

            {actionError ? (
              <View
                testID="task-detail-error-banner"
                style={[styles.errorBanner, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}
              >
                <Body size={14} color="danger" style={styles.errorText}>
                  {actionError}
                </Body>
                <Pressable
                  testID="task-detail-error-dismiss"
                  accessibilityRole="button"
                  accessibilityLabel="Dispensar aviso"
                  onPress={() => setActionError(null)}
                  hitSlop={8}
                >
                  <MaterialIcons name="close" size={18} color={colors.danger} />
                </Pressable>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              testID="task-detail-postpone"
              accessibilityRole="button"
              accessibilityLabel="Adiar"
              accessibilityState={{ disabled: !postponeEnabled }}
              disabled={!postponeEnabled}
              onPress={handlePostpone}
              style={[
                styles.circleButton,
                { backgroundColor: colors.surface, opacity: postponeEnabled ? 1 : 0.4 },
              ]}
            >
              <MaterialIcons name="schedule" size={22} color={colors.ink} />
            </Pressable>

            <Pressable
              testID="task-detail-reassign"
              accessibilityRole="button"
              accessibilityLabel="Reatribuir"
              onPress={() => setPickerOpen(true)}
              style={[styles.circleButton, { backgroundColor: colors.surface }]}
            >
              <MaterialIcons name="swap-horiz" size={22} color={colors.ink} />
            </Pressable>

            {showComplete ? (
              <Pressable
                testID="task-detail-complete"
                accessibilityRole="button"
                accessibilityLabel="Concluir"
                onPress={handleComplete}
                style={[styles.completeButton, { backgroundColor: completeBg }]}
              >
                <BodyStrong size={16} color={isDark ? "onAccent" : "onForest"}>
                  Concluir
                </BodyStrong>
              </Pressable>
            ) : null}
          </View>
        </SafeAreaView>
      </View>

      <MemberPickerSheet
        visible={pickerOpen}
        members={members}
        currentUserId={user?.id}
        onSelectMember={handleReassign}
        onPickupForMe={handlePickupForMe}
        onClose={() => setPickerOpen(false)}
      />
    </Modal>
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
  header: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 2,
  },
  assigneeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  body: {
    padding: 22,
    gap: 14,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    flex: 1,
    padding: 16,
    gap: 6,
  },
  historyCard: {
    padding: 16,
    gap: 6,
  },
  cardLine: {
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  errorText: {
    flex: 1,
    marginRight: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  circleButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  completeButton: {
    flex: 1,
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
