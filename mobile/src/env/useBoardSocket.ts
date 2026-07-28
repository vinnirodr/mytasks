/**
 * Organizados — Live board WebSocket subscription (Plan 6d, Task 7)
 *
 * Wraps `createEnvironmentSocket` (6b, `@/api/socket`) for the daily board:
 * while `envId` is set, keeps one connection open to that environment's
 * real-time channel and reacts to incoming messages, closing it on unmount
 * or when `envId` changes (`BoardProvider` — T4 — calls this once, passing
 * `active?.id`).
 *
 * Message handling (see the task-7 brief for the exact backend shapes):
 *  - `board_update` `{ kind, occurrence_id, status }` for an occurrence
 *    already in the current list → a *surgical* `applyLocal` patch of just
 *    that occurrence's `status`. Deliberately never a blanket `refetch()`
 *    here — that would clobber any optimistic update in flight elsewhere on
 *    the board, including T5's 5s undo window.
 *  - `board_update` for an `occurrence_id` NOT in the current list (e.g.
 *    someone else created a one-off task today) → the item is genuinely new
 *    and there's nothing to patch, so `refetch()` — debounced ~300ms so a
 *    burst of messages coalesces into a single re-fetch.
 *  - `activity` and any other/malformed payload → ignored here entirely
 *    (the activity feed itself is 6f's concern; this hook only touches
 *    board state).
 *
 * `occurrences`/`applyLocal`/`refetch` are read through refs updated on
 * every render, so the effect that opens/closes the socket depends only on
 * `envId` — reopening the connection whenever those identities change would
 * drop in-flight messages and defeat the point of a stable subscription.
 */

import { useEffect, useRef, useState } from "react";

import { createEnvironmentSocket } from "@/api/socket";
import { tokenStore } from "@/api/tokenStore";
import type { Occurrence, OccurrenceStatus } from "@/api/board";

const REFETCH_DEBOUNCE_MS = 300;

type BoardUpdateMessage = {
  kind: "board_update";
  occurrence_id: string;
  status: OccurrenceStatus;
};

function isBoardUpdate(data: unknown): data is BoardUpdateMessage {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as Record<string, unknown>;
  return (
    candidate.kind === "board_update" &&
    typeof candidate.occurrence_id === "string" &&
    typeof candidate.status === "string"
  );
}

export type UseBoardSocketParams = {
  envId: string | undefined;
  occurrences: Occurrence[];
  applyLocal: (updater: (prev: Occurrence[]) => Occurrence[]) => void;
  refetch: () => void;
};

export type UseBoardSocketResult = {
  connected: boolean;
};

export function useBoardSocket({
  envId,
  occurrences,
  applyLocal,
  refetch,
}: UseBoardSocketParams): UseBoardSocketResult {
  const [connected, setConnected] = useState(false);

  const occurrencesRef = useRef(occurrences);
  occurrencesRef.current = occurrences;
  const applyLocalRef = useRef(applyLocal);
  applyLocalRef.current = applyLocal;
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!envId) {
      setConnected(false);
      return;
    }

    let refetchTimer: ReturnType<typeof setTimeout> | null = null;

    const socket = createEnvironmentSocket(envId, tokenStore.getAccess, {
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onMessage: (data: unknown) => {
        if (!isBoardUpdate(data)) {
          // Covers `activity` messages, unknown `kind`s, and malformed
          // payloads alike — none of them touch board state here.
          return;
        }

        const { occurrence_id: occurrenceId, status } = data;
        const isKnown = occurrencesRef.current.some((occurrence) => occurrence.id === occurrenceId);

        if (isKnown) {
          applyLocalRef.current((prev) =>
            prev.map((occurrence) =>
              occurrence.id === occurrenceId ? { ...occurrence, status } : occurrence,
            ),
          );
          return;
        }

        if (refetchTimer) {
          clearTimeout(refetchTimer);
        }
        refetchTimer = setTimeout(() => {
          refetchTimer = null;
          refetchRef.current();
        }, REFETCH_DEBOUNCE_MS);
      },
    });

    return () => {
      if (refetchTimer) {
        clearTimeout(refetchTimer);
      }
      socket.close();
      setConnected(false);
    };
  }, [envId]);

  return { connected };
}
