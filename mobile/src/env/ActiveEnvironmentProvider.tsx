/**
 * Organizados — Active environment context (Plan 6d, Task 4)
 *
 * Owns "which environment is currently shown" for the signed-in app group:
 * loads the member's environments (`environmentsApi.list()`), resolves the
 * active one against the persisted choice (`prefsStore`), and exposes a
 * `setActive`/`reload` API so the daily board (T5), task detail (T6), and
 * the live-WS wiring (T7) all read/switch environment from one place.
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { environmentsApi, type Environment } from "@/api/environments";
import { prefsStore } from "@/prefs/prefsStore";

export type ActiveEnvironmentValue = {
  environments: Environment[];
  active: Environment | null;
  setActive: (id: string) => void;
  addAndActivate: (env: Environment) => void;
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

  // Race guard: `load` is invoked both by the mount effect below and
  // imperatively by `reload()`. Whichever call is most recent "owns"
  // `guardRef.current` — starting a new load cancels whatever request was
  // previously in flight, so a slow/superseded response can never overwrite
  // state a newer request already produced. Mirrors the `cancelled`-flag
  // convention in AuthProvider's bootstrap effect, adapted to a shared ref
  // since this loader has more than one call site.
  const guardRef = useRef<{ cancelled: boolean } | null>(null);

  const load = useCallback(async () => {
    if (guardRef.current) {
      guardRef.current.cancelled = true;
    }
    const guard = { cancelled: false };
    guardRef.current = guard;

    setLoading(true);
    setError(null);
    try {
      const list = await environmentsApi.list();
      const persistedId = await prefsStore.getActiveEnvironmentId();
      const nextActive = pickActiveEnvironment(list, persistedId);

      if (guard.cancelled) {
        return;
      }

      setEnvironments(list);
      setActiveState(nextActive);

      if (nextActive) {
        await prefsStore.setActiveEnvironmentId(nextActive.id);
      }
    } catch (err) {
      if (!guard.cancelled) {
        setError(err);
      }
    } finally {
      if (!guard.cancelled) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();

    return () => {
      if (guardRef.current) {
        guardRef.current.cancelled = true;
      }
    };
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

  // Used right after `environmentsApi.create()` (CreateEnvModal, Plan 6e Task
  // 4): the freshly created environment isn't in `environments` yet — a
  // reload() + setActive(id) pair would race (reload's async list fetch could
  // resolve after/without the new env, and setActive is a no-op for ids not
  // already in the list) — so this inserts it locally (if absent) and
  // activates + persists it directly.
  const addAndActivate = useCallback((env: Environment) => {
    setEnvironments((prev) => (prev.some((existing) => existing.id === env.id) ? prev : [...prev, env]));
    setActiveState(env);
    void prefsStore.setActiveEnvironmentId(env.id);
  }, []);

  const value = useMemo<ActiveEnvironmentValue>(
    () => ({
      environments,
      active,
      setActive,
      addAndActivate,
      loading,
      error,
      reload: () => void load(),
    }),
    [environments, active, setActive, addAndActivate, loading, error, load],
  );

  return (
    <ActiveEnvironmentContext.Provider value={value}>{children}</ActiveEnvironmentContext.Provider>
  );
}
