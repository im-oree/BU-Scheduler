export type HealthResponse = {
  ok: boolean;
  service: string;
  timestamp: string;
};

export type GroupSummary = {
  id: string;
  title: string;
  courseCode: string;
  level: string;
  memberCount: number;
  nextClass: string;
};

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchHealth(signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/health`, { signal });
  return parseJsonResponse<HealthResponse>(response);
}

export async function fetchGroups(signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/groups`, { signal });
  const payload = await parseJsonResponse<{ data?: GroupSummary[] }>(response);
  return payload.data ?? [];
}
