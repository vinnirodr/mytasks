import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {/*
        Dev-only design-system gallery (Plan 6a, Task 8). `NativeTabs` only
        registers routes declared as `<NativeTabs.Trigger>` children — an
        undeclared `app/ds-gallery.tsx` file would never be reachable via
        `Link`/`router.push`, so it has to be a real (visible) tab rather
        than a route the Home screen merely links to.
      */}
      <NativeTabs.Trigger name="ds-gallery">
        <NativeTabs.Trigger.Label>DS</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="paintpalette" md="palette" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
