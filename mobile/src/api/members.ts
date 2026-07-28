import { apiClient } from "./client";
import type { EnvRole } from "./environments";

export type Member = {
  id: string;
  userId: string;
  displayName: string;
  initials: string;
  role: EnvRole;
  isMe: boolean;
};

type MemberResponse = {
  id: string;
  user_id: string;
  display_name: string;
  initials: string;
  role: EnvRole;
  is_me: boolean;
};

function mapMember(response: MemberResponse): Member {
  return {
    id: response.id,
    userId: response.user_id,
    displayName: response.display_name,
    initials: response.initials,
    role: response.role,
    isMe: response.is_me,
  };
}

async function list(envId: string): Promise<Member[]> {
  const response = await apiClient.request<MemberResponse[]>(`/api/environments/${envId}/members/`, {
    method: "GET",
  });

  return response.map(mapMember);
}

export const membersApi = {
  list,
};
