import { apiClient } from "../client";
import { authApi } from "../auth";

jest.mock("../client", () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

const mockRequest = apiClient.request as jest.Mock;

describe("authApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("register", () => {
    test("posts to register endpoint without auth and maps display_name both ways", async () => {
      mockRequest.mockResolvedValueOnce({
        id: "user-1",
        email: "alice@example.com",
        display_name: "Alice",
      });

      const result = await authApi.register({
        email: "alice@example.com",
        password: "hunter2",
        displayName: "Alice",
      });

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith("/api/auth/register/", {
        method: "POST",
        body: {
          email: "alice@example.com",
          password: "hunter2",
          display_name: "Alice",
        },
        auth: false,
      });

      expect(result).toEqual({
        id: "user-1",
        email: "alice@example.com",
        displayName: "Alice",
      });
    });
  });

  describe("login", () => {
    test("posts to token endpoint without auth and returns access/refresh", async () => {
      mockRequest.mockResolvedValueOnce({
        access: "access-token",
        refresh: "refresh-token",
      });

      const result = await authApi.login({
        email: "alice@example.com",
        password: "hunter2",
      });

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith("/api/auth/token/", {
        method: "POST",
        body: {
          email: "alice@example.com",
          password: "hunter2",
        },
        auth: false,
      });

      expect(result).toEqual({
        access: "access-token",
        refresh: "refresh-token",
      });
    });
  });

  describe("me", () => {
    test("gets the authed profile endpoint and maps display_name", async () => {
      mockRequest.mockResolvedValueOnce({
        id: "user-1",
        email: "alice@example.com",
        display_name: "Alice",
      });

      const result = await authApi.me();

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith("/api/auth/me/", {
        method: "GET",
      });

      expect(result).toEqual({
        id: "user-1",
        email: "alice@example.com",
        displayName: "Alice",
      });
    });
  });
});
