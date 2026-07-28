import AsyncStorage from "@react-native-async-storage/async-storage";

import { prefsStore } from "../prefsStore";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

test("setOnboardingSeen writes \"1\" to the onboarding-seen key", async () => {
  await prefsStore.setOnboardingSeen();

  await expect(AsyncStorage.getItem("org.onboardingSeen")).resolves.toBe("1");
});

test("getOnboardingSeen returns true after setOnboardingSeen", async () => {
  await prefsStore.setOnboardingSeen();

  await expect(prefsStore.getOnboardingSeen()).resolves.toBe(true);
});

test("getOnboardingSeen returns false when unset", async () => {
  await expect(prefsStore.getOnboardingSeen()).resolves.toBe(false);
});

test("setActiveEnvironmentId writes the id to the active-environment key", async () => {
  await prefsStore.setActiveEnvironmentId("env-1");

  await expect(AsyncStorage.getItem("org.activeEnvironmentId")).resolves.toBe("env-1");
});

test("getActiveEnvironmentId returns the persisted id after setActiveEnvironmentId", async () => {
  await prefsStore.setActiveEnvironmentId("env-1");

  await expect(prefsStore.getActiveEnvironmentId()).resolves.toBe("env-1");
});

test("getActiveEnvironmentId returns null when unset", async () => {
  await expect(prefsStore.getActiveEnvironmentId()).resolves.toBeNull();
});
