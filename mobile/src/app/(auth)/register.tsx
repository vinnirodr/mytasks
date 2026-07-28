/**
 * Organizados — Criar conta (handoff screen 6)
 *
 * Plan 6b, Task 8. Layout per docs/design/handoff/README.md: "voltar
 * circular; campos Nome (focado: borda 2px `forest` no dia, `accent` na
 * noite), E-mail, Senha com medidor de força em 3 barras (5px, raio total);
 * checkbox quadrado 24px raio 8px; botão tangerina." Auth screens use the
 * 24px side margin (`spacing.screenXAuth`); the Nome/E-mail focus-ring color
 * is `TextField`'s built-in `action`-colored border, so no extra styling is
 * needed here.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Link } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/Button';
import { Display, Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useTheme } from '@/theme/useTheme';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simple 0–3 password-strength score from length + character-class variety
 * (lower/upper/digit/symbol) — the handoff's 3-bar meter doesn't specify an
 * exact formula, only that it drives `TextField`'s `strength` prop.
 */
function computeStrength(password: string): 0 | 1 | 2 | 3 {
  if (password.length === 0) return 0;

  let variety = 0;
  if (/[a-z]/.test(password)) variety += 1;
  if (/[A-Z]/.test(password)) variety += 1;
  if (/[0-9]/.test(password)) variety += 1;
  if (/[^A-Za-z0-9]/.test(password)) variety += 1;

  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (variety >= 3) score += 1;

  return Math.min(3, score) as 0 | 1 | 2 | 3;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RegisterScreen() {
  const theme = useTheme();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(name && email && password && acceptedTerms) && !isPending;

  async function handleSubmit() {
    setError(null);
    setIsPending(true);
    try {
      await register(email, password, name);
    } catch {
      setError('Não foi possível criar a conta. Tente novamente.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: theme.spacing.screenXAuth },
          ]}
          keyboardShouldPersistTaps="handled"
        >
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
            Criar conta
          </Display>

          <View style={styles.fields}>
            <TextField label="Nome" value={name} onChangeText={setName} placeholder="Seu nome" />
            <TextField
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@exemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextField
              label="Senha"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              strength={computeStrength(password)}
            />
          </View>

          <Pressable
            style={styles.termsRow}
            onPress={() => setAcceptedTerms((prev) => !prev)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            testID="terms-checkbox"
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: acceptedTerms ? theme.action : theme.colors.border,
                  backgroundColor: acceptedTerms ? theme.action : 'transparent',
                },
              ]}
            >
              {acceptedTerms ? (
                <MaterialIcons name="check" size={16} color={theme.onAction} />
              ) : null}
            </View>
            <Text color="inkMuted" style={styles.termsText}>
              Li e aceito os termos de uso e privacidade.
            </Text>
          </Pressable>

          {error ? (
            <Text color="danger" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Button
            title="Criar conta"
            variant="tangerine"
            onPress={() => {
              void handleSubmit();
            }}
            disabled={!canSubmit}
          />

          <View style={styles.footer}>
            <Text color="inkMuted">Já tem conta? </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text variant="bodyStrong" color={theme.action}>
                  Entrar
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
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
    flexGrow: 1,
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
  fields: {
    gap: 16,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsText: {
    flex: 1,
  },
  error: {
    marginTop: -8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
});
