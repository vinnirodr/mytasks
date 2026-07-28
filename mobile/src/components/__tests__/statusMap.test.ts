import type { OccurrenceStatus } from "@/api/board";

import { taskStatusForOccurrence } from "../statusMap";

test("maps every OccurrenceStatus to its TaskStatus", () => {
  const expected: Record<OccurrenceStatus, string> = {
    PENDING: "pending",
    LATE: "late",
    DONE: "done",
    POSTPONED: "deferred",
    MISSED: "missed",
  };

  for (const [status, taskStatus] of Object.entries(expected)) {
    expect(taskStatusForOccurrence(status as OccurrenceStatus)).toBe(taskStatus);
  }
});
