/**
 * Organizados — Chip
 *
 * Two selectable-chip shapes (docs/design/handoff/README.md, "Alturas
 * fixas" and screens 9/12/13): `person` — 44px pill used for "quem faz"
 * assignee pickers (selected = solid `action` fill); `day` — 46px
 * near-square day-of-week cell used in the Agenda strip and the "quando"
 * step of task creation (selected = forest/creme with a `butter` dot).
 */

import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/theme/useTheme";

import { Text } from "./Text";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChipVariant = "person" | "day";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  variant?: ChipVariant;
  icon?: IconName;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Chip({ label, selected = false, onPress, variant = "person", icon }: ChipProps) {
  const theme = useTheme();
  const { colors, heights, radius, isDark, action, onAction } = theme;

  if (variant === "day") {
    const size = heights.dayChip; // 46
    // Night has no dedicated "selected day" hex in the handoff — the note
    // "o verde-mata vira estrutura" reads as forest's day role (selection
    // fill) being carried by the creme ink tone at night instead.
    const selectedBg = isDark ? colors.ink : colors.forest;
    const selectedText = isDark ? colors.bg : colors.onForest;
    const backgroundColor = selected ? selectedBg : colors.surface;
    const textColor = selected ? selectedText : colors.ink;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.dayBase,
          {
            width: size,
            height: size,
            borderRadius: radius.dayChip,
            backgroundColor,
            borderWidth: selected ? 0 : 1,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        {icon ? <MaterialIcons name={icon} size={16} color={textColor} /> : null}
        <Text variant="bodyStrong" size={14} color={textColor}>
          {label}
        </Text>
        {selected ? <View style={[styles.dot, { backgroundColor: colors.butter }]} /> : null}
      </Pressable>
    );
  }

  // person variant
  const backgroundColor = selected ? action : colors.surface;
  const textColor = selected ? onAction : colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.personBase,
        {
          height: heights.personChip,
          borderRadius: radius.pill,
          backgroundColor,
          borderWidth: selected ? 0 : 1,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon ? <MaterialIcons name={icon} size={18} color={textColor} /> : null}
      <Text variant="bodyStrong" size={15} color={textColor}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  personBase: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
  },
  dayBase: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dot: {
    position: "absolute",
    bottom: 6,
    width: 5,
    height: 5,
    borderRadius: 999,
  },
});
