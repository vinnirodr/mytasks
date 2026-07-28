/**
 * Organizados — NewTaskModal (Plan 6e, Task 3)
 *
 * "Nova tarefa" 2-step recurring-task creation flow (docs/design/handoff
 * README, "12. Nova tarefa (passo 1 de 2)"), presented as a `Modal` over the
 * daily board — same scrim-free full-screen overlay pattern `TaskDetail`
 * (6d) uses, controlled by the board screen's `newTaskOpen` state rather
 * than a route (this group's tab navigators only register routes declared
 * as tab triggers, same rationale as `TaskDetail`'s file header).
 *
 * ADMIN-only: creating the weekly routine is restricted to
 * `active.role === "ADMIN"`; anyone else sees a one-line notice instead of
 * the form (a member's one-off/avulsa task is a follow-up, out of scope).
 *
 * Orchestration on confirm is client-side — there's no single "create a
 * routine" backend endpoint (T1 only exposes `createDefinition`/
 * `createRecurring`) — so step 2's "Criar tarefa" does one `createDefinition`
 * followed by one `createRecurring` per selected weekday, all in parallel via
 * `Promise.allSettled` (`createRoutine`, exported so the orchestration and
 * its partial-failure handling are unit-testable without rendering). Total
 * success closes the modal and calls `board.refetch()` (best-effort, per the
 * brief — its own errors aren't surfaced, since the create already
 * succeeded); a failed `createDefinition` or any failed `createRecurring`
 * keeps the modal open on step 2 with a pt-BR notice instead of silently
 * closing, since occurrences already created for other weekdays should stay
 * visible/inspectable rather than vanishing behind a closed modal.
 *
 * The seven "QUANDO" day chips are shown in the handoff's visual order
 * (D S T Q Q S S, i.e. Sunday-first) but must send the backend's Monday-first
 * `weekday` (0=Segunda…6=Domingo) — `DAY_CHIPS` is the single place that
 * mapping lives, so the visual order and the wire format never have to be
 * kept in sync by hand at each call site.
 */

import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MaterialIcons } from "@expo/vector-icons";

import { tasksApi, type RecurringTask } from "@/api/tasks";
import { useActiveEnvironment } from "@/env/useActiveEnvironment";
import { useBoard } from "@/env/useBoard";
import { useMembers } from "@/env/useMembers";
import { darkColors, lightColors } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

import { Button } from "./Button";
import { Chip } from "./Chip";
import { Body, BodyStrong, Display, Mono } from "./Text";
import { TextField } from "./TextField";

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing without rendering)
// ---------------------------------------------------------------------------

/**
 * Visual order the handoff specifies (D S T Q Q S S, Sunday-first) paired
 * with the backend's Monday-first `weekday` (0=Segunda…6=Domingo) each cell
 * must send. `weekday` (not the ambiguous, repeated `label`) is always the
 * identity used for selection/keys.
 */
export const DAY_CHIPS: ReadonlyArray<{ label: string; weekday: number }> = [
  { label: "D", weekday: 6 }, // Domingo
  { label: "S", weekday: 0 }, // Segunda
  { label: "T", weekday: 1 }, // Terça
  { label: "Q", weekday: 2 }, // Quarta
  { label: "Q", weekday: 3 }, // Quinta
  { label: "S", weekday: 4 }, // Sexta
  { label: "S", weekday: 5 }, // Sábado
];

const WEEKDAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

/** Full pt-BR name for a backend `weekday` (0=Segunda…6=Domingo). */
export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? "";
}

/** Strict `HH:MM`, 00–23 / 00–59 — matches the "QUANDO" time row's expected format. */
export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

/** Toggles `weekday` in `selected`, preserving the order weekdays were picked in. */
export function toggleWeekday(selected: number[], weekday: number): number[] {
  return selected.includes(weekday)
    ? selected.filter((item) => item !== weekday)
    : [...selected, weekday];
}

export type Step1Input = {
  title: string;
  assignee: string | null;
  weekdays: number[];
  time: string;
};

/** Enables "Continuar": non-empty title, ≥1 day, exactly one responsável, valid time. */
export function canContinueStep1(input: Step1Input): boolean {
  return (
    input.title.trim().length > 0 &&
    input.weekdays.length > 0 &&
    input.assignee !== null &&
    isValidTime(input.time)
  );
}

export type CreateRoutineInput = {
  title: string;
  icon?: string;
  assignee: string;
  weekdays: number[];
  time: string;
};

export type CreateRoutineResult = {
  definitionId: string;
  created: RecurringTask[];
  /** `weekday`s whose `createRecurring` call rejected — the caller decides how to notify. */
  failedWeekdays: number[];
};

