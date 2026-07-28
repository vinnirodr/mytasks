import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";

import { tokenStore } from "../tokenStore";

jest.mock("expo-secure-store");

const mockSetItemAsync = setItemAsync as jest.Mock;
const mockGetItemAsync = getItemAsync as jest.Mock;
const mockDeleteItemAsync = deleteItemAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

test("setTokens writes both access and refresh keys", async () => {
  mockSetItemAsync.mockResolvedValue(undefined);

  await tokenStore.setTokens({ access: "access-token", refresh: "refresh-token" });

  expect(mockSetItemAsync).toHaveBeenCalledWith("org.access", "access-token");
  expect(mockSetItemAsync).toHaveBeenCalledWith("org.refresh", "refresh-token");
  expect(mockSetItemAsync).toHaveBeenCalledTimes(2);
});

test("getAccess returns the stored access token", async () => {
  mockGetItemAsync.mockResolvedValue("stored-access");

  const result = await tokenStore.getAccess();

  expect(mockGetItemAsync).toHaveBeenCalledWith("org.access");
  expect(result).toBe("stored-access");
});

test("getRefresh returns the stored refresh token", async () => {
  mockGetItemAsync.mockResolvedValue("stored-refresh");

  const result = await tokenStore.getRefresh();

  expect(mockGetItemAsync).toHaveBeenCalledWith("org.refresh");
  expect(result).toBe("stored-refresh");
});

test("clear deletes both access and refresh keys", async () => {
  mockDeleteItemAsync.mockResolvedValue(undefined);

  await tokenStore.clear();

  expect(mockDeleteItemAsync).toHaveBeenCalledWith("org.access");
  expect(mockDeleteItemAsync).toHaveBeenCalledWith("org.refresh");
  expect(mockDeleteItemAsync).toHaveBeenCalledTimes(2);
});
