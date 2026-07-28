import { apiClient } from "./client";

export type TaskDefinition = { id: string; name: string; icon: string };

export type RecurringTask = {
  id: string;
  taskDefinition: string;
  weekday: number;
  time: string | null;
  assignee: string | null;
  active: boolean;
};

type RecurringTaskResponse = {
  id: string;
  task_definition: string;
  weekday: number;
  time: string | null;
  assignee: string | null;
  active: boolean;
};

function mapRecurringTask(response: RecurringTaskResponse): RecurringTask {
  return {
    id: response.id,
    taskDefinition: response.task_definition,
    weekday: response.weekday,
    time: response.time,
    assignee: response.assignee,
    active: response.active,
  };
}

type TaskDefinitionResponse = {
  id: string;
  name: string;
  icon: string;
};

function mapTaskDefinition(response: TaskDefinitionResponse): TaskDefinition {
  return {
    id: response.id,
    name: response.name,
    icon: response.icon,
  };
}

async function createDefinition(envId: string, input: { name: string; icon?: string }): Promise<TaskDefinition> {
  const response = await apiClient.request<TaskDefinitionResponse>(`/api/environments/${envId}/task-definitions/`, {
    method: "POST",
    body: { name: input.name, icon: input.icon ?? "" },
  });

  return mapTaskDefinition(response);
}

async function createRecurring(
  envId: string,
  input: { taskDefinition: string; weekday: number; time: string; assignee: string },
): Promise<RecurringTask> {
  const response = await apiClient.request<RecurringTaskResponse>(`/api/environments/${envId}/recurring-tasks/`, {
    method: "POST",
    body: {
      task_definition: input.taskDefinition,
      weekday: input.weekday,
      time: input.time,
      assignee: input.assignee,
      active: true,
    },
  });

  return mapRecurringTask(response);
}

export const tasksApi = {
  createDefinition,
  createRecurring,
};
