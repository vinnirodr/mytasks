/**
 * Organizados — MemberPickerSheet
 *
 * Bottom sheet for the task-detail "reatribuir" action (docs/design/handoff
 * README, "14. Ajustar só esta semana (bottom sheet)" — the only bottom-sheet
 * pattern in the handoff; reused here for the member picker since screen 10
 * doesn't specify its own sheet chrome): scrim over the previous screen,
 * sheet with `radius.sheet` (34) top corners and a 44×5px handle, a
 * highlighted "Pegar para mim" row pinned above the member list, then each
 * `Member` as an Avatar + name row (marking "(você)" for the current user).
 */

import { Pressable, ScrollView, View } from "react-native";

import { MaterialIcons } from "@expo/vector-icons";

import type { Member } from "@/api/members";
import { darkColors, lightColors } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

import { Avatar } from "./Avatar";
import { Display, Text } from "./Text";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MemberPickerSheetProps = {
  visible: boolean;
  members: Member[];
  /** The signed-in user's id, so their row can read "(você)" instead of just their name. */
  currentUserId?: string;
  onSelectMember: (member: Member) => void;
  onPickupForMe: () => void;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MemberPickerSheet({
  visible,
  members,
  currentUserId,
  onSelectMember,
  onPickupForMe,
  onClose,
}: MemberPickerSheetProps) {
  const theme = useTheme();
  const { colors, radius, isDark } = theme;

  if (!visible) return null;

  // `scrim`/`overlaySoft` are night-only tokens (`ResolvedColors` is a
  // light/dark union, so `colors.scrim` doesn't type-check without knowing
  // which branch is active) — read them straight off `darkColors` and fall
  // back to a hand-picked translucent dark tone for day, per the brief ("no
  // dia use um scrim escuro translúcido").
  const scrimColor = isDark ? darkColors.scrim : "rgba(26,23,20,0.5)";
  const pickupBg = isDark ? darkColors.overlaySoft : lightColors.butterBg;
  const pickupFg = isDark ? darkColors.accent : lightColors.butterInk;

  return (
    <View
      testID="member-picker-sheet"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <Pressable
        testID="member-picker-scrim"
        accessibilityRole="button"
        accessibilityLabel="Fechar"
        onPress={onClose}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: scrimColor }}
      />

      <View
        style={{
          marginTop: "auto",
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          paddingTop: 10,
          paddingBottom: 28,
          paddingHorizontal: 22,
          maxHeight: "70%",
        }}
      >
        <View
          style={{
            width: 44,
            height: 5,
            borderRadius: 3,
            backgroundColor: colors.border,
            alignSelf: "center",
            marginBottom: 18,
          }}
        />

        <Display size={28} style={{ marginBottom: 14 }}>
          Reatribuir para
        </Display>

        <Pressable
          testID="member-picker-pickup"
          accessibilityRole="button"
          onPress={onPickupForMe}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: radius.field,
            backgroundColor: pickupBg,
            marginBottom: 12,
          }}
        >
          <MaterialIcons name="person-pin" size={22} color={pickupFg} />
          <Text variant="bodyStrong" size={15.5} color={isDark ? "accent" : "butterInk"}>
            Pegar para mim
          </Text>
        </Pressable>

        <ScrollView>
          {members.map((member) => (
            <Pressable
              key={member.id}
              testID={`member-picker-member-${member.userId}`}
              accessibilityRole="button"
              onPress={() => onSelectMember(member)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 10,
              }}
            >
              <Avatar name={member.displayName} initials={member.initials} size={38} />
              <Text variant="body" size={15.5}>
                {member.displayName}
                {member.userId === currentUserId ? " (você)" : ""}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
