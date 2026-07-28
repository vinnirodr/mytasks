/**
 * Organizados — Brand symbol (split "O")
 *
 * Two arcs that meet in the middle — "ninguém organiza uma casa sozinho".
 * Left half = forest (the structure, the agreement). Right half = tangerine
 * (the gesture, the person who does). At night the halves become creme and
 * manteiga. See docs/design/handoff/README.md, "Marca".
 *
 * The two `Path`s are fixed to a 44×44 viewBox; `size` scales the whole
 * `<Svg>` via width/height. Because stroke-width is expressed in that same
 * 44-unit space, a constant stroke-width would look thinner at small
 * rendered sizes and the central gap would eventually close — so the base
 * value is chosen from the *rendered* size (7 above 32px, 7.5 between
 * 24–32px, 8.5 below 24px) before being used, unscaled, as the Path's
 * strokeWidth.
 */

import { useEffect } from "react";
import { Svg, Path, type PathProps } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/theme/useTheme";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIEW_BOX = "0 0 44 44";
const MIN_SIZE = 20;
const DEFAULT_SIZE = 44;

const LEFT_D = "M22 6a16 16 0 0 0 0 32";
const RIGHT_D = "M22 6a16 16 0 0 1 0 32";

const LIGHT_LEFT = "#123B2E"; // forest
const LIGHT_RIGHT = "#FF5A2B"; // tangerine
const DARK_LEFT = "#F2EDE4"; // creme
const DARK_RIGHT = "#FFD65A"; // manteiga

const MONO_FADED_OPACITY = 0.45;

const ENTER_OFFSET_X = 7;
const MEET_DURATION = 420;
const MEET_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Stroke-width compensation as a function of the *rendered* symbol size —
 * see the handoff's "Espessura compensada" rule. Returned unscaled: the
 * paths live in a fixed 44-unit viewBox, and `<Svg>` width/height already
 * scale that box down to `size`, so this value is used as-is for
 * `strokeWidth`.
 */
export function strokeWidthForSize(renderedSize: number): number {
  if (renderedSize > 32) return 7;
  if (renderedSize >= 24) return 7.5;
  return 8.5;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type OrgSymbolProps = {
  /** Rendered width/height in px. Defaults to 44; clamped to a 20px minimum. */
  size?: number;
  /** Monochromatic treatment: full-opacity left half + 45%-opacity right half, both in `ink`. */
  mono?: boolean;
  /** Plays the meet-in-the-middle entrance (420ms, never rotate/blink). */
  animated?: boolean;
  /** Change this value to (re)trigger the entrance animation, e.g. on splash or task completion. */
  animationKey?: number | string;
};

export function OrgSymbol({
  size = DEFAULT_SIZE,
  mono = false,
  animated = false,
  animationKey,
}: OrgSymbolProps) {
  const theme = useTheme();
  const renderedSize = Math.max(MIN_SIZE, size);
  const strokeWidth = strokeWidthForSize(renderedSize);

  const leftX = useSharedValue(animated ? -ENTER_OFFSET_X : 0);
  const rightX = useSharedValue(animated ? ENTER_OFFSET_X : 0);

  useEffect(() => {
    if (!animated) {
      leftX.value = 0;
      rightX.value = 0;
      return;
    }

    leftX.value = -ENTER_OFFSET_X;
    rightX.value = ENTER_OFFSET_X;
    leftX.value = withTiming(0, { duration: MEET_DURATION, easing: MEET_EASING });
    rightX.value = withTiming(0, { duration: MEET_DURATION, easing: MEET_EASING });
    // `animationKey` is a deliberate re-trigger signal, not read for its value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated, animationKey]);

  const leftAnimatedProps = useAnimatedProps<Partial<PathProps>>(() => ({
    translateX: leftX.value,
  }));
  const rightAnimatedProps = useAnimatedProps<Partial<PathProps>>(() => ({
    translateX: rightX.value,
  }));

  const leftColor = mono ? theme.colors.ink : theme.isDark ? DARK_LEFT : LIGHT_LEFT;
  const rightColor = mono ? theme.colors.ink : theme.isDark ? DARK_RIGHT : LIGHT_RIGHT;

  return (
    <Svg width={renderedSize} height={renderedSize} viewBox={VIEW_BOX} fill="none">
      <AnimatedPath
        testID="org-symbol-left"
        d={LEFT_D}
        stroke={leftColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={1}
        animatedProps={leftAnimatedProps}
      />
      <AnimatedPath
        testID="org-symbol-right"
        d={RIGHT_D}
        stroke={rightColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={mono ? MONO_FADED_OPACITY : 1}
        animatedProps={rightAnimatedProps}
      />
    </Svg>
  );
}
