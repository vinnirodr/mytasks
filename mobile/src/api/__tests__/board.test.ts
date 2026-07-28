import { apiClient } from "../client";
import { boardApi, todayISO, weekStartISO } from "../board";

jest.mock("../client", () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

const mockRequest = apiClient.request as jest.Mock;

const occurrenceResponse1 = {
  id: "occ-1",
  title: "Lavar louça",
  date: "2026-07-28",
  time: "08:00:00",
  assignee: "user-1",
  status: "PENDING",
  is_one_off: false,
  is_cancelled: false,
  recurring_task: "rt-1",
  task_definition: "td-1",
  completed_by: null,
  completed_at: null,
};

const occurrenceMapped1 = {
  id: "occ-1",
  title: "Lavar louça",
  date: "2026-07-28",
  time: "08:00:00",
  assignee: "user-1",
  status: "PENDING",
  isOneOff: false,
  isCancelled: false,
  recurringTask: "rt-1",
  taskDefinition: "td-1",
  completedBy: null,
  completedAt: null,
};

const occurrenceResponse2 = {
  id: "occ-2",
  title: "Tirar o lixo",
  date: "2026-07-28",
  time: null,
  assignee: null,
  status: "POSTPONED",
  is_one_off: true,
  is_cancelled: false,
  recurring_task: null,
  task_definition: null,
  completed_by: null,
  completed_at: null,
};

const occurrenceMapped2 = {
  id: "occ-2",
  title: "Tirar o lixo",
  date: "2026-07-28",
  time: null,
  assignee: null,
  status: "POSTPONED",
  isOneOff: true,
  isCancelled: false,
  recurringTask: null,
  taskDefinition: null,
  completedBy: null,
  completedAt: null,
};

const occurrenceResponse3Done = {
  id: "occ-3",
  title: "Passar pano",
  date: "2026-07-28",
  time: "07:00:00",
  assignee: "user-2",
  status: "DONE",
  is_one_off: false,
  is_cancelled: false,
  recurring_task: "rt-3",
  task_definition: "td-3",
  completed_by: "user-2",
  completed_at: "2026-07-28T10:00:00Z",
};

const occurrenceMapped3Done = {
  id: "occ-3",
  title: "Passar pano",
  date: "2026-07-28",
  time: "07:00:00",
  assignee: "user-2",
  status: "DONE",
  isOneOff: false,
  isCancelled: false,
  recurringTask: "rt-3",
  taskDefinition: "td-3",
  completedBy: "user-2",
  completedAt: "2026-07-28T10:00:00Z",
};

describe("boardApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getBoard", () => {
    test("gets the occurrences endpoint with envId + date query, maps snake_case fields, and preserves order", async () => {
      // occ-3 (DONE, earliest time) intentionally listed before occ-1 (PENDING) before
      // occ-2 (POSTPONED) — mirrors the backend's own ordering (postponed last). The
      // client must NOT re-sort; it must return items in the exact order received.
      mockRequest.mockResolvedValueOnce([occurrenceResponse3Done, occurrenceResponse1, occurrenceResponse2]);

      const result = await boardApi.getBoard("env-123", "2026-07-28");

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith("/api/environments/env-123/occurrences/?date=2026-07-28", {
        method: "GET",
      });

      expect(result).toEqual([occurrenceMapped3Done, occurrenceMapped1, occurrenceMapped2]);
    });

    test("propagates the error when apiClient.request rejects", async () => {
      const error = new Error("network down");
      mockRequest.mockRejectedValueOnce(error);

      await expect(boardApi.getBoard("env-123", "2026-07-28")).rejects.toThrow("network down");
    });
  });

  describe("completeOccurrence", () => {
    test("posts to the complete endpoint and maps the returned occurrence", async () => {
      mockRequest.mockResolvedValueOnce(occurrenceResponse3Done);

      const result = await boardApi.completeOccurrence("occ-3");

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith("/api/occurrences/occ-3/complete/", {
        method: "POST",
      });
      expect(result).toEqual(occurrenceMapped3Done);
    });

    test("propagates the error when apiClient.request rejects", async () => {
      const error = new Error("boom");
      mockRequest.mockRejectedValueOnce(error);

      await expect(boardApi.completeOccurrence("occ-3")).rejects.toThrow("boom");
    });
  });

  describe("pickupOccurrence", () => {
    test("posts to the pickup endpoint and maps the returned occurrence", async () => {
      mockRequest.mockResolvedValueOnce(occurrenceResponse1);

      const result = await boardApi.pickupOccurrence("occ-1");

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith("/api/occurrences/occ-1/pickup/", {
        method: "POST",
      });
      expect(result).toEqual(occurrenceMapped1);
    });

    test("propagates the error when apiClient.request rejects", async () => {
      const error = new Error("boom");
      mockRequest.mockRejectedValueOnce(error);

      await expect(boardApi.pickupOccurrence("occ-1")).rejects.toThrow("boom");
    });
  });

  describe("postponeOccurrence", () => {
    test("posts to the postpone endpoint and maps the returned occurrence", async () => {
      mockRequest.mockResolvedValueOnce(occurrenceResponse2);

      const result = await boardApi.postponeOccurrence("occ-2");

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith("/api/occurrences/occ-2/postpone/", {
        method: "POST",
      });
      expect(result).toEqual(occurrenceMapped2);
    });

    test("propagates the ApiError when postponing an occurrence in an invalid state (e.g. already DONE)", async () => {
      const error = Object.assign(new Error("API request failed with status 400"), {
        name: "ApiError",
        status: 400,
        data: { detail: "Cannot postpone a completed occurrence." },
      });
      mockRequest.mockRejectedValueOnce(error);

      await expect(boardApi.postponeOccurrence("occ-3")).rejects.toThrow("API request failed with status 400");
    });
  });

  describe("reassignOccurrence", () => {
    test("patches the occurrence endpoint with the new assignee and maps the returned occurrence", async () => {
      const reassigned = { ...occurrenceResponse1, assignee: "user-9" };
      mockRequest.mockResolvedValueOnce(reassigned);

      const result = await boardApi.reassignOccurrence("occ-1", "user-9");

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith("/api/occurrences/occ-1/", {
        method: "PATCH",
        body: { assignee: "user-9" },
      });
      expect(result).toEqual({ ...occurrenceMapped1, assignee: "user-9" });
    });

    test("propagates the error when apiClient.request rejects (e.g. assignee not a member)", async () => {
      const error = Object.assign(new Error("API request failed with status 400"), {
        name: "ApiError",
        status: 400,
        data: { detail: "assignee must be a member of the environment" },
      });
      mockRequest.mockRejectedValueOnce(error);

      await expect(boardApi.reassignOccurrence("occ-1", "user-999")).rejects.toThrow(
        "API request failed with status 400",
      );
    });
  });

  describe("getWeek", () => {
    test("gets the occurrences endpoint with envId + week_of query, maps snake_case fields, and preserves order", async () => {
      mockRequest.mockResolvedValueOnce([occurrenceResponse3Done, occurrenceResponse1, occurrenceResponse2]);

      const result = await boardApi.getWeek("env-123", "2026-07-27");

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith("/api/environments/env-123/occurrences/?week_of=2026-07-27", {
        method: "GET",
      });

      expect(result).toEqual([occurrenceMapped3Done, occurrenceMapped1, occurrenceMapped2]);
    });

    test("propagates the error when apiClient.request rejects", async () => {
      const error = new Error("network down");
      mockRequest.mockRejectedValueOnce(error);

      await expect(boardApi.getWeek("env-123", "2026-07-27")).rejects.toThrow("network down");
    });
  });
});

