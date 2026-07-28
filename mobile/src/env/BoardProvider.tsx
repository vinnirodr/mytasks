/**
 * Organizados — Daily board state context (Plan 6d, Task 4)
 *
 * Loads today's occurrences for the active environment (see
 * `ActiveEnvironmentProvider`) and shares them — plus derived hero stats and
 * atrasadas/hoje sections — with the board screen (T5), task detail (T6),
 * and the live-WS wiring (T7). `applyLocal` lets those consumers patch
 * `occurrences` in place (optimistic updates, WS patches) without a refetch.
 *
 * Task 7 also subscribes this same state to the environment's WebSocket (via
 * `useBoardSocket`) for as long as `active` is set — its `board_update`/
 * `activity` handling and `connected` state are documented in
 * `useBoardSocket.ts`. `connected` is exposed on `BoardValue` for the hero's
 * live dot (`app/(app)/index.tsx`).
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

import { boardApi, todayISO, type Occurrence } from "@/api/board";

import { useActiveEnvironment } from "./useActiveEnvironment";
import { useBoardSocket } from "./useBoardSocket";

export type HeroStats = { done: number; total: number; pct: number };
export type BoardSections = { atrasadas: Occurrence[]; hoje: Occurrence[] };
export type DerivedBoard = { heroStats: HeroStats; sections: BoardSections };

export type BoardValue = {
  occurrences: Occurrence[];
  heroStats: HeroStats;
  sections: BoardSections;
  loading: boolean;
  error: unknown | null;
  refetch: () => void;
  applyLocal: (updater: (prev: Occurrence[]) => Occurrence[]) => void;
  /** Live state of the environment WebSocket (T7) — drives the hero's live dot. */
  connected: boolean;
};

export const BoardContext = createContext<BoardValue | null>(null);

/**
 * Pure, React-free derivation (exported for unit testing): splits today's
 * occurrences into the "atrasadas" (LATE) / "hoje" (everything else) board
 * sections and computes the hero progress stats. The order within each
 * group is preserved from the input — the backend already orders it
 * (POSTPONED last, then by time).
 */
export function deriveBoard(occurrences: Occurrence[]): DerivedBoard {
  const atrasadas: Occurrence[] = [];
  const hoje: Occurrence[] = [];

  for (const occurrence of occurrences) {
    if (occurrence.status === "LATE") {
      atrasadas.push(occurrence);
    } else {
      hoje.push(occurrence);
    }
  }

  const total = occurrences.length;
  const done = occurrences.filter((occurrence) => occurrence.status === "DONE").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    heroStats: { done, total, pct },
    sections: { atrasadas, hoje },
  };
}

export function BoardProvider({ children }: { children: ReactNode }) {
  const { active } = useActiveEnvironment();
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);

  // Race guard: `load` is invoked both by the effect below (on active.id
  // change) and imperatively by `refetch()`. Whichever call is most recent
  // "owns" `guardRef.current` — starting a new load cancels whatever request
  // was previously in flight, so a slow/superseded response can never
  // overwrite state a newer request already produced. Mirrors the
  // `cancelled`-flag convention in AuthProvider's bootstrap effect, adapted
  // to a shared ref since this loader has more than one call site.
  const guardRef = useRef<{ cancelled: boolean } | null>(null);

  const load = useCallback(async (envId: string) => {
    if (guardRef.current) {
      guardRef.current.cancelled = true;
    }
    const guard = { cancelled: false };
    guardRef.current = guard;

    setLoading(true);
    setError(null);
    try {
      const result = await boardApi.getBoard(envId, todayISO());
      if (!guard.cancelled) {
        setOccurrences(result);
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
    if (active) {
      void load(active.id);
    } else {
      if (guardRef.current) {
        guardRef.current.cancelled = true;
      }
      setOccurrences([]);
      setError(null);
      setLoading(false);
    }

    return () => {
      if (guardRef.current) {
        guardRef.current.cancelled = true;
      }
    };
  }, [active?.id, load]);

  const refetch = useCallback(() => {
    if (active) {
      void load(active.id);
    }
  }, [active, load]);

  const applyLocal = useCallback((updater: (prev: Occurrence[]) => Occurrence[]) => {
    setOccurrences((prev) => updater(prev));
  }, []);

  const { connected } = useBoardSocket({
    envId: active?.id,
    occurrences,
    applyLocal,
    refetch,
  });

  const derived = useMemo(() => deriveBoard(occurrences), [occurrences]);

  const value = useMemo<BoardValue>(
    () => ({
      occurrences,
      heroStats: derived.heroStats,
      sections: derived.sections,
      loading,
      error,
      refetch,
      applyLocal,
      connected,
    }),
    [occurrences, derived, loading, error, refetch, applyLocal, connected],
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}
