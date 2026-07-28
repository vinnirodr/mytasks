/**
 * Organizados — ProgressRing
 *
 * Hero progress ring (docs/design/handoff/README.md, "Quadro do dia"): the
 * handoff mock draws it with a CSS `conic-gradient`, which has no RN
 * equivalent (and no web-only shortcut, since this must also render on
 * native) — this component reproduces it with `react-native-svg` instead,
 * a stroked track circle plus a stroked "arc" circle whose
 * `strokeDasharray`/`strokeDashoffset` reveal a `pct`-proportional slice.
 * The whole `<Svg>` is rotated -90deg so the arc starts at 12 o'clock and
 * sweeps clockwise, matching the conic-gradient's `0deg` reference.
 *
 * `computeProgressRingGeometry` is exported and pure (no React, no SVG) so
 * the dash math itself is unit-testable without rendering anything.
 */

import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Circle, Svg } from "react-native-svg";

// ---------------------------------------------------------------------------
// Geometry (pure, testable)
// ---------------------------------------------------------------------------

export type ProgressRingGeometry = {
  radius: number;
  circumference: number;
  /** `strokeDashoffset` for the progress arc — 0 at pct=100, full circumference at pct=0. */
  dashOffset: number;
};

/** Clamped to [0, 100] so an out-of-range `pct` never produces a negative dash offset. */
export function computeProgressRingGeometry(
  pct: number,
  size: number,
  strokeWidth: number,
): ProgressRingGeometry {
  const clampedPct = Math.max(0, Math.min(100, pct));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clampedPct / 100);

  return { radius, circumference, dashOffset };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type ProgressRingProps = {
  /** 0-100. Values outside that range are clamped. */
  pct: number;
  /** Diameter in px. Defaults to 82 (the hero ring's size per the handoff). */
  size?: number;
  strokeWidth?: number;
  /** Track (background) stroke color — the handoff's "cor de ação a ~16% de opacidade". */
  trackColor: string;
  trackOpacity?: number;
  /** Progress arc stroke color — `butter` by day / `accent` by night per the handoff. */
  progressColor: string;
  /** Centered content overlaid on the ring (e.g. the "pct%" label). */
  children?: ReactNode;
};

const DEFAULT_SIZE = 82;
const DEFAULT_STROKE_WIDTH = 8;
const DEFAULT_TRACK_OPACITY = 0.16;

export function ProgressRing({
  pct,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  trackColor,
  trackOpacity = DEFAULT_TRACK_OPACITY,
  progressColor,
  children,
}: ProgressRingProps) {
  const { radius, circumference, dashOffset } = computeProgressRingGeometry(pct, size, strokeWidth);
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <View style={[StyleSheet.absoluteFill, styles.rotated]}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={trackColor}
            strokeOpacity={trackOpacity}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            testID="progress-ring-arc"
            cx={center}
            cy={center}
            r={radius}
            stroke={progressColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </View>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rotated: {
    transform: [{ rotate: "-90deg" }],
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
});
