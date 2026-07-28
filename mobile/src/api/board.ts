import { apiClient } from "./client";

export type OccurrenceStatus = "PENDING" | "LATE" | "DONE" | "POSTPONED" | "MISSED";

export type Occurrence = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM:SS
  assignee: string | null; // user id
  status: OccurrenceStatus;
  isOneOff: boolean;
  isCancelled: boolean;
  recurringTask: string | null;
  taskDefinition: string | null;
  completedBy: string | null;
  completedAt: string | null;
};

type OccurrenceResponse = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  assignee: string | null;
  status: OccurrenceStatus;
  is_one_off: boolean;
  is_cancelled: boolean;
  recurring_task: string | null;
  task_definition: string | null;
  completed_by: string | null;
  completed_at: string | null;
};

function mapOccurrence(response: OccurrenceResponse): Occurrence {
  return {
    id: response.id,
    title: response.title,
    date: response.date,
    time: response.time,
    assignee: response.assignee,
    status: response.status,
    isOneOff: response.is_one_off,
    isCancelled: response.is_cancelled,
    recurringTask: response.recurring_task,
    taskDefinition: response.task_definition,
    completedBy: response.completed_by,
    completedAt: response.completed_at,
  };
}

async function getBoard(envId: string, date: string): Promise<Occurrence[]> {
  const response = await apiClient.request<OccurrenceResponse[]>(
    `/api/environments/${envId}/occurrences/?date=${date}`,
    { method: "GET" },
  );

  // Preserve the server's order (POSTPONED last, then by time) — do not re-sort.
  return response.map(mapOccurrence);
}

async function getWeek(envId: string, weekOf: string): Promise<Occurrence[]> {
  const response = await apiClient.request<OccurrenceResponse[]>(
    `/api/environments/${envId}/occurrences/?week_of=${weekOf}`,
    { method: "GET" },
  );

  // Preserve the server's order (date, time) — do not re-sort.
  return response.map(mapOccurrence);
}

async function completeOccurrence(id: string): Promise<Occurrence> {
  const response = await apiClient.request<OccurrenceResponse>(`/api/occurrences/${id}/complete/`, {
    method: "POST",
  });

  return mapOccurrence(response);
}

async function pickupOccurrence(id: string): Promise<Occurrence> {
  const response = await apiClient.request<OccurrenceResponse>(`/api/occurrences/${id}/pickup/`, {
    method: "POST",
  });

  return mapOccurrence(response);
}

async function postponeOccurrence(id: string): Promise<Occurrence> {
  const response = await apiClient.request<OccurrenceResponse>(`/api/occurrences/${id}/postpone/`, {
    method: "POST",
  });

  return mapOccurrence(response);
}

async function reassignOccurrence(id: string, assigneeUserId: string): Promise<Occurrence> {
  const response = await apiClient.request<OccurrenceResponse>(`/api/occurrences/${id}/`, {
    method: "PATCH",
    body: { assignee: assigneeUserId },
  });

  return mapOccurrence(response);
}

// Local YYYY-MM-DD (zero-padded), deliberately NOT toISOString() (which is UTC and
// can shift the calendar day); the backend resolves LATE/MISSED using the
// environment's own timezone — the client only ever sends the device's local date.
export function todayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Local Monday (zero-padded YYYY-MM-DD) of the week containing `date` (or today).
// Deliberately local, not toISOString() (UTC) — see todayISO() above. getDay() is
// 0=Sun..6=Sat; remapped to Mon=0..Sun=6 so Monday itself needs no adjustment and
// Sunday rolls back 6 days. Subtracting via the Date constructor's day component
// lets JS itself carry the month/year rollover instead of hand-rolled arithmetic.
export function weekStartISO(date: Date = new Date()): string {
  const mondayOffset = (date.getDay() + 6) % 7;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset);

  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const day = String(monday.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export const boardApi = {
  getBoard,
  getWeek,
  completeOccurrence,
  pickupOccurrence,
  postponeOccurrence,
  reassignOccurrence,
};
