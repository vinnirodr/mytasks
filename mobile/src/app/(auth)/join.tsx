/**
 * Organizados — Inserir código (handoff screens 5 & 11 footer link)
 *
 * Plan 6c, Task 6. Reached from the login footer ("Recebeu um convite?
 * Inserir código") and from "Meus ambientes"' matching footer link (screen
 * 11). Takes the invite token pasted from an invite the user received
 * outside a deep link, then hands off to the same accept-invite route a
 * deep link would open: `(auth)/invite/[token]`.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Link, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { Button } from '@/components/Button';
import { Display, Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useTheme } from '@/theme/useTheme';

export default function JoinScreen() {
  const theme = useTheme();
  const [token, setToken] = useState('');

  const trimmedToken = token.trim();
  const canContinue = trimmedToken.length > 0;

  function handleContinue() {
    if (!canContinue) return;
    router.push(`/(auth)/invite/${trimmedToken}`);
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.content, { paddingHorizontal: theme.spacing.screenXAuth }]}>
          <Link href="/(auth)/login" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              style={{
                ...styles.back,
                width: theme.heights.iconButton,
                height: theme.heights.iconButton,
                borderRadius: theme.heights.iconButton / 2,
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              }}
            >
              <MaterialIcons name="arrow-back" size={20} color={theme.colors.ink} />
            </Pressable>
          </Link>

          <Display size={32} style={styles.headline}>
            Inserir código
          </Display>

          <Text color="inkMuted" style={styles.helper}>
            Cole abaixo o código do convite que você recebeu para entrar em um ambiente.
          </Text>

          <View style={styles.fields}>
            <TextField
              label="Código do convite"
              value={token}
              onChangeText={setToken}
              placeholder="Ex: AB12CD34"
              autoCapitalize="none"
            />
          </View>

          <Button title="Continuar" onPress={handleContinue} disabled={!canContinue} />
        </View>
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
  },
  content: {
    flex: 1,
    gap: 20,
    paddingVertical: 32,
  },
  back: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headline: {
    marginTop: 4,
  },
  helper: {
    marginTop: -8,
  },
  fields: {
    gap: 16,
  },
});
