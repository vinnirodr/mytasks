/**
 * Organizados — TaskCheckbox
 *
 * 30px tri-state control for a task-card row (docs/design/handoff/README.md,
 * "Cartão de tarefa" + Design System "Cartão de tarefa nos cinco estados"):
 * `idle` (open ring), `done` (filled circle + check), `deferred` (dashed
 * ring + clock, softened to 0.72 opacity).
 */

import { Pressable, StyleSheet, View } from "react-native";
import { Circle, Svg } from "react-native-svg";

import { MaterialIcons } from "@expo/vector-icons";

import { darkColors, lightColors } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskCheckboxState = "idle" | "done" | "deferred";

export type TaskCheckboxProps = {
  state: TaskCheckboxState;
  onToggle: () => void;
  /** Diameter in px. Defaults to 30 per the handoff's task-card checkbox. */
  size?: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SIZE = 30;
const RING_WIDTH = 2.5;
const DEFERRED_OPACITY = 0.72;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskCheckbox({ state, onToggle, size = DEFAULT_SIZE }: TaskCheckboxProps) {
  const { isDark } = useTheme();

  // `checkbox-idle` is a day-only token (README "Cor — tema dia"); at night
  // there's no dedicated ring hex, so `ink-faint` stands in as the nearest
  // "quiet outline" tone for both the idle and deferred rings.
  const ringColor = isDark ? darkColors.inkFaint : lightColors.checkboxIdle;
  const doneBg = isDark ? darkColors.butter : lightColors.forest;
  const doneCheckColor = isDark ? darkColors.butterInk : lightColors.onForest;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: state === "done" }}
      onPress={onToggle}
      testID="task-checkbox"
      hitSlop={8}
      style={[
        styles.base,
        { width: size, height: size, opacity: state === "deferred" ? DEFERRED_OPACITY : 1 },
      ]}
    >
      {state === "idle" ? (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: RING_WIDTH,
            borderColor: ringColor,
          }}
        />
      ) : null}

      {state === "done" ? (
        <View
          style={[
            styles.filled,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: doneBg },
          ]}
        >
          <MaterialIcons
            testID="task-checkbox-check"
            name="check"
            size={Math.round(size * 0.6)}
            color={doneCheckColor}
          />
        </View>
      ) : null}

      {state === "deferred" ? (
        <View style={[styles.filled, { width: size, height: size }]}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={(size - RING_WIDTH) / 2}
              stroke={ringColor}
              strokeWidth={RING_WIDTH}
              strokeDasharray={`${size * 0.14},${size * 0.1}`}
              fill="none"
            />
          </Svg>
          <MaterialIcons name="schedule" size={Math.round(size * 0.5)} color={ringColor} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  filled: {
    alignItems: "center",
    justifyContent: "center",
  },
});
