/**
 * Organizados — Auth session context
 *
 * Boots by checking for a stored access token: if one exists, validates it
 * via `authApi.me()` and resolves to "signedIn"; otherwise resolves straight
 * to "signedOut". Exposes signIn/register/signOut for screens, and wires
 * `apiClient.setOnUnauthorized` so a failed silent refresh anywhere in the
 * app (see api/client.ts) drops the session back to "signedOut".
 */

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { authApi, type AuthUser } from "@/api/auth";
import { apiClient } from "@/api/client";
import { tokenStore } from "@/api/tokenStore";

export type AuthStatus = "loading" | "signedOut" | "signedIn";

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const access = await tokenStore.getAccess();

      if (!access) {
        if (!cancelled) {
          setStatus("signedOut");
        }
        return;
      }

      try {
        const me = await authApi.me();
        if (!cancelled) {
          setUser(me);
          setStatus("signedIn");
        }
      } catch {
        await tokenStore.clear();
        if (!cancelled) {
          setUser(null);
          setStatus("signedOut");
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await tokenStore.clear();
    setUser(null);
    setStatus("signedOut");
  }, []);

  useEffect(() => {
    apiClient.setOnUnauthorized(() => {
      void signOut();
    });
  }, [signOut]);

  async function signIn(email: string, password: string) {
    const tokens = await authApi.login({ email, password });
    await tokenStore.setTokens(tokens);
    try {
      const me = await authApi.me();
      setUser(me);
      setStatus("signedIn");
    } catch (error) {
      await tokenStore.clear();
      throw error;
    }
  }

  async function register(email: string, password: string, displayName: string) {
    await authApi.register({ email, password, displayName });
    await signIn(email, password);
  }

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signIn, register, signOut }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
