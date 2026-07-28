/**
 * Organizados — Optimistic complete-with-undo (Plan 6d, Task 5)
 *
 * Backs the daily board's checkbox tap (docs/design/handoff/README.md,
 * "Quadro do dia" + the 6d-task-5 brief, "Concluir — otimista + desfazer
 * 5s"):
 *
 *  1. Optimistic: `applyLocal` marks the occurrence DONE and moves it to the
 *     end of the list (so "Hoje" shows it last — `deriveBoard` preserves
 *     array order, it doesn't re-sort).
 *  2. A 5s undo window: `pending` drives an inline "Concluída · Desfazer"
 *     banner. The real `completeOccurrence(id)` call is *delayed* by that
 *     same 5s — calling `undo()` before it fires cancels the timer and
 *     reverts the optimistic change instead of ever hitting the API.
 *  3. If the delayed call fails (network error, etc.), the optimistic change
 *     is reverted the same way `undo()` would, and `onError` fires so the
 *     screen can show a short notice.
 *
 * `moveToEndAsDone`/`restoreOccurrence` are pure and exported so the
 * reordering/revert math is unit-testable without React or timers; the hook
 * itself is exercised with jest fake timers (the brief's suggested testing
 * strategy — no injected scheduler needed).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { Occurrence } from "@/api/board";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export type UndoSnapshot = {
  id: string;
  /** Index the occurrence held before the optimistic move — used to restore its position. */
  index: number;
  occurrence: Occurrence;
};

/** Marks `occurrences[index]` DONE and relocates it to the end of the array. */
export function moveToEndAsDone(occurrences: Occurrence[], index: number): Occurrence[] {
  if (index < 0 || index >= occurrences.length) return occurrences;

  const target = occurrences[index]!;
  const updated: Occurrence = {
    ...target,
    status: "DONE",
    completedAt: target.completedAt ?? new Date().toISOString(),
  };
  const rest = [...occurrences.slice(0, index), ...occurrences.slice(index + 1)];

  return [...rest, updated];
}

/** Removes the (now-DONE) occurrence and reinserts the original at its snapshot index. */
export function restoreOccurrence(occurrences: Occurrence[], snapshot: UndoSnapshot): Occurrence[] {
  const currentIndex = occurrences.findIndex((item) => item.id === snapshot.id);
  const withoutIt =
    currentIndex === -1
      ? occurrences
      : [...occurrences.slice(0, currentIndex), ...occurrences.slice(currentIndex + 1)];

  const insertAt = Math.min(snapshot.index, withoutIt.length);
  return [...withoutIt.slice(0, insertAt), snapshot.occurrence, ...withoutIt.slice(insertAt)];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type PendingUndo = {
  occurrenceId: string;
  title: string;
};

export type UseUndoableCompleteParams = {
  /** The board's current occurrences — read synchronously to snapshot the pre-move index/item. */
  occurrences: Occurrence[];
  applyLocal: (updater: (prev: Occurrence[]) => Occurrence[]) => void;
  completeOccurrence: (id: string) => Promise<Occurrence>;
  /** Undo window, in ms. Defaults to 5000 per the brief. */
  delayMs?: number;
  onError?: () => void;
};

export type UseUndoableCompleteResult = {
  pending: PendingUndo | null;
  complete: (occurrence: Occurrence) => void;
  undo: () => void;
};

const DEFAULT_DELAY_MS = 5000;

export function useUndoableComplete({
  occurrences,
  applyLocal,
  completeOccurrence,
  delayMs = DEFAULT_DELAY_MS,
  onError,
}: UseUndoableCompleteParams): UseUndoableCompleteResult {
  const [pending, setPending] = useState<PendingUndo | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotRef = useRef<UndoSnapshot | null>(null);

  const send = useCallback(
    (snapshot: UndoSnapshot) => {
      completeOccurrence(snapshot.id).catch(() => {
        applyLocal((prev) => restoreOccurrence(prev, snapshot));
        onError?.();
      });
    },
    [applyLocal, completeOccurrence, onError],
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Only one undo snackbar at a time: if a new complete() arrives while one
  // is already pending, settle the previous one right away (send its
  // delayed API call now) rather than silently dropping it.
  const flushPending = useCallback(() => {
    clearTimer();
    const snapshot = snapshotRef.current;
    snapshotRef.current = null;
    if (snapshot) {
      send(snapshot);
    }
  }, [clearTimer, send]);

  const complete = useCallback(
    (occurrence: Occurrence) => {
      // The backend has no "un-complete" action — only non-DONE occurrences
      // can be completed (mirrors the TaskCard checkbox being inert on DONE).
      if (occurrence.status === "DONE") return;

      flushPending();

      const index = occurrences.findIndex((item) => item.id === occurrence.id);
      if (index === -1) return;

      const snapshot: UndoSnapshot = { id: occurrence.id, index, occurrence: occurrences[index]! };
      snapshotRef.current = snapshot;
      setPending({ occurrenceId: occurrence.id, title: occurrence.title });

      applyLocal((prev) => {
        const currentIndex = prev.findIndex((item) => item.id === occurrence.id);
        return moveToEndAsDone(prev, currentIndex);
      });

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const finalSnapshot = snapshotRef.current;
        snapshotRef.current = null;
        setPending(null);
        if (finalSnapshot) {
          send(finalSnapshot);
        }
      }, delayMs);
    },
    [applyLocal, delayMs, flushPending, occurrences, send],
  );

  const undo = useCallback(() => {
    clearTimer();
    const snapshot = snapshotRef.current;
    snapshotRef.current = null;
    setPending(null);
    if (snapshot) {
      applyLocal((prev) => restoreOccurrence(prev, snapshot));
    }
  }, [applyLocal, clearTimer]);

  // If the screen unmounts mid-undo-window (e.g. the user switches tabs
  // right after tapping the checkbox), the undo option is moot — flush the
  // pending completion immediately instead of silently dropping it (a bare
  // `clearTimeout` would leave the occurrence optimistically DONE locally
  // but never persisted server-side). The ref indirection keeps this a
  // true "on unmount only" effect — `flushPending`'s identity can change
  // across renders (e.g. an inline `completeOccurrence`), and re-running a
  // cleanup on every such change would flush a *still-pending* undo early.
  const flushPendingRef = useRef(flushPending);
  flushPendingRef.current = flushPending;

  useEffect(() => {
    return () => flushPendingRef.current();
  }, []);

  return { pending, complete, undo };
}
