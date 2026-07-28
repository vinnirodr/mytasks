import { apiClient } from "./client";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  displayName: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type TokenPair = {
  access: string;
  refresh: string;
};

export type RefreshResult = {
  access: string;
};

type UserResponse = {
  id: string;
  email: string;
  display_name: string;
};

function mapUser(response: UserResponse): AuthUser {
  return {
    id: response.id,
    email: response.email,
    displayName: response.display_name,
  };
}

async function register(input: RegisterInput): Promise<AuthUser> {
  const response = await apiClient.request<UserResponse>("/api/auth/register/", {
    method: "POST",
    body: {
      email: input.email,
      password: input.password,
      display_name: input.displayName,
    },
    auth: false,
  });

  return mapUser(response);
}

async function login(input: LoginInput): Promise<TokenPair> {
  return apiClient.request<TokenPair>("/api/auth/token/", {
    method: "POST",
    body: {
      email: input.email,
      password: input.password,
    },
    auth: false,
  });
}

async function me(): Promise<AuthUser> {
  const response = await apiClient.request<UserResponse>("/api/auth/me/", {
    method: "GET",
  });

  return mapUser(response);
}

async function refresh(refreshToken: string): Promise<RefreshResult> {
  return apiClient.request<RefreshResult>("/api/auth/token/refresh/", {
    method: "POST",
    body: { refresh: refreshToken },
    auth: false,
  });
}

export const authApi = {
  register,
  login,
  me,
  refresh,
};
