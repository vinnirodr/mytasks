/**
 * Organizados — Design-system gallery
 *
 * Dev-only showcase of every primitive built in Plan 6a (T1–T7), so a human
 * (or the simulator-verification step of Task 8) can eyeball every component
 * in both themes without hunting through real screens. Reachable from the
 * Home tab's "Design system" link; also registered as a (visible) tab in
 * `AppTabs` because the root layout's `NativeTabs` only ever registers
 * routes that are declared as `<NativeTabs.Trigger>` children — an
 * undeclared `app/ds-gallery.tsx` file would exist on disk but never be
 * reachable via `Link`/`router.push`, since `NativeTabs` (unlike a `Stack`)
 * builds its route table exclusively from its own trigger children.
 */

import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar, AvatarStack, type AvatarStackPerson } from "@/components/Avatar";
import { BottomNav, type BottomNavKey } from "@/components/BottomNav";
import { OrgSymbol } from "@/components/brand/OrgSymbol";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { StatusChip, type TaskStatus } from "@/components/StatusChip";
import { TaskCheckbox, type TaskCheckboxState } from "@/components/TaskCheckbox";
import { Body, BodyStrong, Caption, Display, Mono, Title } from "@/components/Text";
import { TextField } from "@/components/TextField";
import type { ThemeOverride } from "@/theme/ThemeProvider";
import { useTheme } from "@/theme/useTheme";

// ---------------------------------------------------------------------------
// Static demo data
// ---------------------------------------------------------------------------

const AVATAR_STACK_PEOPLE: AvatarStackPerson[] = [
  { id: "marina", name: "Marina", person: "marina" },
  { id: "joana", name: "Joana", person: "joana" },
  { id: "pedro", name: "Pedro", person: "pedro" },
  { id: "carlos", name: "Carlos", person: "carlos" },
];

const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

const TASK_CHECKBOX_STATES: TaskCheckboxState[] = ["idle", "done", "deferred"];

const TASK_STATUSES: TaskStatus[] = ["pending", "late", "done", "deferred", "missed"];

const NEXT_OVERRIDE: Record<ThemeOverride, ThemeOverride> = {
  system: "light",
  light: "dark",
  dark: "system",
};

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Mono style={styles.sectionLabel}>{label}</Mono>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function DesignSystemGalleryScreen() {
  const theme = useTheme();
  const { colors, spacing } = theme;

  const [fieldValue, setFieldValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("hunter2");
  const [marinaSelected, setMarinaSelected] = useState(true);
  const [joanaSelected, setJoanaSelected] = useState(false);
  const [selectedDay, setSelectedDay] = useState(2);
  const [navKey, setNavKey] = useState<BottomNavKey>("hoje");

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: spacing.screenX, paddingBottom: 140 },
          ]}
        >
          <View style={styles.header}>
            <Title>Design system</Title>
            <Button
              title={`TEMA: ${theme.override.toUpperCase()} (${theme.mode})`}
              variant="outline"
              onPress={() => theme.setOverride(NEXT_OVERRIDE[theme.override])}
            />
          </View>

          <Section label="Marca">
            <View style={styles.row}>
              <Wordmark size={34} />
              <Wordmark size={19} />
            </View>
            <View style={[styles.row, styles.alignCenter]}>
              <OrgSymbol size={96} />
              <OrgSymbol size={44} />
              <OrgSymbol size={24} />
              <OrgSymbol size={44} mono />
            </View>
          </Section>

          <Section label="Tipografia">
            <Display size={56}>56</Display>
            <Display size={34}>Título 34</Display>
            <Title>Title — Manrope 800</Title>
            <Body>Body — Manrope 400, texto corrido para leitura confortável.</Body>
            <BodyStrong>BodyStrong — Manrope 700</BodyStrong>
            <Caption>Caption — legenda discreta</Caption>
            <Mono>Mono — rótulo de dado</Mono>
          </Section>

          <Section label="Botões">
            <View style={styles.stack}>
              <Button title="Primário" variant="primary" onPress={() => {}} />
              <Button title="Tangerina" variant="tangerine" onPress={() => {}} />
              <Button title="Outline" variant="outline" onPress={() => {}} />
              <Button title="Perigo" variant="danger" onPress={() => {}} />
              <Button title="Desabilitado" variant="primary" disabled onPress={() => {}} />
            </View>
          </Section>

          <Section label="Campos">
            <View style={styles.stack}>
              <TextField label="E-mail" value={fieldValue} onChangeText={setFieldValue} placeholder="voce@exemplo.com" />
              <TextField
                label="Senha"
                value={passwordValue}
                onChangeText={setPasswordValue}
                secureTextEntry
                strength={2}
              />
            </View>
          </Section>

          <Section label="Card">
            <Card>
              <View style={{ padding: 16 }}>
                <BodyStrong>Levar o lixo</BodyStrong>
                <Caption>Todo dia, à noite</Caption>
              </View>
            </Card>
          </Section>

          <Section label="Chips">
            <View style={styles.row}>
              <Chip
                label="Marina"
                variant="person"
                selected={marinaSelected}
                onPress={() => setMarinaSelected((value) => !value)}
              />
              <Chip
                label="Joana"
                variant="person"
                selected={joanaSelected}
                onPress={() => setJoanaSelected((value) => !value)}
              />
            </View>
            <View style={styles.row}>
              {DAY_LABELS.map((label, index) => (
                <Chip
                  // eslint-disable-next-line react/no-array-index-key
                  key={`day-${index}`}
                  label={label}
                  variant="day"
                  selected={index === selectedDay}
                  onPress={() => setSelectedDay(index)}
                />
              ))}
            </View>
          </Section>

          <Section label="Avatares">
            <AvatarStack people={AVATAR_STACK_PEOPLE} size={34} />
            <View style={[styles.row, styles.alignCenter]}>
              <Avatar name="Marina" person="marina" size={44} />
              <Avatar name="Joana" person="joana" size={44} />
              <Avatar name="Pedro" person="pedro" size={44} />
              <Avatar name="Carlos" person="carlos" size={44} />
            </View>
          </Section>

          <Section label="Checkbox de tarefa">
            <View style={[styles.row, styles.alignCenter]}>
              {TASK_CHECKBOX_STATES.map((state) => (
                <TaskCheckbox key={state} state={state} onToggle={() => {}} />
              ))}
            </View>
          </Section>

          <Section label="Status">
            <View style={[styles.row, styles.wrap]}>
              {TASK_STATUSES.map((status) => (
                <StatusChip key={status} status={status} />
              ))}
            </View>
          </Section>

          <Section label="Navegação">
            <Caption>BottomNav fixado no rodapé (activeKey = &quot;{navKey}&quot;).</Caption>
          </Section>
        </ScrollView>
      </SafeAreaView>

      <View style={[styles.navPin, { paddingHorizontal: spacing.screenX }]}>
        <BottomNav activeKey={navKey} onChange={setNavKey} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 28,
    paddingTop: 12,
  },
  header: {
    gap: 12,
    alignItems: "flex-start",
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  wrap: {
    flexWrap: "wrap",
  },
  alignCenter: {
    alignItems: "center",
  },
  stack: {
    gap: 12,
  },
  navPin: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
  },
});
