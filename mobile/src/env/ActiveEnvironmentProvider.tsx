/**
 * Organizados — Active environment context (Plan 6d, Task 4)
 *
 * Owns "which environment is currently shown" for the signed-in app group:
 * loads the member's environments (`environmentsApi.list()`), resolves the
 * active one against the persisted choice (`prefsStore`), and exposes a
 * `setActive`/`reload` API so the daily board (T5), task detail (T6), and
 * the live-WS wiring (T7) all read/switch environment from one place.
 */

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { environmentsApi, type Environment } from "@/api/environments";
import { prefsStore } from "@/prefs/prefsStore";

export type ActiveEnvironmentValue = {
  environments: Environment[];
  active: Environment | null;
  setActive: (id: string) => void;
  loading: boolean;
  error: unknown | null;
  reload: () => void;
};

export const ActiveEnvironmentContext = createContext<ActiveEnvironmentValue | null>(null);

/**
 * Pure selection rule (exported so it's unit-testable without React): prefer
 * the persisted id when it's still present in the list, otherwise fall back
 * to the first environment; an empty list always resolves to `null`.
 */
export function pickActiveEnvironment(
  environments: Environment[],
  persistedId: string | null,
): Environment | null {
  if (environments.length === 0) {
    return null;
  }

  if (persistedId) {
    const persisted = environments.find((env) => env.id === persistedId);
    if (persisted) {
      return persisted;
    }
  }

  return environments[0];
}

export function ActiveEnvironmentProvider({ children }: { children: ReactNode }) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [active, setActiveState] = useState<Environment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await environmentsApi.list();
      const persistedId = await prefsStore.getActiveEnvironmentId();
      const nextActive = pickActiveEnvironment(list, persistedId);

      setEnvironments(list);
      setActiveState(nextActive);

      if (nextActive) {
        await prefsStore.setActiveEnvironmentId(nextActive.id);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setActive = useCallback(
    (id: string) => {
      const found = environments.find((env) => env.id === id);
      if (!found) {
        return;
      }
      setActiveState(found);
      void prefsStore.setActiveEnvironmentId(id);
    },
    [environments],
  );

  const value = useMemo<ActiveEnvironmentValue>(
    () => ({ environments, active, setActive, loading, error, reload: () => void load() }),
    [environments, active, setActive, loading, error, load],
  );

  return (
    <ActiveEnvironmentContext.Provider value={value}>{children}</ActiveEnvironmentContext.Provider>
  );
}
