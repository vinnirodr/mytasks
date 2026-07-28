/**
 * Organizados — Environment members hook (Plan 6d, Task 5)
 *
 * Loads the active environment's member list (`membersApi.list`) so the
 * daily board can resolve `occurrence.assignee` (a user id) to a `Member`
 * for the `TaskCard` avatar, and so the hero's presence row can render an
 * `AvatarStack`. Deliberately a plain hook (not a context like
 * `ActiveEnvironmentProvider`/`BoardProvider`) — it's only consumed by the
 * board screen right now, and a simple `envId in, {members, byId} out` hook
 * is enough; promoting it to a shared provider can happen later if a
 * second screen needs the same data without refetching.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { membersApi, type Member } from "@/api/members";

export type UseMembersResult = {
  members: Member[];
  /** Keyed by `Member.userId` — the same id `Occurrence.assignee` carries. */
  byId: Map<string, Member>;
  loading: boolean;
  error: unknown | null;
};

export function useMembers(envId: string | null | undefined): UseMembersResult {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);

  // Race guard: mirrors the `cancelled`-flag convention in
  // ActiveEnvironmentProvider/BoardProvider — a superseded request (e.g. the
  // active environment changes again before this one resolves) can never
  // overwrite state a newer request already produced.
  const guardRef = useRef<{ cancelled: boolean } | null>(null);

  useEffect(() => {
    if (guardRef.current) {
      guardRef.current.cancelled = true;
    }

    if (!envId) {
      setMembers([]);
      setError(null);
      setLoading(false);
      return;
    }

    const guard = { cancelled: false };
    guardRef.current = guard;

    setLoading(true);
    setError(null);

    membersApi
      .list(envId)
      .then((result) => {
        if (!guard.cancelled) {
          setMembers(result);
        }
      })
      .catch((err: unknown) => {
        if (!guard.cancelled) {
          setError(err);
        }
      })
      .finally(() => {
        if (!guard.cancelled) {
          setLoading(false);
        }
      });

    return () => {
      guard.cancelled = true;
    };
  }, [envId]);

  const byId = useMemo(() => {
    const map = new Map<string, Member>();
    for (const member of members) {
      map.set(member.userId, member);
    }
    return map;
  }, [members]);

  return { members, byId, loading, error };
}
