/**
 * Organizados — StatusChip
 *
 * Mono pill for a task's lifecycle state (docs/design/handoff/README.md,
 * "Cartão de tarefa" + `tasks[].status`): `pending`, `late`, `done`,
 * `deferred`, plus `missed` for occurrences whose window closed unresolved.
 */

import type { ComponentProps } from "react";
import { View } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";

import { darkColors } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

import { Mono } from "./Text";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskStatus = "pending" | "late" | "done" | "deferred" | "missed";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

export type StatusChipProps = {
  status: TaskStatus;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LABEL: Record<TaskStatus, string> = {
  pending: "PENDENTE",
  late: "ATRASADA",
  done: "FEITA",
  deferred: "ADIADA",
  missed: "NÃO FEITA",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatusChip({ status }: StatusChipProps) {
  const theme = useTheme();
  const { colors, radius, isDark } = theme;

  let backgroundColor: string = colors.surface;
  let textColor: string = colors.inkMuted;
  let bordered = true;
  let icon: IconName | undefined;
  let opacity = 1;

  switch (status) {
    case "late": {
      backgroundColor = colors.dangerBg;
      textColor = colors.danger;
      bordered = false;
      break;
    }
    case "done": {
      // `accent` is the only night accent (incl. "concluído") per the
      // handoff — night done fill is no longer butter.
      backgroundColor = isDark ? darkColors.accent : colors.forest;
      textColor = isDark ? darkColors.onAccent : colors.onForest;
      bordered = false;
      break;
    }
    case "deferred": {
      icon = "schedule";
      break;
    }
    case "missed": {
      textColor = colors.inkFaint;
      opacity = 0.72;
      break;
    }
    case "pending":
    default:
      break;
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 4,
        height: 28,
        paddingHorizontal: 12,
        borderRadius: radius.pill,
        backgroundColor,
        borderWidth: bordered ? 1 : 0,
        borderColor: colors.border,
        opacity,
      }}
    >
      {icon ? <MaterialIcons name={icon} size={13} color={textColor} /> : null}
      <Mono size={11} color={textColor}>
        {LABEL[status]}
      </Mono>
    </View>
  );
}
