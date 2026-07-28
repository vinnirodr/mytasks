/**
 * Organizados — Wordmark
 *
 * `OrgSymbol` standing in for the "O" glyph, followed by "rganizados" set
 * in Bricolage Grotesque 800 — the symbol *is* the O (docs/design/handoff/
 * README.md, "Marca": "Logotipo principal"). Tracking −4%, 4px gap between
 * symbol and text, baseline-aligned.
 */

import { StyleSheet, View } from "react-native";

import { Display, type TextColor } from "@/components/Text";

import { OrgSymbol } from "./OrgSymbol";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SIZE = 24;
const TRACKING_EM = -0.04; // handoff: "tracking −4%"
const SYMBOL_GAP = 4; // px, handoff: "gap de 4px entre símbolo e texto"

/**
 * Approximate cap-height/em ratio for Bricolage Grotesque 800, so the
 * symbol (standing in for the "O" glyph) visually matches the text's cap
 * height. The handoff doesn't pin an exact ratio for this; 0.72 is a
 * standard grotesque-sans cap-height approximation, applied uniformly
 * across the logotype sizes used in the handoff (19–56px).
 */
const SYMBOL_CAP_HEIGHT_RATIO = 0.72;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** `fontSize * -0.04` rounded to 2 decimals — RN wants letterSpacing in px, not em. */
function letterSpacingPx(fontSize: number): number {
  return Math.round(fontSize * TRACKING_EM * 100) / 100;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type WordmarkProps = {
  /** Font size of the wordmark text; the symbol is sized to match its cap height. */
  size?: number;
  /** Theme color-token key (default `ink`), or a raw hex/rgba string. */
  color?: TextColor;
  /** Plays the symbol's meet-in-the-middle entrance (splash, task completion). */
  animated?: boolean;
  /** Change this value to (re)trigger the symbol's entrance animation. */
  animationKey?: number | string;
  /** Monochromatic symbol treatment: full-opacity left half + 45%-opacity right half. */
  mono?: boolean;
};

export function Wordmark({
  size = DEFAULT_SIZE,
  color = "ink",
  animated,
  animationKey,
  mono,
}: WordmarkProps) {
  const symbolSize = Math.round(size * SYMBOL_CAP_HEIGHT_RATIO);

  return (
    <View style={styles.row}>
      <OrgSymbol size={symbolSize} animated={animated} animationKey={animationKey} mono={mono} />
      <Display
        size={size}
        color={color}
        style={[styles.text, { letterSpacing: letterSpacingPx(size) }]}
      >
        rganizados
      </Display>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  text: {
    marginLeft: SYMBOL_GAP,
  },
});
