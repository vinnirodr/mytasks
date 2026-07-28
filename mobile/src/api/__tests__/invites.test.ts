import { apiClient } from "../client";
import { invitesApi } from "../invites";

jest.mock("../client", () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

const mockRequest = apiClient.request as jest.Mock;

describe("invitesApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("preview", () => {
    test("gets the preview endpoint without auth and maps all fields including nested members", async () => {
      mockRequest.mockResolvedValueOnce({
        environment_name: "Family",
        env_type: "family",
        member_count: 2,
        members: [
          { display_name: "Alice", initials: "A" },
          { display_name: "Bob", initials: "B" },
        ],
        invited_by_name: "Alice",
        status: "pending",
        email: "bob@example.com",
      });

      const result = await invitesApi.preview("tok-123");

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith("/api/invitations/tok-123/preview/", {
        method: "GET",
        auth: false,
      });

      expect(result).toEqual({
        environmentName: "Family",
        envType: "family",
        memberCount: 2,
        members: [
          { displayName: "Alice", initials: "A" },
          { displayName: "Bob", initials: "B" },
        ],
        invitedByName: "Alice",
        status: "pending",
        email: "bob@example.com",
      });
    });
  });

  describe("accept", () => {
    test("posts to accept endpoint (authed) with token and maps environment_id/role", async () => {
      mockRequest.mockResolvedValueOnce({
        environment_id: "env-1",
        role: "member",
      });

      const result = await invitesApi.accept("tok-123");

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith("/api/invitations/accept/", {
        method: "POST",
        body: { token: "tok-123" },
      });

      expect(result).toEqual({
        environmentId: "env-1",
        role: "member",
      });
    });
  });
});
