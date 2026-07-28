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

export const authApi = {
  register,
  login,
  me,
};
