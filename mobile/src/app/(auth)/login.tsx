/**
 * Organizados — Login (placeholder)
 *
 * Plan 6b, Task 7 only wires the auth route guard + route groups; the real
 * "Entrar" screen (handoff screen 5) lands in Task 8. This placeholder just
 * makes `/(auth)/login` resolve so `AuthGate`'s `signedOut` branch (see
 * `src/app/_layout.tsx`) has somewhere to render.
 */

import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/brand/Wordmark';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/useTheme';

export default function LoginScreen() {
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      <SafeAreaView style={styles.center}>
        <Wordmark size={34} />
        <Text style={styles.hint}>Login (em breve)</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  hint: {
    marginTop: 4,
  },
});
