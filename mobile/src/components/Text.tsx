/**
 * Organizados — Typography components
 *
 * Wraps RN `Text` with the roles from the handoff typography table
 * (docs/design/handoff/README.md, "Tipografia"): `display` (Bricolage
 * Grotesque 800, tight tracking, hero numbers/headlines), `title`/`body`/
 * `bodyStrong`/`caption` (Manrope 400/700/800, interface text), and `mono`
 * (IBM Plex Mono 400/500, always UPPERCASE, positive tracking).
 *
 * Font family names below must match the export names passed to
 * `useFonts()` in `src/app/_layout.tsx` (the `@expo-google-fonts/*`
 * packages export the static weight as part of the name — there is no
 * numeric `fontWeight` to set separately).
 */

import type { ReactNode } from "react";
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";

import { darkColors, lightColors } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TextVariant = "display" | "title" | "body" | "bodyStrong" | "caption" | "mono";

/**
 * A known theme color-token key, or a raw hex/rgba string used as-is.
 *
 * NOTE: this is `keyof typeof lightColors | keyof typeof darkColors` (a
 * union of two plain key sets), not `keyof ColorTokens` — the latter is
 * `keyof (typeof lightColors & typeof darkColors)`, and intersecting two
 * object types whose overlapping properties collapse to `never` makes
 * TypeScript's `keyof` fall back to `string | number | symbol` instead of
 * the expected string-literal union. `ColorTokens` in tokens.ts remains
 * useful as a *value* umbrella type; it isn't safe to `keyof`.
 */
export type TextColor = keyof typeof lightColors | keyof typeof darkColors | (string & {});

export type TextProps = Omit<RNTextProps, "children"> & {
  variant?: TextVariant;
  /** Font size in px. Defaults to the role's primary size on the typography table. */
  size?: number;
  /** Theme color-token key (default `ink`), or a raw hex/rgba string. */
  color?: TextColor;
  /** `title` only: 800 (default) or 700. */
  weight?: "extrabold" | "bold";
  /** `mono` only: 500 (default) or 400. */
  monoWeight?: "medium" | "regular";
  children?: ReactNode;
};

// ---------------------------------------------------------------------------
// Font families (must match the useFonts() export names in _layout.tsx)
// ---------------------------------------------------------------------------

const FONT = {
  displayExtraBold: "BricolageGrotesque_800ExtraBold",
  manropeRegular: "Manrope_400Regular",
  manropeBold: "Manrope_700Bold",
  manropeExtraBold: "Manrope_800ExtraBold",
  monoRegular: "IBMPlexMono_400Regular",
  monoMedium: "IBMPlexMono_500Medium",
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uppercaseChildren(children: ReactNode): ReactNode {
  if (typeof children === "string") return children.toUpperCase();
  if (Array.isArray(children)) return children.map(uppercaseChildren);
  return children;
}

/** `size * em` rounded to 2 decimals — RN wants letterSpacing/lineHeight in px, not em. */
function em(size: number, factor: number): number {
  return Math.round(size * factor * 100) / 100;
}

/** Resolves a theme color-token key to its hex value, or passes a raw color string through. */
function resolveColor(colors: Record<string, string>, color: string): string {
  return Object.prototype.hasOwnProperty.call(colors, color) ? colors[color]! : color;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Text({
  variant = "body",
  size,
  color = "ink",
  weight,
  monoWeight,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const colors = theme.colors as unknown as Record<string, string>;
  const resolvedColor = resolveColor(colors, color);

  let textStyle: TextStyle;
  let children = rest.children;

  switch (variant) {
    case "display": {
      const resolvedSize = size ?? theme.fontSize.display[4]; // 30
      textStyle = {
        fontFamily: FONT.displayExtraBold,
        fontSize: resolvedSize,
        letterSpacing: em(resolvedSize, -0.045),
        lineHeight: em(resolvedSize, 0.98),
        color: resolvedColor,
      };
      break;
    }
    case "title": {
      const resolvedSize = size ?? theme.fontSize.text[0]; // 17
      textStyle = {
        fontFamily: weight === "bold" ? FONT.manropeBold : FONT.manropeExtraBold,
        fontSize: resolvedSize,
        letterSpacing: em(resolvedSize, -0.01),
        lineHeight: em(resolvedSize, 1.3),
        color: resolvedColor,
      };
      break;
    }
    case "bodyStrong": {
      const resolvedSize = size ?? theme.fontSize.text[2]; // 15.5
      textStyle = {
        fontFamily: FONT.manropeBold,
        fontSize: resolvedSize,
        lineHeight: em(resolvedSize, 1.45),
        color: resolvedColor,
      };
      break;
    }
    case "caption": {
      const resolvedSize = size ?? theme.fontSize.text[6]; // 13
      textStyle = {
        fontFamily: FONT.manropeRegular,
        fontSize: resolvedSize,
        lineHeight: em(resolvedSize, 1.4),
        color: color === "ink" ? colors.inkMuted : resolvedColor,
      };
      break;
    }
    case "mono": {
      const resolvedSize = size ?? theme.fontSize.mono[1]; // 11.5
      textStyle = {
        fontFamily: monoWeight === "regular" ? FONT.monoRegular : FONT.monoMedium,
        fontSize: resolvedSize,
        letterSpacing: em(resolvedSize, 0.08),
        lineHeight: em(resolvedSize, 1.4),
        color: color === "ink" ? colors.inkFaint : resolvedColor,
      };
      children = uppercaseChildren(children);
      break;
    }
    case "body":
    default: {
      const resolvedSize = size ?? theme.fontSize.text[2]; // 15.5
      textStyle = {
        fontFamily: FONT.manropeRegular,
        fontSize: resolvedSize,
        lineHeight: em(resolvedSize, 1.45),
        color: resolvedColor,
      };
      break;
    }
  }

  return (
    <RNText style={[textStyle, style]} {...rest}>
      {children}
    </RNText>
  );
}

// ---------------------------------------------------------------------------
// Convenience exports
// ---------------------------------------------------------------------------

export function Display(props: Omit<TextProps, "variant">) {
  return <Text variant="display" {...props} />;
}

export function Title(props: Omit<TextProps, "variant">) {
  return <Text variant="title" {...props} />;
}

export function Body(props: Omit<TextProps, "variant">) {
  return <Text variant="body" {...props} />;
}

export function BodyStrong(props: Omit<TextProps, "variant">) {
  return <Text variant="bodyStrong" {...props} />;
}

export function Caption(props: Omit<TextProps, "variant">) {
  return <Text variant="caption" {...props} />;
}

export function Mono(props: Omit<TextProps, "variant">) {
  return <Text variant="mono" {...props} />;
}
