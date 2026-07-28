/**
 * Organizados — CreateEnvModal (Plan 6e, Task 4)
 *
 * "Criar ambiente" (docs/design/handoff/README.md, "13. Criar ambiente"),
 * presented as a `Modal` overlay — same full-screen, scrim-free pattern
 * `TaskDetail`/`NewTaskModal` use, hosted via local state rather than a
 * route (this group's tab navigators only register routes declared as tab
 * triggers, same rationale as those two).
 *
 * Wired to the daily board's "no environment" empty state (6d): tapping
 * "Criar ambiente" there opens this modal instead of only offering "entrar
 * com código". On success it calls `environmentsApi.create({ name, envType
 * })` (the creator becomes ADMIN server-side) and hands the returned
 * `Environment` to `useActiveEnvironment().addAndActivate()` — which inserts
 * it into the environments list and makes it active in one step, avoiding a
 * reload()+setActive() race (setActive only accepts ids already in the
 * list; the freshly created env isn't there yet). The board re-renders on
 * the new active environment once this modal closes.
 *
 * The 5 color swatches are purely local/visual — the handoff's "cinco
 * amostras de cor" have no backend field (`environmentsApi.create` only
 * takes `{ name, envType }`), so the selection never leaves this component.
 */

import { useState, type ComponentProps } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MaterialIcons } from "@expo/vector-icons";

import { environmentsApi, type EnvType } from "@/api/environments";
import { useActiveEnvironment } from "@/env/useActiveEnvironment";
import { darkColors, lightColors } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

import { Chip } from "./Chip";
import { Body, BodyStrong, Display, Mono } from "./Text";
import { TextField } from "./TextField";

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing without rendering)
// ---------------------------------------------------------------------------

type IconName = ComponentProps<typeof MaterialIcons>["name"];

/** pt-BR label → backend `EnvType`, in the handoff's chip order. `OTHER` has no chip. */
export const ENV_TYPE_CHIPS: ReadonlyArray<{ label: string; icon: IconName; envType: EnvType }> = [
  { label: "Casa", icon: "home", envType: "HOUSE" },
  { label: "República", icon: "groups", envType: "OFFICE" },
  { label: "Trabalho", icon: "work", envType: "WORK" },
];

/** Local-only decoration (handoff "cinco amostras de cor de 46px") — never sent to the backend. */
export const SWATCH_COLORS: readonly string[] = [
  "#F2C744",
  "#FF7A4D",
  "#6FCB9B",
  "#9C8FD0",
  "#D6DDD5",
];

/** Enables "Criar ambiente": non-empty name and a selected type (default HOUSE covers the latter). */
export function canCreateEnv(name: string, envType: EnvType | null): boolean {
  return name.trim().length > 0 && envType !== null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type CreateEnvModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function CreateEnvModal({ visible, onClose }: CreateEnvModalProps) {
  const theme = useTheme();
  const { colors, isDark, shadow } = theme;
  const primaryActionBg = isDark ? darkColors.accent : lightColors.tangerine;
  const primaryActionFg = isDark ? darkColors.onAccent : lightColors.onForest;
  const { addAndActivate } = useActiveEnvironment();

  const [name, setName] = useState("");
  const [envType, setEnvType] = useState<EnvType>("HOUSE");
  const [swatchIndex, setSwatchIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!visible) {
    return null;
  }

  function resetState() {
    setName("");
    setEnvType("HOUSE");
    setSwatchIndex(0);
    setSubmitting(false);
    setError(null);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleCreate() {
    setSubmitting(true);
    setError(null);

    try {
      const env = await environmentsApi.create({ name: name.trim(), envType });
      addAndActivate(env);
      resetState();
      onClose();
    } catch {
      setError("Não foi possível criar o ambiente. Tente de novo.");
      setSubmitting(false);
    }
  }

  const canCreate = canCreateEnv(name, envType);

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      testID="create-env-modal"
    >
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable
              testID="create-env-close"
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              onPress={handleClose}
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
            >
              <MaterialIcons name="close" size={20} color={colors.ink} />
            </Pressable>

            <Display size={32} style={styles.title}>
              Criar ambiente
            </Display>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <TextField
              label="Nome"
              value={name}
              onChangeText={setName}
              placeholder="Nome do ambiente"
            />

            <View style={styles.section}>
              <Mono size={11} color="inkFaint">
                Tipo
              </Mono>
              <View style={styles.chipsRow}>
                {ENV_TYPE_CHIPS.map((chip) => (
                  <Chip
                    key={chip.envType}
                    testID={`env-type-chip-${chip.envType}`}
                    variant="person"
                    icon={chip.icon}
                    label={chip.label}
                    selected={envType === chip.envType}
                    onPress={() => setEnvType(chip.envType)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Mono size={11} color="inkFaint">
                Cor
              </Mono>
              <View style={styles.swatchRow}>
                {SWATCH_COLORS.map((swatchColor, index) => {
                  const selected = swatchIndex === index;
                  return (
                    <Pressable
                      key={swatchColor}
                      testID={`env-swatch-${index}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setSwatchIndex(index)}
                      style={[
                        styles.swatchWrap,
                        {
                          borderColor: selected ? swatchColor : "transparent",
                        },
                      ]}
                    >
                      <View style={[styles.swatch, { backgroundColor: swatchColor }]} />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View testID="create-env-tip" style={[styles.tip, { backgroundColor: colors.butterBg }]}>
              <Body size={13.5} color="butterInk">
                Quem cria o ambiente vira administrador.
              </Body>
            </View>

            {error ? (
              <View
                testID="create-env-error-banner"
                style={[styles.errorBanner, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}
              >
                <Body size={14} color="danger" style={styles.errorText}>
                  {error}
                </Body>
                <Pressable
                  testID="create-env-error-dismiss"
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
            <Pressable
              testID="create-env-confirm"
              accessibilityRole="button"
              accessibilityState={{ disabled: !canCreate || submitting }}
              disabled={!canCreate || submitting}
              onPress={handleCreate}
              style={[
                styles.primaryButton,
                { backgroundColor: primaryActionBg, opacity: !canCreate || submitting ? 0.4 : 1 },
                isDark ? undefined : shadow.primaryTangerine,
              ]}
            >
              <BodyStrong size={16} color={primaryActionFg}>
                Criar ambiente
              </BodyStrong>
            </Pressable>
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
  header: {
    paddingHorizontal: 22,
    paddingTop: 8,
    gap: 12,
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
  swatchRow: {
    flexDirection: "row",
    gap: 12,
  },
  swatchWrap: {
    width: 54,
    height: 54,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: {
    width: 46,
    height: 46,
    borderRadius: 16,
  },
  tip: {
    padding: 16,
    borderRadius: 16,
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
