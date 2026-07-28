/**
 * Organizados — TextField
 *
 * Form input (docs/design/handoff/README.md, "Alturas fixas" and "Estados
 * de formulário"): 56px filled field, mono label above, focus ring in the
 * theme action color. Optional 3-bar password-strength meter for the
 * "Criar conta" screen (6b).
 */

import { useState } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native";

import type { ResolvedColors } from "@/theme/ThemeProvider";
import { useTheme } from "@/theme/useTheme";

import { Mono } from "./Text";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  keyboardType?: KeyboardTypeOptions;
  onFocus?: TextInputProps["onFocus"];
  onBlur?: TextInputProps["onBlur"];
  /** Password-strength meter (0 = weakest, 3 = strongest). Omit to skip the meter entirely. */
  strength?: 0 | 1 | 2 | 3;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  onFocus,
  onBlur,
  strength,
}: TextFieldProps) {
  const theme = useTheme();
  const { colors, heights, radius, action } = theme;
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View>
      <Mono style={styles.label}>{label}</Mono>
      <View
        style={[
          styles.field,
          {
            height: heights.field,
            borderRadius: radius.field,
            backgroundColor: colors.surface,
            borderWidth: isFocused ? 2 : 1,
            borderColor: isFocused ? action : colors.border,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkPlaceholder}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          style={[styles.input, { color: colors.ink }]}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
        />
      </View>
      {strength !== undefined ? (
        <View style={styles.strengthRow}>
          {[0, 1, 2].map((barIndex) => (
            <View
              key={barIndex}
              style={[
                styles.strengthBar,
                {
                  backgroundColor:
                    barIndex < strength ? strengthColor(strength, colors) : colors.border,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function strengthColor(strength: 0 | 1 | 2 | 3, colors: ResolvedColors): string {
  if (strength <= 1) return colors.danger;
  if (strength === 2) return colors.tangerine;
  return colors.live;
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 8,
  },
  field: {
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  input: {
    fontFamily: "Manrope_400Regular",
    fontSize: 16,
    padding: 0,
  },
  strengthRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  strengthBar: {
    flex: 1,
    height: 5,
    borderRadius: 999,
  },
});
