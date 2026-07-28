/**
 * Organizados — Avatar / AvatarStack
 *
 * Circular initials avatar (docs/design/handoff/README.md, "Avatares
 * (iniciais)"): a fixed 4-person palette (`avatarColors`, theme-aware) for
 * named household members, plus a deterministic fallback for anyone else so
 * an unresolved assignee still gets a stable, non-random color instead of
 * always the same one. `AvatarStack` overlaps a row of these with a
 * 2px border cut from the container background (README: "Empilhamento").
 */

import { useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import type { avatarColors } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

import { Text } from "./Text";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvatarPerson = keyof typeof avatarColors;

export type AvatarProps = {
  /** Full name; used to derive initials when `initials` isn't given, and to seed the fallback color. */
  name?: string;
  /** Explicit 1-2 letter initials. Overrides initials derived from `name`. */
  initials?: string;
  /** Known household member — resolves to its `avatarColors` pair. Omit for a deterministic fallback. */
  person?: AvatarPerson;
  /** Diameter in px. Defaults to 34 (task-card avatar); also used at 44 and 62. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const DEFAULT_SIZE = 34;

// Fallback palette for people without a dedicated `avatarColors` entry —
// reuses the same 4 pairs (never invents a new hex) picked deterministically
// from the name/initials, so a given person always renders the same color.
const FALLBACK_PEOPLE: AvatarPerson[] = ["marina", "joana", "pedro", "carlos"];

/** First two letters of the first word, uppercased — "Marina Silva" → "MA". */
function initialsFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/);
  const [first] = words;
  if (first.length >= 2) return first.slice(0, 2).toUpperCase();
  const second = words[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

export function Avatar({ name, initials, person, size = DEFAULT_SIZE, style, testID }: AvatarProps) {
  const theme = useTheme();
  const { avatarColors: palette, isDark } = theme;

  const resolvedInitials = (initials ?? (name ? initialsFromName(name) : "")).slice(0, 2);

  const fallbackPerson = useMemo(() => {
    const seed = name ?? resolvedInitials ?? "";
    return FALLBACK_PEOPLE[hashString(seed) % FALLBACK_PEOPLE.length];
  }, [name, resolvedInitials]);

  const resolvedPerson = person ?? fallbackPerson;
  const pair = palette[resolvedPerson][isDark ? "dark" : "light"];

  return (
    <View
      testID={testID}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: pair.bg,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text variant="title" weight="bold" size={Math.round(size * 0.4)} color={pair.text}>
        {resolvedInitials}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// AvatarStack
// ---------------------------------------------------------------------------

export type AvatarStackPerson = {
  id: string;
  name?: string;
  initials?: string;
  person?: AvatarPerson;
};

export type AvatarStackProps = {
  people: AvatarStackPerson[];
  /** Diameter in px, shared by every avatar in the stack. Defaults to 34. */
  size?: number;
  /** Cap on rendered avatars; the remainder collapses into a trailing `+N` chip. */
  max?: number;
  /** Border color cut around each avatar. Defaults to the theme's `bg` (the usual container background). */
  borderColor?: string;
};

export function AvatarStack({ people, size = DEFAULT_SIZE, max, borderColor }: AvatarStackProps) {
  const theme = useTheme();
  const resolvedBorderColor = borderColor ?? theme.colors.bg;
  // README "Empilhamento": −9px overlap, −10px specifically at the 34px size.
  const overlap = size === DEFAULT_SIZE ? -10 : -9;

  const visibleCount = max && people.length > max ? Math.max(max - 1, 1) : people.length;
  const visible = people.slice(0, visibleCount);
  const overflow = people.length - visible.length;

  return (
    <View style={{ flexDirection: "row" }}>
      {visible.map((entry, index) => (
        <Avatar
          key={entry.id}
          name={entry.name}
          initials={entry.initials}
          person={entry.person}
          size={size}
          style={{
            marginLeft: index === 0 ? 0 : overlap,
            borderWidth: 2,
            borderColor: resolvedBorderColor,
          }}
        />
      ))}
      {overflow > 0 ? (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            marginLeft: overlap,
            borderWidth: 2,
            borderColor: resolvedBorderColor,
            backgroundColor: theme.colors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text variant="mono" size={Math.round(size * 0.32)} color="inkMuted">
            +{overflow}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
