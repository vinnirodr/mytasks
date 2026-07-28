import { apiClient } from "./client";

export type EnvRole = "ADMIN" | "MEMBER";

export type Environment = {
  id: string;
  name: string;
  envType: string;
  timezone: string;
  role: EnvRole | null;
};

type EnvironmentResponse = {
  id: string;
  name: string;
  env_type: string;
  timezone: string;
  role: EnvRole | null;
};

function mapEnvironment(response: EnvironmentResponse): Environment {
  return {
    id: response.id,
    name: response.name,
    envType: response.env_type,
    timezone: response.timezone,
    role: response.role,
  };
}

async function list(): Promise<Environment[]> {
  const response = await apiClient.request<EnvironmentResponse[]>("/api/environments/", {
    method: "GET",
  });

  return response.map(mapEnvironment);
}

export const environmentsApi = {
  list,
};
