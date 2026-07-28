import { apiClient } from "./client";

export type InviteMember = {
  displayName: string;
  initials: string;
};

export type InvitePreview = {
  environmentName: string;
  envType: string;
  memberCount: number;
  members: InviteMember[];
  invitedByName: string;
  status: string;
  email: string;
};

export type AcceptInviteResult = {
  environmentId: string;
  role: string;
};

type InviteMemberResponse = {
  display_name: string;
  initials: string;
};

type InvitePreviewResponse = {
  environment_name: string;
  env_type: string;
  member_count: number;
  members: InviteMemberResponse[];
  invited_by_name: string;
  status: string;
  email: string;
};

type AcceptInviteResponse = {
  environment_id: string;
  role: string;
};

function mapPreview(response: InvitePreviewResponse): InvitePreview {
  return {
    environmentName: response.environment_name,
    envType: response.env_type,
    memberCount: response.member_count,
    members: response.members.map((member) => ({
      displayName: member.display_name,
      initials: member.initials,
    })),
    invitedByName: response.invited_by_name,
    status: response.status,
    email: response.email,
  };
}

function mapAcceptResult(response: AcceptInviteResponse): AcceptInviteResult {
  return {
    environmentId: response.environment_id,
    role: response.role,
  };
}

async function preview(token: string): Promise<InvitePreview> {
  const response = await apiClient.request<InvitePreviewResponse>(`/api/invitations/${token}/preview/`, {
    method: "GET",
    auth: false,
  });

  return mapPreview(response);
}

async function accept(token: string): Promise<AcceptInviteResult> {
  const response = await apiClient.request<AcceptInviteResponse>("/api/invitations/accept/", {
    method: "POST",
    body: { token },
  });

  return mapAcceptResult(response);
}

export const invitesApi = {
  preview,
  accept,
};
