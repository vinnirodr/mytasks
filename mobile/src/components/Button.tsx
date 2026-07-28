/**
 * Organizados — Button
 *
 * Primary interactive control (docs/design/handoff/README.md, "Alturas
 * fixas" and "Sombra"): 58px pill, Manrope 16/700 label, day-only shadow
 * per variant (night elevation is flat — the handoff's "no tema noite a
 * elevação vem de luminosidade + fio" rule extends to controls too).
 */

import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/theme/useTheme";

import { Text } from "./Text";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ButtonVariant = "primary" | "tangerine" | "outline" | "danger";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  leftIcon?: IconName;
  rightIcon?: IconName;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  leftIcon,
  rightIcon,
}: ButtonProps) {
  const theme = useTheme();
  const { colors, heights, radius, shadow, isDark, action, onAction } = theme;

  let backgroundColor: string;
  let textColor: string;
  let borderWidth = 0;
  let borderColor = "transparent";
  let variantShadow: ViewStyle = {};

  switch (variant) {
    case "tangerine": {
      backgroundColor = colors.tangerine;
      textColor = colors.onForest;
      variantShadow = isDark ? {} : shadow.primaryTangerine;
      break;
    }
    case "outline": {
      backgroundColor = "transparent";
      textColor = action;
      borderWidth = 1.5;
      borderColor = action;
      break;
    }
    case "danger": {
      backgroundColor = colors.danger;
      textColor = colors.onForest;
      break;
    }
    case "primary":
    default: {
      backgroundColor = action;
      textColor = onAction;
      variantShadow = isDark ? {} : shadow.primaryForest;
      break;
    }
  }

  const iconColor = textColor;
  const iconSize = 20;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantShadow,
        {
          height: heights.button,
          borderRadius: radius.pill,
          backgroundColor,
          borderWidth,
          borderColor,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        {leftIcon ? <MaterialIcons name={leftIcon} size={iconSize} color={iconColor} /> : null}
        <Text variant="title" weight="bold" size={16} color={textColor}>
          {title}
        </Text>
        {rightIcon ? <MaterialIcons name={rightIcon} size={iconSize} color={iconColor} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
