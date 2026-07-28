/**
 * Organizados — useOnboardingSeen
 *
 * Small async-state hook wrapping `prefsStore.getOnboardingSeen()` for the
 * `(auth)` group's anchor route (`src/app/(auth)/index.tsx`, Plan 6c Task 4):
 * resolves to `"unseen"` on a first-run device (no stored session yet, so the
 * onboarding pager should show before login) or `"seen"` once the user has
 * skipped or finished onboarding at least once. `"loading"` covers the single
 * AsyncStorage read in flight, during which the caller should render
 * `<Splash/>` rather than flashing one screen before the other.
 */

import { useEffect, useState } from "react";

import { prefsStore } from "./prefsStore";

export type OnboardingSeenState = "loading" | "seen" | "unseen";

export function useOnboardingSeen(): OnboardingSeenState {
  const [state, setState] = useState<OnboardingSeenState>("loading");

  useEffect(() => {
    let cancelled = false;

    void prefsStore.getOnboardingSeen().then((seen) => {
      if (!cancelled) {
        setState(seen ? "seen" : "unseen");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
