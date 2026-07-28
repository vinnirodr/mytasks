/**
 * Organizados — SectionHeader
 *
 * Daily-board list section title (docs/design/handoff/README.md, "Quadro do
 * dia"): a 19px Display title with a 2-digit Mono counter at the trailing
 * edge — "Atrasadas" counts in `danger` (the section only ever renders when
 * there's at least one late occurrence), "Hoje" counts in the neutral
 * `inkFaint` tone.
 */

import { View } from "react-native";

import { Display, Mono } from "./Text";

export type SectionHeaderProps = {
  title: string;
  count: number;
  tone?: "default" | "danger";
};

export function SectionHeader({ title, count, tone = "default" }: SectionHeaderProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
      <Display size={19}>{title}</Display>
      <Mono size={12} color={tone === "danger" ? "danger" : "inkFaint"}>
        {String(count).padStart(2, "0")}
      </Mono>
    </View>
  );
}
