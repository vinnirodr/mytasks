/**
 * Organizados — Theme context
 *
 * Resolves light/dark colors from the OS color scheme, with an optional
 * manual override ("system" | "light" | "dark") so screens like Profile
 * (6f) can let the user force a theme regardless of the device setting.
 */

import { createContext, useCallback, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import {
  avatarColors,
  darkColors,
  fontSize,
  heights,
  lightColors,
  radius,
  shadow,
  spacing,
  type ResolvedColors,
} from "./tokens";

// Re-exported so call sites (e.g. TextField.tsx) can keep importing the
// resolved-palette type from the theme module rather than reaching into
// tokens.ts directly.
export type { ResolvedColors };

export type ThemeMode = "light" | "dark";
export type ThemeOverride = "system" | ThemeMode;

export type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ResolvedColors;
  /** Resolved primary-action color: `forest` (day) / `accent` (night). */
  action: string;
  /** Resolved text-on-action color: `onForest` (day) / `onAccent` (night). */
  onAction: string;
  spacing: typeof spacing;
  radius: typeof radius;
  heights: typeof heights;
  fontSize: typeof fontSize;
  shadow: typeof shadow;
  avatarColors: typeof avatarColors;
  override: ThemeOverride;
  setOverride: (override: ThemeOverride) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [override, setOverrideState] = useState<ThemeOverride>("system");

  const mode: ThemeMode =
    override === "system" ? (systemScheme === "dark" ? "dark" : "light") : override;

  const setOverride = useCallback((next: ThemeOverride) => {
    setOverrideState(next);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const isDark = mode === "dark";
    return {
      mode,
      isDark,
      colors: isDark ? darkColors : lightColors,
      action: isDark ? darkColors.accent : lightColors.forest,
      onAction: isDark ? darkColors.onAccent : lightColors.onForest,
      spacing,
      radius,
      heights,
      fontSize,
      shadow,
      avatarColors,
      override,
      setOverride,
    };
  }, [mode, override, setOverride]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
