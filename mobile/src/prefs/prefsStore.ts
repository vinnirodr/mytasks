import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_SEEN_KEY = "org.onboardingSeen";
const SEEN_VALUE = "1";

export const prefsStore = {
  async getOnboardingSeen(): Promise<boolean> {
    const value = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
    return value === SEEN_VALUE;
  },

  async setOnboardingSeen(): Promise<void> {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, SEEN_VALUE);
  },
};