describe("todayISO", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test("returns a zero-padded YYYY-MM-DD string", () => {
    const result = todayISO();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("uses the local date, not the UTC date (late-night local time must not roll to the UTC next day)", () => {
    // 23:30 local time. If todayISO() used toISOString() (UTC-based), a positive UTC
    // offset (e.g. UTC+something ahead, or simply the UTC conversion of a late-night
    // local timestamp) could push the date to the next day. Faking the system time
    // to a fixed local instant and reading local getters should agree with todayISO().
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 28, 23, 30, 0)); // months are 0-indexed: 6 = July

    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;

    expect(todayISO()).toBe(expected);
    expect(todayISO()).toBe("2026-07-28");
  });

  test("zero-pads single-digit months and days", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 5, 12, 0, 0)); // Jan 5

    expect(todayISO()).toBe("2026-01-05");
  });
});

describe("weekStartISO", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test("returns a zero-padded YYYY-MM-DD string", () => {
    expect(weekStartISO(new Date(2026, 6, 28))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("returns the same date when given a Monday", () => {
    expect(weekStartISO(new Date(2026, 6, 27))).toBe("2026-07-27"); // Mon Jul 27 2026
  });

  test("returns the Monday of the same week for a mid-week date", () => {
    expect(weekStartISO(new Date(2026, 6, 28))).toBe("2026-07-27"); // Tue -> Mon
    expect(weekStartISO(new Date(2026, 6, 31))).toBe("2026-07-27"); // Fri -> Mon
  });

  test("rolls a Sunday back to the previous Monday, including a month rollover", () => {
    expect(weekStartISO(new Date(2026, 7, 2))).toBe("2026-07-27"); // Sun Aug 2 -> Mon Jul 27
  });

  test("rolls a Sunday back to the previous Monday across a year boundary", () => {
    expect(weekStartISO(new Date(2026, 0, 4))).toBe("2025-12-29"); // Sun Jan 4 2026 -> Mon Dec 29 2025
  });

  test("handles a month rollover for a non-Sunday date (Sunday Mar 1 2026 -> Mon Feb 23 2026)", () => {
    expect(weekStartISO(new Date(2026, 2, 1))).toBe("2026-02-23");
  });

  test("defaults to the current date when called with no argument", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 28, 12, 0, 0)); // Tue Jul 28 2026

    expect(weekStartISO()).toBe("2026-07-27");
  });

  test("uses the local date, not the UTC date, for a late-night local timestamp", () => {
    // 23:30 local time on a Tuesday. If this used any UTC-based conversion, the
    // computed weekday (and therefore the Monday) could shift to the wrong day.
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 28, 23, 30, 0));

    expect(weekStartISO()).toBe("2026-07-27");
  });
});
