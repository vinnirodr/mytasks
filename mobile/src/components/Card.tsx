/**
 * Organizados — Card
 *
 * Generic surface container (docs/design/handoff/README.md, "Espaçamento,
 * raio e sombra"): `surface` bg, 1px hairline border, day-only shadow.
 * Night elevation comes from the border + surface luminance, never shadow.
 */

import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "@/theme/useTheme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CardProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Card({ children, style, radius: radiusProp }: CardProps) {
  const theme = useTheme();
  const { colors, radius, shadow, isDark } = theme;

  return (
    <View
      style={[
        styles.base,
        isDark ? undefined : shadow.card,
        {
          borderRadius: radiusProp ?? radius.task,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
});
