/**
 * Organizados — Onboarding (handoff screens 2–4)
 *
 * Plan 6c, Task 4. Three horizontally-paged screens shown on first run
 * (`(auth)/index.tsx` routes here when `prefsStore.getOnboardingSeen()` is
 * false). Layout per docs/design/handoff/README.md, "2–4. Onboarding":
 * header with a small logotype left + "Pular" (700/14) right; a composed
 * hero built from real UI fragments per screen (never illustrations) —
 * page 1: a "3/7" hero chip + three task-card rows; page 2: a day strip +
 * two person-chip cards; page 3: a "SÓ ESTA SEMANA" exception card + an
 * overload notice; a display title (32) + body (15.5); and a footer with
 * dot indicators (active = 24×7 pill in `action`, inactive = 7×7 muted) on
 * the left and a CTA on the right — "Continuar" (tangerine) on pages 1–2,
 * "Começar" (primary) on page 3. Both "Pular" and the final CTA mark
 * onboarding seen and go to login (README, "Interactions": "'Pular' leva
 * direto ao login... Exibir só na primeira execução.").
 */

import { useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { AvatarStack } from '@/components/Avatar';
import { Wordmark } from '@/components/brand/Wordmark';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Body, Display, Mono, Text } from '@/components/Text';
import { TaskCheckbox, type TaskCheckboxState } from '@/components/TaskCheckbox';
import { prefsStore } from '@/prefs/prefsStore';
import { useTheme } from '@/theme/useTheme';

// ---------------------------------------------------------------------------
// Hero fragments — page 1: "hero 3/7 + três cartões de tarefa"
// ---------------------------------------------------------------------------

function HeroFraction() {
  const theme = useTheme();
  const backgroundColor = theme.isDark ? theme.colors.ink : theme.colors.forest;

  return (
    <View style={[styles.heroFraction, { backgroundColor, borderRadius: theme.radius.hero }]}>
      <Mono color="onForest">HOJE</Mono>
      <View style={styles.heroFractionRow}>
        <Display size={44} color="onForest">
          3
        </Display>
        <Display size={26} color="forestSoft" style={styles.heroFractionDenominator}>
          /7
        </Display>
      </View>
    </View>
  );
}

function MiniTaskRow({
  title,
  meta,
  state,
}: {
  title: string;
  meta: string;
  state: TaskCheckboxState;
}) {
  return (
    <Card style={styles.taskCard}>
      <TaskCheckbox state={state} onToggle={() => {}} size={26} />
      <View style={styles.taskCardText}>
        <Text variant="title" size={14.5} numberOfLines={1}>
          {title}
        </Text>
        <Mono size={10.5}>{meta}</Mono>
      </View>
    </Card>
  );
}

