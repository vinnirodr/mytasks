import { apiClient } from "../client";
import { tasksApi } from "../tasks";

jest.mock("../client", () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

const mockRequest = apiClient.request as jest.Mock;

describe("tasksApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createDefinition", () => {
    test("posts name + icon and maps the returned task definition", async () => {
      mockRequest.mockResolvedValueOnce({ id: "td-1", name: "Lavar louça", icon: "dishes" });

      const result = await tasksApi.createDefinition("env-123", { name: "Lavar louça", icon: "dishes" });

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith("/api/environments/env-123/task-definitions/", {
        method: "POST",
        body: { name: "Lavar louça", icon: "dishes" },
      });

      expect(result).toEqual({ id: "td-1", name: "Lavar louça", icon: "dishes" });
    });

    test("defaults icon to an empty string when omitted", async () => {
      mockRequest.mockResolvedValueOnce({ id: "td-2", name: "Tirar o lixo", icon: "" });

      const result = await tasksApi.createDefinition("env-123", { name: "Tirar o lixo" });

      expect(mockRequest).toHaveBeenCalledWith("/api/environments/env-123/task-definitions/", {
        method: "POST",
        body: { name: "Tirar o lixo", icon: "" },
      });

      expect(result).toEqual({ id: "td-2", name: "Tirar o lixo", icon: "" });
    });

    test("propagates the error when apiClient.request rejects", async () => {
      const error = Object.assign(new Error("API request failed with status 403"), {
        name: "ApiError",
        status: 403,
        data: { detail: "Only admins can create task definitions." },
      });
      mockRequest.mockRejectedValueOnce(error);

      await expect(
        tasksApi.createDefinition("env-123", { name: "Lavar louça", icon: "dishes" }),
      ).rejects.toThrow("API request failed with status 403");
    });
  });

  describe("createRecurring", () => {
    test("posts task_definition/weekday/time/assignee/active:true and maps the returned recurring task", async () => {
      mockRequest.mockResolvedValueOnce({
        id: "rt-1",
        task_definition: "td-1",
        weekday: 0,
        time: "08:00",
        assignee: "user-1",
        active: true,
      });

      const result = await tasksApi.createRecurring("env-123", {
        taskDefinition: "td-1",
        weekday: 0,
        time: "08:00",
        assignee: "user-1",
      });

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith("/api/environments/env-123/recurring-tasks/", {
        method: "POST",
        body: { task_definition: "td-1", weekday: 0, time: "08:00", assignee: "user-1", active: true },
      });

      expect(result).toEqual({
        id: "rt-1",
        taskDefinition: "td-1",
        weekday: 0,
        time: "08:00",
        assignee: "user-1",
        active: true,
      });
    });

    test("propagates the error when apiClient.request rejects (e.g. assignee not a member)", async () => {
      const error = Object.assign(new Error("API request failed with status 400"), {
        name: "ApiError",
        status: 400,
        data: { detail: "assignee must be a member of the environment" },
      });
      mockRequest.mockRejectedValueOnce(error);

      await expect(
        tasksApi.createRecurring("env-123", {
          taskDefinition: "td-1",
          weekday: 6,
          time: "20:00",
          assignee: "user-999",
        }),
      ).rejects.toThrow("API request failed with status 400");
    });
  });
});
