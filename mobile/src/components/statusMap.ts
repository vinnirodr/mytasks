/**
 * Organizados — Occurrence status → StatusChip status mapping (Plan 6d, Task 6)
 *
 * `StatusChip` only knows the display-oriented `TaskStatus` union
 * (`pending`/`late`/`done`/`deferred`/`missed`); the API surfaces the
 * backend's `OccurrenceStatus` instead (`PENDING`/`LATE`/`DONE`/`POSTPONED`/
 * `MISSED`). `TaskCard` (T5) never needed this mapping — it drives its
 * checkbox visuals off `OccurrenceStatus` directly via its own
 * `checkboxStateForStatus` (→ `TaskCheckboxState`, a different, 3-value
 * union) and never renders a `StatusChip`. `TaskDetail` (T6) is the first
 * call site that needs an `OccurrenceStatus` → `TaskStatus` mapping, so it's
 * extracted here up front (rather than inlined in `TaskDetail.tsx`) as the
 * single shared source for this specific mapping, ready for any future
 * screen that also renders a `StatusChip` from an `Occurrence`.
 */

import type { OccurrenceStatus } from "@/api/board";

import type { TaskStatus } from "./StatusChip";

export function taskStatusForOccurrence(status: OccurrenceStatus): TaskStatus {
  switch (status) {
    case "PENDING":
      return "pending";
    case "LATE":
      return "late";
    case "DONE":
      return "done";
    case "POSTPONED":
      return "deferred";
    case "MISSED":
    default:
      return "missed";
  }
}
