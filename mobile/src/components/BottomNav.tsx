/**
 * Organizados — BottomNav
 *
 * Fixed 4-tab bar (docs/design/handoff/README.md, "Navegação"): Hoje,
 * Agenda, Casa, Perfil. The active tab becomes a solid pill (icon + label
 * side by side); inactive tabs stack an icon over an 11px label. The
 * Android Material variant (80px bar, 64×32 pill indicator, 12px label
 * below) is deferred to a later polish pass — this iOS-shaped bar is
 * prop-driven so a future platform branch can swap the rendering without
 * touching callers.
 */

import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "@/theme/useTheme";

import { Text } from "./Text";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IconName = ComponentProps<typeof MaterialIcons>["name"];

export type BottomNavKey = "hoje" | "agenda" | "casa" | "perfil";

type Tab = {
  key: BottomNavKey;
  label: string;
  icon: IconName;
};

export type BottomNavProps = {
  activeKey: BottomNavKey;
  onChange: (key: BottomNavKey) => void;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS: Tab[] = [
  { key: "hoje", label: "Hoje", icon: "home" },
  { key: "agenda", label: "Agenda", icon: "calendar-month" },
  { key: "casa", label: "Casa", icon: "groups" },
  { key: "perfil", label: "Perfil", icon: "person" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BottomNav({ activeKey, onChange }: BottomNavProps) {
  const theme = useTheme();
  const { colors, heights, radius, shadow, isDark, action, onAction } = theme;

  return (
    <View
      style={[
        styles.bar,
        isDark ? undefined : shadow.floating,
        {
          height: heights.nav,
          borderRadius: radius.pill,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {TABS.map((tab) => {
        const active = tab.key === activeKey;
        const color = active ? onAction : colors.inkMuted;

        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.key)}
            style={[
              styles.tab,
              active
                ? {
                    flexDirection: "row" as const,
                    gap: 6,
                    height: 44,
                    paddingHorizontal: 16,
                    borderRadius: radius.pill,
                    backgroundColor: action,
                  }
                : { flexDirection: "column" as const, gap: 3 },
            ]}
          >
            <MaterialIcons name={tab.icon} size={22} color={color} />
            <Text variant={active ? "bodyStrong" : "caption"} size={active ? 14 : 11} color={color}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  tab: {
    alignItems: "center",
    justifyContent: "center",
  },
});
