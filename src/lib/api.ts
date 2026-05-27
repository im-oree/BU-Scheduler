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

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/u, '');
}

const studentHubBaseUrl = trimTrailingSlash(import.meta.env.VITE_STUDENTHUB_API || import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000');

export const apiBaseUrl = `${studentHubBaseUrl}/api`;

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
