/**
 * Organizados — Daily board state context (Plan 6d, Task 4)
 *
 * Loads today's occurrences for the active environment (see
 * `ActiveEnvironmentProvider`) and shares them — plus derived hero stats and
 * atrasadas/hoje sections — with the board screen (T5), task detail (T6),
 * and the live-WS wiring (T7). `applyLocal` lets those consumers patch
 * `occurrences` in place (optimistic updates, WS patches) without a refetch.
 */

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { boardApi, todayISO, type Occurrence } from "@/api/board";

import { useActiveEnvironment } from "./useActiveEnvironment";

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

  const load = useCallback(async (envId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await boardApi.getBoard(envId, todayISO());
      setOccurrences(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) {
      void load(active.id);
    } else {
      setOccurrences([]);
      setError(null);
      setLoading(false);
    }
  }, [active?.id, load]);

  const refetch = useCallback(() => {
    if (active) {
      void load(active.id);
    }
  }, [active, load]);

  const applyLocal = useCallback((updater: (prev: Occurrence[]) => Occurrence[]) => {
    setOccurrences((prev) => updater(prev));
  }, []);

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
    }),
    [occurrences, derived, loading, error, refetch, applyLocal],
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}
