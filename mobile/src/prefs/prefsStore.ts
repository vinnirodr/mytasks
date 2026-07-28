import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_SEEN_KEY = "org.onboardingSeen";
const SEEN_VALUE = "1";
const ACTIVE_ENVIRONMENT_ID_KEY = "org.activeEnvironmentId";

export const prefsStore = {
  async getOnboardingSeen(): Promise<boolean> {
    const value = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
    return value === SEEN_VALUE;
  },

  async setOnboardingSeen(): Promise<void> {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, SEEN_VALUE);
  },

  async getActiveEnvironmentId(): Promise<string | null> {
    return AsyncStorage.getItem(ACTIVE_ENVIRONMENT_ID_KEY);
  },

  async setActiveEnvironmentId(id: string): Promise<void> {
    await AsyncStorage.setItem(ACTIVE_ENVIRONMENT_ID_KEY, id);
  },
};
