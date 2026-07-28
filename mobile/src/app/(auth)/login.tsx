/**
 * Organizados — Entrar (handoff screen 5)
 *
 * Plan 6b, Task 8. Replaces the Task 7 placeholder. Layout per
 * docs/design/handoff/README.md: "logotipo + manchete display 44px 'A casa,
 * em dia.'; campos com rótulo mono acima; botão primário; 'Esqueci minha
 * senha'; rodapé 'Não tem conta? Criar conta'." Auth screens use the 24px
 * side margin (`spacing.screenXAuth`).
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Link } from 'expo-router';

import { Button } from '@/components/Button';
import { Display, Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Wordmark } from '@/components/brand/Wordmark';
import { useAuth } from '@/auth/useAuth';
import { useTheme } from '@/theme/useTheme';

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setIsPending(true);
    try {
      await signIn(email, password);
    } catch {
      setError('E-mail ou senha inválidos');
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
          <Wordmark size={34} />

          <Display size={44} style={styles.headline}>
            A casa, em dia.
          </Display>

          <View style={styles.fields}>
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
            />
          </View>

          {error ? (
            <Text color="danger" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Button
            title="Entrar"
            onPress={() => {
              void handleSubmit();
            }}
            disabled={isPending || !email || !password}
          />

          <Pressable onPress={() => {}} style={styles.forgotLink}>
            <Text variant="bodyStrong" color={theme.action}>
              Esqueci minha senha
            </Text>
          </Pressable>

          <View style={styles.footer}>
            <Text color="inkMuted">Não tem conta? </Text>
            <Link href="/(auth)/register" asChild>
              <Pressable>
                <Text variant="bodyStrong" color={theme.action}>
                  Criar conta
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
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 32,
  },
  headline: {
    marginTop: 4,
  },
  fields: {
    gap: 16,
    marginTop: 8,
  },
  error: {
    marginTop: -8,
  },
  forgotLink: {
    alignSelf: 'center',
    marginTop: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
});
