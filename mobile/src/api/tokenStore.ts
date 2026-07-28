import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";

const ACCESS_KEY = "org.access";
const REFRESH_KEY = "org.refresh";

type Tokens = {
  access: string;
  refresh: string;
};

export const tokenStore = {
  async getAccess(): Promise<string | null> {
    return getItemAsync(ACCESS_KEY);
  },

  async getRefresh(): Promise<string | null> {
    return getItemAsync(REFRESH_KEY);
  },

  async setTokens({ access, refresh }: Tokens): Promise<void> {
    await setItemAsync(ACCESS_KEY, access);
    await setItemAsync(REFRESH_KEY, refresh);
  },

  async clear(): Promise<void> {
    await deleteItemAsync(ACCESS_KEY);
    await deleteItemAsync(REFRESH_KEY);
  },
};
