import { apiClient } from "../client";
import { environmentsApi } from "../environments";

jest.mock("../client", () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

const mockRequest = apiClient.request as jest.Mock;

describe("environmentsApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("list", () => {
    test("gets the environments endpoint and maps snake_case fields for multiple items", async () => {
      mockRequest.mockResolvedValueOnce([
        {
          id: "env-1",
          name: "Home",
          env_type: "HOUSE",
          timezone: "America/Sao_Paulo",
          role: "ADMIN",
        },
        {
          id: "env-2",
          name: "Office",
          env_type: "OFFICE",
          timezone: "America/Sao_Paulo",
          role: null,
        },
      ]);

      const result = await environmentsApi.list();

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith("/api/environments/", {
        method: "GET",
      });

      expect(result).toEqual([
        {
          id: "env-1",
          name: "Home",
          envType: "HOUSE",
          timezone: "America/Sao_Paulo",
          role: "ADMIN",
        },
        {
          id: "env-2",
          name: "Office",
          envType: "OFFICE",
          timezone: "America/Sao_Paulo",
          role: null,
        },
      ]);
    });

    test("propagates the error when apiClient.request rejects", async () => {
      const error = new Error("network down");
      mockRequest.mockRejectedValueOnce(error);

      await expect(environmentsApi.list()).rejects.toThrow("network down");
    });
  });
});
