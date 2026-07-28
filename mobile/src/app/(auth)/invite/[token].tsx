/**
 * Organizados — Aceitar convite (handoff screen 7)
 *
 * Plan 6c, Task 5. Deep-link route for an invite ("organizados://invite/
 * <token>", or the equivalent web/Universal Link). Reads `token` from the
 * dynamic route, previews it via `invitesApi.preview` (loading/error
 * states), then renders the handoff card: `forest` card (raio `hero`) with
 * a mail icon in a 62px `butter` circle, a display title, the environment
 * name emphasized, and an `AvatarStack` built from the preview's members.
 *
 * The two CTAs ("Aceitar convite" / "Agora não") sit below the card on the
 * screen's normal background rather than inside it: `Button`'s `outline`
 * variant is styled for the `action` color against `colors.bg`, which
 * would be unreadable painted on top of the same `forest` used for the
 * card itself, so this keeps both buttons legible without forking Button
 * for a one-off inverted variant.
 *
 * Accepting: signed-in users accept immediately and land in `(app)`.
 * Signed-out users stash the token (`@/auth/pendingInvite`) and go
 * register — `AuthProvider` accepts it for them once sign-in succeeds
 * (see AuthProvider.tsx).
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { invitesApi, type InvitePreview } from '@/api/invites';
import { setPendingInvite } from '@/auth/pendingInvite';
import { useAuth } from '@/auth/useAuth';
import { AvatarStack } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Display, Mono, Text } from '@/components/Text';
import { useTheme } from '@/theme/useTheme';

const INVALID_INVITE_MESSAGE = 'Convite inválido ou expirado';

export default function AcceptInviteScreen() {
  const theme = useTheme();
  const { colors, spacing, radius } = theme;
  const { status } = useAuth();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setIsLoadingPreview(false);
      setPreviewFailed(true);
      return;
    }

    let cancelled = false;
    setIsLoadingPreview(true);
    setPreviewFailed(false);

    invitesApi
      .preview(token)
      .then((result) => {
        if (cancelled) return;
        setPreview(result);
        setIsLoadingPreview(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPreviewFailed(true);
        setIsLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  function goToApp() {
    router.replace('/(app)');
  }

  function handleDecline() {
    router.replace(status === 'signedIn' ? '/(app)' : '/(auth)/login');
  }

  async function handleAccept() {
    if (!token) return;

    if (status !== 'signedIn') {
      setPendingInvite(token);
      router.push('/(auth)/register');
      return;
    }

    setAcceptError(null);
    setIsAccepting(true);
    try {
      await invitesApi.accept(token);
      goToApp();
    } catch {
      setAcceptError('Não foi possível aceitar o convite. Tente novamente.');
      setIsAccepting(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.content, { paddingHorizontal: spacing.screenXAuth }]}>
          {isLoadingPreview ? (
            <View style={styles.centered} testID="invite-loading">
              <ActivityIndicator color={theme.action} size="large" />
              <Text color="inkMuted" style={styles.loadingLabel}>
                Carregando convite…
              </Text>
            </View>
          ) : previewFailed || !preview ? (
            <View style={styles.centered}>
              <Card radius={radius.task} style={styles.errorCard}>
                <Text color="danger" variant="bodyStrong" style={styles.errorText}>
                  {INVALID_INVITE_MESSAGE}
                </Text>
              </Card>
              <Button title="Voltar" variant="outline" onPress={handleDecline} />
            </View>
          ) : (
            <>
              <Card
                radius={radius.hero}
                style={[
                  styles.card,
                  { backgroundColor: colors.forest, borderColor: colors.forest },
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: colors.butter }]}>
                  <MaterialIcons name="mail" size={28} color={colors.butterInk} />
                </View>

                <Display size={28} color="onForest" style={styles.title}>
                  Você foi convidado!
                </Display>

                <Text color="onForest" style={styles.invitedBy}>
                  {preview.invitedByName} te convidou para o ambiente
                </Text>

                <Text variant="bodyStrong" size={19} color="butter" style={styles.envName}>
                  {preview.environmentName}
                </Text>

                <View style={styles.avatarStack}>
                  <AvatarStack
                    people={preview.members.map((member, index) => ({
                      id: `${member.initials}-${index}`,
                      name: member.displayName,
                      initials: member.initials,
                    }))}
                    size={44}
                    borderColor={colors.forest}
                  />
                </View>
              </Card>

              <View style={styles.actions}>
                <Button
                  title="Aceitar convite"
                  variant="tangerine"
                  onPress={() => {
                    void handleAccept();
                  }}
                  disabled={isAccepting}
                />
                <Button title="Agora não" variant="outline" onPress={handleDecline} disabled={isAccepting} />
              </View>

              {acceptError ? (
                <Text color="danger" style={styles.error}>
                  {acceptError}
                </Text>
              ) : null}

              <View style={styles.footer}>
                <Mono color="inkMuted">{preview.email}</Mono>
              </View>
            </>
          )}
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
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 32,
  },
  centered: {
    alignItems: 'center',
    gap: 20,
  },
  loadingLabel: {
    marginTop: 4,
  },
  errorCard: {
    width: '100%',
    padding: 24,
    alignItems: 'center',
  },
  errorText: {
    textAlign: 'center',
  },
  card: {
    padding: 28,
    alignItems: 'center',
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 20,
    textAlign: 'center',
  },
  invitedBy: {
    marginTop: 8,
    textAlign: 'center',
  },
  envName: {
    marginTop: 2,
    textAlign: 'center',
  },
  avatarStack: {
    marginTop: 20,
  },
  actions: {
    gap: 12,
  },
  error: {
    textAlign: 'center',
    marginTop: -8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 4,
  },
});
