import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as RouterThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Splash } from '@/components/Splash';
import { AuthProvider } from '@/auth/AuthProvider';
import { useAuth } from '@/auth/useAuth';
import { ThemeProvider as AppThemeProvider } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AppThemeProvider>
      <AuthProvider>
        <RouterThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <AuthGate />
        </RouterThemeProvider>
      </AuthProvider>
    </AppThemeProvider>
  );
}

/**
 * Auth route guard (Plan 6b, Task 7).
 *
 * While the stored session is still resolving (`status === "loading"`) no
 * Navigator is mounted at all — the brand `Splash` renders instead, the
 * same "block routing until the session is known" shape as Expo Router's
 * own Authentication guide. Once resolved, a `Stack` with two
 * `Stack.Protected` groups mounts exactly one of the two route groups:
 * `(app)` (the tabs) when signed in, `(auth)` (login/register, T8) when
 * signed out. `Stack.Protected`'s `guard` is reactive, so this also covers
 * the reverse transition later — e.g. `signOut()` flips `status` back to
 * "signedOut" and the Stack un-mounts `(app)` in favor of `(auth)` on its
 * own, without a manual `Redirect`.
 */
export function AuthGate() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <Splash />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
