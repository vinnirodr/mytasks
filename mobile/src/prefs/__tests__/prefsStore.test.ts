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
