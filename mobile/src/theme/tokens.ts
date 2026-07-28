/**
 * Organizados — Design Tokens
 *
 * Single source of truth: docs/design/handoff/README.md ("Design Tokens").
 * Values below are copied verbatim from that document. Do not hand-tune a
 * hex/px value here — update the handoff doc first, then mirror it here.
 */

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

export const lightColors = {
  bg: "#F2EDE4",
  surface: "#FFFDF9",
  ink: "#1A1714",
  inkMuted: "#6E655B",
  inkDim: "#8A8076",
  inkFaint: "#A0968A",
  inkPlaceholder: "#B3A99C",
  forest: "#123B2E",
  onForest: "#F2EDE4",
  forestSoft: "#A8C4B6",
  tangerine: "#FF5A2B",
  butter: "#FFD65A",
  butterBg: "#FFF1D6",
  butterInk: "#6A5518",
  danger: "#C7381F",
  dangerBg: "#FFE9E0",
  live: "#7BD8A6",
  border: "#E2DACD",
  borderDashed: "#D3C9BB",
  divider: "#EFE8DC",
  checkboxIdle: "#C9BFB2",
} as const;

export const darkColors = {
  bg: "#0E1311",
  surface: "#18211D",
  surfaceSheet: "#131A17",
  ink: "#F3EFE6",
  inkMuted: "#8F9A91",
  inkDim: "#7A857D",
  inkFaint: "#6F7A73",
  inkPlaceholder: "#5C665F",
  accent: "#F2C744",
  onAccent: "#2A2306",
  navActive: "#F3EFE6",
  danger: "#FF7A4D",
  dangerBg: "#241813",
  dangerInk: "#FF9973",
  live: "#6FCB9B",
  border: "rgba(243,239,230,0.07)",
  borderStrong: "rgba(243,239,230,0.09)",
  overlaySoft: "rgba(243,239,230,0.08)",
  scrim: "rgba(4,7,6,0.62)",
  // Day-theme keys kept so components can read the same key names across
  // themes. Per the handoff note: "no tema noite a elevação vem de
  // luminosidade + fio; o verde-mata vira estrutura" — forest/forestSoft/
  // onForest are structural (not the accent action color) at night, and
  // butter/tangerine are not restated with new night hexes in the README,
  // so they're carried through from the day palette for structural reuse
  // (e.g. avatar/illustration accents that aren't the night "accent" role).
  forest: lightColors.forest,
  onForest: lightColors.onForest,
  forestSoft: lightColors.forestSoft,
  tangerine: lightColors.tangerine,
  butter: lightColors.butter,
  butterBg: lightColors.butterBg,
  butterInk: lightColors.butterInk,
} as const;

// `ResolvedColors` is "whichever palette is currently active" — a union, not
// an intersection. (An intersection would collapse to `never` for every key
// whose light/dark values differ, e.g. `bg`, since TypeScript can't inhabit
// a type that must simultaneously equal two different string literals.)
export type ResolvedColors = typeof lightColors | typeof darkColors;

// Every color token key used across either theme (day-only keys like
// `checkboxIdle` and night-only keys like `accent` are both included), for
// call sites that need to name a token key without holding a resolved value.
export type ColorKey = keyof typeof lightColors | keyof typeof darkColors;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

export const spacing = {
  screenX: 22,
  screenXAuth: 24,
  cardGap: 12,
  sectionGap: 20,
} as const;

// ---------------------------------------------------------------------------
// Radius
// ---------------------------------------------------------------------------

export const radius = {
  hero: 28,
  task: 22,
  small: 20,
  field: 18,
  dayChip: 16,
  pill: 999,
  sheet: 34,
} as const;

// ---------------------------------------------------------------------------
// Heights
// ---------------------------------------------------------------------------

export const heights = {
  button: 58,
  field: 56,
  nav: 62,
  personChip: 44,
  dayChip: 46,
  iconButton: 38,
  touch: 44,
} as const;

// ---------------------------------------------------------------------------
// Typography scale
// ---------------------------------------------------------------------------

export const fontSize = {
  // Bricolage Grotesque 800 — hero number, display headings.
  display: [56, 44, 34, 32, 30, 28, 24, 22, 19] as const,
  // Manrope 400/600/700/800 — interface and body text.
  text: [17, 16, 15.5, 15, 14, 13.5, 13, 12.5] as const,
  // IBM Plex Mono 400/500 — data labels, always uppercase.
  mono: [13, 11.5, 11, 10.5] as const,
} as const;

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

export const avatarColors = {
  marina: {
    light: { bg: "#123B2E", text: "#F2EDE4" },
    dark: { bg: "#F2C744", text: "#2A2306" },
  },
  joana: {
    light: { bg: "#D9C7A8", text: "#4A3A22" },
    dark: { bg: "#3A4A40", text: "#D6DDD5" },
  },
  pedro: {
    light: { bg: "#F0A98C", text: "#5A2A16" },
    dark: { bg: "#4A3B33", text: "#F0C3AC" },
  },
  carlos: {
    light: { bg: "#A8C4B6", text: "#17402F" },
    dark: { bg: "#2F4038", text: "#A8C4B6" },
  },
} as const;

// ---------------------------------------------------------------------------
// Shadows (day theme only — night elevation comes from luminosity + hairline)
// ---------------------------------------------------------------------------

type ShadowPreset = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

export const shadow: Record<
  "card" | "floating" | "primaryForest" | "primaryTangerine" | "hero",
  ShadowPreset
> = {
  // 0 2px 8px rgba(26,23,20,0.07)
  card: {
    shadowColor: "#1A1714",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  // 0 4px 16px rgba(26,23,20,0.10)
  floating: {
    shadowColor: "#1A1714",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  // 0 8px 20px rgba(18,59,46,0.26)
  primaryForest: {
    shadowColor: "#123B2E",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 20,
    elevation: 8,
  },
  // 0 8px 20px rgba(255,90,43,0.32)
  primaryTangerine: {
    shadowColor: "#FF5A2B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 8,
  },
  // 0 10px 24px rgba(18,59,46,0.22)
  hero: {
    shadowColor: "#123B2E",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;
