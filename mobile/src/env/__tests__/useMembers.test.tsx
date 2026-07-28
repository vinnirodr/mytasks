import { act, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { membersApi, type Member } from "@/api/members";

import { useMembers } from "../useMembers";

jest.mock("@/api/members");

const mockList = membersApi.list as jest.Mock;

const marina: Member = {
  id: "mem-1",
  userId: "user-1",
  displayName: "Marina",
  initials: "MA",
  role: "ADMIN",
  isMe: true,
};

let latest: ReturnType<typeof useMembers> | undefined;

function Probe({ envId }: { envId: string | null }) {
  latest = useMembers(envId);
  return <Text testID="probe">{latest.loading ? "loading" : "loaded"}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  latest = undefined;
});

test("loads members for the given envId and exposes them keyed by userId", async () => {
  mockList.mockResolvedValue([marina]);

  render(<Probe envId="env-a" />);

  await waitFor(() => expect(latest?.loading).toBe(false));

  expect(mockList).toHaveBeenCalledWith("env-a");
  expect(latest?.members).toEqual([marina]);
  expect(latest?.byId.get("user-1")).toEqual(marina);
});

test("a null envId clears members without calling the API", async () => {
  mockList.mockResolvedValue([marina]);

  render(<Probe envId={null} />);

  expect(mockList).not.toHaveBeenCalled();
  expect(latest?.members).toEqual([]);
  expect(latest?.byId.size).toBe(0);
});

test("an API error is exposed without throwing", async () => {
  mockList.mockRejectedValue(new Error("boom"));

  render(<Probe envId="env-a" />);

  await waitFor(() => expect(latest?.loading).toBe(false));

  expect(latest?.error).toBeInstanceOf(Error);
  expect(latest?.members).toEqual([]);
});

test("switching envId reloads members", async () => {
  mockList.mockResolvedValueOnce([marina]).mockResolvedValueOnce([]);

  const { rerender } = render(<Probe envId="env-a" />);
  await waitFor(() => expect(latest?.members).toEqual([marina]));

  await act(async () => {
    rerender(<Probe envId="env-b" />);
  });

  await waitFor(() => expect(mockList).toHaveBeenCalledWith("env-b"));
  await waitFor(() => expect(latest?.members).toEqual([]));
});
