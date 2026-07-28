import { Platform } from "react-native";

import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";

const ACCESS_KEY = "org.access";
const REFRESH_KEY = "org.refresh";

type Tokens = {
  access: string;
  refresh: string;
};

// `expo-secure-store` has no web implementation — `getItemAsync` etc. throw
// on `Platform.OS === "web"`. Web (used to verify these auth screens in a
// browser) falls back to `window.localStorage` under the same key names;
// native keeps using the Keychain/Keystore-backed secure store.
const isWeb = Platform.OS === "web";

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return window.localStorage.getItem(key);
  }
  return getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    window.localStorage.setItem(key, value);
    return;
  }
  await setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    window.localStorage.removeItem(key);
    return;
  }
  await deleteItemAsync(key);
}

export const tokenStore = {
  async getAccess(): Promise<string | null> {
    return getItem(ACCESS_KEY);
  },

  async getRefresh(): Promise<string | null> {
    return getItem(REFRESH_KEY);
  },

  async setTokens({ access, refresh }: Tokens): Promise<void> {
    await setItem(ACCESS_KEY, access);
    await setItem(REFRESH_KEY, refresh);
  },

  async clear(): Promise<void> {
    await deleteItem(ACCESS_KEY);
    await deleteItem(REFRESH_KEY);
  },
};
