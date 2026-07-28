/**
 * Organizados — Splash screen
 *
 * Rendered by the root layout's `AuthGate` (src/app/_layout.tsx) while
 * `useAuth().status === "loading"`, i.e. while the stored session is still
 * being validated. Per docs/design/handoff/README.md, screen 1 ("Splash"):
 * full-bleed `forest` background by day / `bg` by night, a 96px animated
 * `OrgSymbol` centered with the 34px `Wordmark` below it, and the
 * "A CASA EM DIA" signature in `Mono` near the bottom.
 *
 * Both background variants are dark (forest #123B2E, night bg #0E1311), so
 * the `onForest` color token — the same cream hex in both palettes, see
 * tokens.ts's "Day-theme keys kept..." note — reads legibly as foreground
 * text/symbol color on either, without branching per theme.
 */

import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OrgSymbol } from '@/components/brand/OrgSymbol';
import { Wordmark } from '@/components/brand/Wordmark';
import { Mono } from '@/components/Text';
import { useTheme } from '@/theme/useTheme';

export function Splash() {
  const theme = useTheme();
  const backgroundColor = theme.isDark ? theme.colors.bg : theme.colors.forest;

  return (
    <View style={[styles.root, { backgroundColor }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <OrgSymbol size={96} animated />
          <View style={styles.wordmarkGap}>
            <Wordmark size={34} color="onForest" />
          </View>
        </View>
        <Mono color="onForest">A CASA EM DIA</Mono>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkGap: {
    marginTop: 16,
  },
});