function TaskListHero() {
  return (
    <View style={styles.heroRow}>
      <HeroFraction />
      <View style={styles.taskList}>
        <MiniTaskRow title="Lavar a louça" meta="ATÉ 20:00" state="idle" />
        <MiniTaskRow title="Tirar o lixo" meta="FEITA ÀS 08:12" state="done" />
        <MiniTaskRow title="Passear com o cão" meta="ADIADA" state="deferred" />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Hero fragments — page 2: "faixa de dias + dois cartões com chip de pessoa"
// ---------------------------------------------------------------------------

const WEEK_STRIP = ['S', 'T', 'Q', 'Q', 'S'];

function AssignmentsHero() {
  return (
    <View style={styles.assignmentsHero}>
      <View style={styles.dayStrip}>
        {WEEK_STRIP.map((label, index) => (
          <Chip key={`${label}-${index}`} label={label} variant="day" selected={index === 2} />
        ))}
      </View>
      <View style={styles.taskList}>
        <Card style={styles.personCard}>
          <Chip label="Joana" variant="person" selected />
          <Text variant="title" size={15} numberOfLines={1} style={styles.personCardText}>
            Regar as plantas
          </Text>
        </Card>
        <Card style={styles.personCard}>
          <Chip label="Pedro" variant="person" />
          <Text variant="title" size={15} numberOfLines={1} style={styles.personCardText}>
            Passar roupa
          </Text>
        </Card>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Hero fragments — page 3: exception card "SÓ ESTA SEMANA" + overload notice
// ---------------------------------------------------------------------------

function ExceptionHero() {
  const theme = useTheme();

  return (
    <View style={styles.exceptionHero}>
      <Card style={styles.exceptionCard}>
        <View style={[styles.exceptionBadge, { backgroundColor: theme.colors.butterBg }]}>
          <Mono size={10.5} color="butterInk">
            SÓ ESTA SEMANA
          </Mono>
        </View>
        <Text variant="title" size={17} style={styles.exceptionTitle}>
          Trocar de responsável
        </Text>
        <View style={styles.exceptionFooter}>
          <AvatarStack
            people={[
              { id: 'joana', person: 'joana' },
              { id: 'pedro', person: 'pedro' },
            ]}
            size={28}
          />
          <MaterialIcons name="arrow-forward" size={16} color={theme.colors.inkMuted} />
        </View>
      </Card>

      <View style={[styles.notice, { backgroundColor: theme.colors.butterBg }]}>
        <MaterialIcons name="bolt" size={18} color={theme.colors.butterInk} />
        <Body size={13.5} color="butterInk" style={styles.noticeText}>
          Marina está com 6 tarefas essa semana.
        </Body>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Page data
// ---------------------------------------------------------------------------

type OnboardingPage = {
  key: string;
  hero: ReactNode;
  title: string;
  body: string;
};

const PAGES: OnboardingPage[] = [
  {
    key: 'routine',
    hero: <TaskListHero />,
    title: 'Uma rotina, sem esquecer nada.',
    body: 'Cada tarefa tem um responsável e um horário certo. O quadro do dia mostra o que falta, sem grupo de mensagens.',
  },
  {
    key: 'assignments',
    hero: <AssignmentsHero />,
    title: 'Cada um sabe o que é seu.',
    body: 'Defina quem faz o quê e quando. Todo mundo vê a agenda da semana no mesmo lugar.',
  },
  {
    key: 'exceptions',
    hero: <ExceptionHero />,
    title: 'Imprevisto não desmonta o combinado.',
    body: 'Ajuste só esta semana sem mexer na rotina — e receba um aviso se a casa ficar sobrecarregada.',
  },
];

// ---------------------------------------------------------------------------
// Dots
// ---------------------------------------------------------------------------

function Dots({ count, activeIndex }: { count: number; activeIndex: number }) {
  const theme = useTheme();

  return (
    <View style={styles.dots}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={{
            width: index === activeIndex ? 24 : 7,
            height: 7,
            borderRadius: 999,
            backgroundColor: index === activeIndex ? theme.action : theme.colors.inkFaint,
          }}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function OnboardingScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const lastIndex = PAGES.length - 1;
  const isLastPage = activeIndex === lastIndex;

  function finishOnboarding() {
    void prefsStore.setOnboardingSeen();
    router.replace('/(auth)/login');
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offsetX = event.nativeEvent.contentOffset.x;
    const rawIndex = width > 0 ? Math.round(offsetX / width) : 0;
    const clamped = Math.max(0, Math.min(lastIndex, rawIndex));
    setActiveIndex(clamped);
  }

  function handlePrimaryPress() {
    if (isLastPage) {
      finishOnboarding();
      return;
    }

    const nextIndex = Math.min(lastIndex, activeIndex + 1);
    scrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
    setActiveIndex(nextIndex);
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.header, { paddingHorizontal: theme.spacing.screenXAuth }]}>
          <Wordmark size={20} />
          <Pressable
            onPress={finishOnboarding}
            hitSlop={12}
            accessibilityRole="button"
            style={styles.skipButton}
          >
            <Text variant="bodyStrong" size={14}>
              Pular
            </Text>
          </Pressable>
        </View>

        <ScrollView
          testID="onboarding-pager"
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.pager}
        >
          {PAGES.map((page) => (
            <View key={page.key} style={{ width }}>
              <View
                style={[styles.pageContent, { paddingHorizontal: theme.spacing.screenXAuth }]}
              >
                <View style={styles.heroArea}>{page.hero}</View>
                <Display size={32} style={styles.title}>
                  {page.title}
                </Display>
                <Body style={styles.body}>{page.body}</Body>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.footer, { paddingHorizontal: theme.spacing.screenXAuth }]}>
          <Dots count={PAGES.length} activeIndex={activeIndex} />
          <Button
            title={isLastPage ? 'Começar' : 'Continuar'}
            variant={isLastPage ? 'primary' : 'tangerine'}
            onPress={handlePrimaryPress}
          />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  skipButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  pager: {
    flex: 1,
  },
  pageContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 22,
  },
  heroArea: {
    justifyContent: 'center',
  },
  title: {
    marginTop: 4,
  },
  body: {
    marginTop: -8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 12,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  // Hero — page 1
  heroRow: {
    gap: 14,
  },
  heroFraction: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 6,
  },
  heroFractionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  heroFractionDenominator: {
    marginLeft: 2,
    marginBottom: 3,
  },
  taskList: {
    gap: 10,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  taskCardText: {
    flex: 1,
    gap: 2,
  },

  // Hero — page 2
  assignmentsHero: {
    gap: 16,
  },
  dayStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  personCardText: {
    flex: 1,
  },

  // Hero — page 3
  exceptionHero: {
    gap: 12,
  },
  exceptionCard: {
    padding: 16,
    gap: 10,
  },
  exceptionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  exceptionTitle: {
    marginTop: 2,
  },
  exceptionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 20,
  },
  noticeText: {
    flex: 1,
  },
});
