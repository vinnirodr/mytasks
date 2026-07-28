/**
 * Organizados — Agenda week hook (Plan 6e, Task 2)
 *
 * Loads one week of occurrences (`boardApi.getWeek`) for the Agenda screen,
 * mirroring `useMembers`'s `envId in, {data, loading, error} out` shape and
 * cancellation-guard convention: a superseded request (env or week changed
 * again before the previous one resolved) can never overwrite state a newer
 * request already produced. Refetches automatically whenever `envId` or
 * `weekStart` changes — including when the Agenda screen's selected day
 * moves into a week that hasn't been loaded yet, since that always changes
 * `weekStart` too.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { boardApi, type Occurrence } from "@/api/board";

export type UseAgendaWeekResult = {
  occurrences: Occurrence[];
  loading: boolean;
  error: boolean;
  refetch: () => void;
};

export function useAgendaWeek(
  envId: string | null | undefined,
  weekStart: string,
): UseAgendaWeekResult {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const guardRef = useRef<{ cancelled: boolean } | null>(null);

  const fetchWeek = useCallback(() => {
    if (guardRef.current) {
      guardRef.current.cancelled = true;
    }

    if (!envId) {
      setOccurrences([]);
      setError(false);
      setLoading(false);
      return;
    }

    const guard = { cancelled: false };
    guardRef.current = guard;

    setLoading(true);
    setError(false);

    boardApi
      .getWeek(envId, weekStart)
      .then((result) => {
        if (!guard.cancelled) {
          setOccurrences(result);
        }
      })
      .catch(() => {
        if (!guard.cancelled) {
          setError(true);
        }
      })
      .finally(() => {
        if (!guard.cancelled) {
          setLoading(false);
        }
      });
  }, [envId, weekStart]);

  useEffect(() => {
    fetchWeek();

    return () => {
      if (guardRef.current) {
        guardRef.current.cancelled = true;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchWeek]);

  return { occurrences, loading, error, refetch: fetchWeek };
}
