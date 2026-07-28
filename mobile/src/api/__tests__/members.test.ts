import { apiClient } from "../client";
import { membersApi } from "../members";

jest.mock("../client", () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

const mockRequest = apiClient.request as jest.Mock;

describe("membersApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("list", () => {
    test("gets the members endpoint with envId interpolated and maps snake_case fields for multiple items", async () => {
      mockRequest.mockResolvedValueOnce([
        {
          id: "mem-1",
          user_id: "user-1",
          display_name: "Alice",
          initials: "A",
          role: "ADMIN",
          is_me: true,
        },
        {
          id: "mem-2",
          user_id: "user-2",
          display_name: "Bob",
          initials: "B",
          role: "MEMBER",
          is_me: false,
        },
      ]);

      const result = await membersApi.list("env-123");

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith("/api/environments/env-123/members/", {
        method: "GET",
      });

      expect(result).toEqual([
        {
          id: "mem-1",
          userId: "user-1",
          displayName: "Alice",
          initials: "A",
          role: "ADMIN",
          isMe: true,
        },
        {
          id: "mem-2",
          userId: "user-2",
          displayName: "Bob",
          initials: "B",
          role: "MEMBER",
          isMe: false,
        },
      ]);
    });

    test("propagates the error when apiClient.request rejects", async () => {
      const error = new Error("network down");
      mockRequest.mockRejectedValueOnce(error);

      await expect(membersApi.list("env-123")).rejects.toThrow("network down");
    });
  });
});