/**
 * One `createDefinition` + one `createRecurring` per selected weekday, run in
 * parallel via `Promise.allSettled` so one rejected weekday doesn't abort the
 * others. Exported standalone (takes the API as a parameter) so the
 * orchestration — including which weekdays end up in `failedWeekdays` — is
 * unit-testable with a mock API, without mounting the component.
 */
export async function createRoutine(
  api: Pick<typeof tasksApi, "createDefinition" | "createRecurring">,
  envId: string,
  input: CreateRoutineInput,
): Promise<CreateRoutineResult> {
  const definition = await api.createDefinition(envId, { name: input.title, icon: input.icon ?? "" });

  const settled = await Promise.allSettled(
    input.weekdays.map((weekday) =>
      api.createRecurring(envId, {
        taskDefinition: definition.id,
        weekday,
        time: input.time,
        assignee: input.assignee,
      }),
    ),
  );

  const created: RecurringTask[] = [];
  const failedWeekdays: number[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      created.push(result.value);
    } else {
      failedWeekdays.push(input.weekdays[index]!);
    }
  });

  return { definitionId: definition.id, created, failedWeekdays };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type NewTaskModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function NewTaskModal({ visible, onClose }: NewTaskModalProps) {
  const theme = useTheme();
  const { colors, isDark, action, shadow } = theme;
  // "Continuar"/"Criar tarefa": tangerine (day) / accent (night), per the
  // brief — mirrors `TaskDetail`'s "Concluir" pill, since `Button`'s own
  // `tangerine` variant always renders the day hex regardless of theme.
  const primaryActionBg = isDark ? darkColors.accent : lightColors.tangerine;
  const primaryActionFg = isDark ? darkColors.onAccent : lightColors.onForest;
  const { active } = useActiveEnvironment();
  const { members } = useMembers(active?.id);
  const board = useBoard();

  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<string | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [time, setTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!visible) {
    return null;
  }

  const isAdmin = Boolean(active) && active?.role === "ADMIN";

  function resetState() {
    setStep(1);
    setTitle("");
    setAssignee(null);
    setWeekdays([]);
    setTime("");
    setSubmitting(false);
    setError(null);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleConfirm() {
    if (!active || !assignee) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await createRoutine(tasksApi, active.id, {
        title: title.trim(),
        assignee,
        weekdays,
        time,
      });

      if (result.failedWeekdays.length > 0) {
        const dayList = result.failedWeekdays.map(weekdayName).join(", ");
        setError(`Alguns dias não foram salvos (${dayList}). Os demais foram criados normalmente.`);
        setSubmitting(false);
        return;
      }

      board.refetch();
      resetState();
      onClose();
    } catch {
      setError("Não foi possível criar a tarefa. Tente de novo.");
      setSubmitting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Non-admin notice
  // -------------------------------------------------------------------------

  if (!isAdmin) {
    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={handleClose}
        testID="new-task-modal"
      >
        <View style={[styles.root, { backgroundColor: colors.bg }]}>
          <SafeAreaView style={styles.noticeSafeArea}>
            <View style={styles.noticeBox}>
              <Body style={styles.noticeText}>Só administradores definem a rotina</Body>
              <Button title="Fechar" variant="outline" onPress={handleClose} />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    );
  }

  // -------------------------------------------------------------------------
  // Admin form
  // -------------------------------------------------------------------------

  const continueEnabled = canContinueStep1({ title, assignee, weekdays, time });
  const assigneeMember = members.find((member) => member.userId === assignee);
  const sortedDayLabels = [...weekdays].sort((a, b) => a - b).map(weekdayName).join(", ");

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      testID="new-task-modal"
    >
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <Pressable
                testID="new-task-close"
                accessibilityRole="button"
                accessibilityLabel="Fechar"
                onPress={handleClose}
                style={[styles.iconButton, { backgroundColor: colors.surface }]}
              >
                <MaterialIcons name="close" size={20} color={colors.ink} />
              </Pressable>

              {step === 2 ? (
                <Pressable
                  testID="new-task-back"
                  accessibilityRole="button"
                  accessibilityLabel="Voltar"
                  onPress={() => setStep(1)}
                  style={[styles.iconButton, { backgroundColor: colors.surface }]}
                >
                  <MaterialIcons name="arrow-back" size={20} color={colors.ink} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.stepIndicatorRow}>
              <View
                style={[
                  styles.stepPip,
                  { width: step === 1 ? 22 : 10, backgroundColor: step === 1 ? action : colors.border },
                ]}
              />
              <View
                style={[
                  styles.stepPip,
                  { width: step === 2 ? 22 : 10, backgroundColor: step === 2 ? action : colors.border },
                ]}
              />
            </View>

            <Mono size={11} color="inkFaint">
              {step === 1 ? "Passo 1 de 2" : "Passo 2 de 2"}
            </Mono>
            <Display size={32} style={styles.title}>
              Nova tarefa
            </Display>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {step === 1 ? (
              <>
                <TextField
                  label="Título"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Nome da tarefa"
                />

                <View style={styles.section}>
                  <Mono size={11} color="inkFaint">
                    Quem faz
                  </Mono>
                  <View style={styles.chipsRow}>
                    {members.map((member) => (
                      <Chip
                        key={member.id}
                        testID={`assignee-chip-${member.userId}`}
                        variant="person"
                        label={member.displayName}
                        selected={assignee === member.userId}
                        onPress={() => setAssignee(member.userId)}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <Mono size={11} color="inkFaint">
                    Quando
                  </Mono>
                  <View style={styles.chipsRow}>
                    {DAY_CHIPS.map(({ label, weekday }) => (
                      <Chip
                        key={weekday}
                        testID={`day-chip-${weekday}`}
                        variant="day"
                        label={label}
                        selected={weekdays.includes(weekday)}
                        onPress={() => setWeekdays((prev) => toggleWeekday(prev, weekday))}
                      />
                    ))}
                  </View>

                  <TextField
                    label="Horário"
                    value={time}
                    onChangeText={setTime}
                    placeholder="HH:MM"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>

                <View
                  testID="new-task-tip"
                  style={[styles.tip, { backgroundColor: colors.butterBg }]}
                >
                  <Body size={13.5} color="butterInk">
                    Dica: evite concentrar muitas tarefas na mesma pessoa e no mesmo dia — divida a
                    rotina ao longo da semana.
                  </Body>
                </View>
              </>
            ) : (
              <View style={styles.summary} testID="new-task-summary">
                <Mono size={11} color="inkFaint">
                  Título
                </Mono>
                <BodyStrong size={17}>{title}</BodyStrong>

                <Mono size={11} color="inkFaint" style={styles.summarySpacer}>
                  Responsável
                </Mono>
                <BodyStrong size={17}>{assigneeMember?.displayName ?? ""}</BodyStrong>

                <Mono size={11} color="inkFaint" style={styles.summarySpacer}>
                  Dias
                </Mono>
                <BodyStrong size={17}>{sortedDayLabels}</BodyStrong>

                <Mono size={11} color="inkFaint" style={styles.summarySpacer}>
                  Horário
                </Mono>
                <BodyStrong size={17}>{time}</BodyStrong>
              </View>
            )}

            {error ? (
              <View
                testID="new-task-error-banner"
                style={[styles.errorBanner, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}
              >
                <Body size={14} color="danger" style={styles.errorText}>
                  {error}
                </Body>
                <Pressable
                  testID="new-task-error-dismiss"
                  accessibilityRole="button"
                  accessibilityLabel="Dispensar aviso"
                  onPress={() => setError(null)}
                  hitSlop={8}
                >
                  <MaterialIcons name="close" size={18} color={colors.danger} />
                </Pressable>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {step === 1 ? (
              <Pressable
                testID="new-task-continue"
                accessibilityRole="button"
                accessibilityState={{ disabled: !continueEnabled }}
                disabled={!continueEnabled}
                onPress={() => setStep(2)}
                style={[
                  styles.primaryButton,
                  { backgroundColor: primaryActionBg, opacity: continueEnabled ? 1 : 0.4 },
                  isDark ? undefined : shadow.primaryTangerine,
                ]}
              >
                <BodyStrong size={16} color={primaryActionFg}>
                  Continuar
                </BodyStrong>
              </Pressable>
            ) : (
              <Pressable
                testID="new-task-confirm"
                accessibilityRole="button"
                accessibilityState={{ disabled: submitting }}
                disabled={submitting}
                onPress={handleConfirm}
                style={[
                  styles.primaryButton,
                  { backgroundColor: primaryActionBg, opacity: submitting ? 0.6 : 1 },
                  isDark ? undefined : shadow.primaryTangerine,
                ]}
              >
                <BodyStrong size={16} color={primaryActionFg}>
                  Criar tarefa
                </BodyStrong>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </View>
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
  noticeSafeArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  noticeBox: {
    gap: 16,
    alignItems: "center",
    paddingHorizontal: 32,
  },
  noticeText: {
    textAlign: "center",
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 8,
    gap: 12,
  },
  headerTopRow: {
    flexDirection: "row",
    gap: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndicatorRow: {
    flexDirection: "row",
    gap: 6,
  },
  stepPip: {
    height: 6,
    borderRadius: 3,
  },
  title: {
    marginTop: 2,
  },
  body: {
    padding: 22,
    gap: 20,
  },
  section: {
    gap: 12,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tip: {
    padding: 16,
    borderRadius: 16,
  },
  summary: {
    gap: 4,
  },
  summarySpacer: {
    marginTop: 14,
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
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  primaryButton: {
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
