const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`${options?.method ?? "GET"} ${path} failed: ${res.status}`);
  return res.json();
}

export interface Activity {
  id: string;
  garminId: string;
  type: string;
  name: string | null;
  startTime: string;
  durationSec: number;
  distanceM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
}

export interface Session {
  id: string;
  date: string;
  type: string;
  title: string;
  description: string | null;
  targetDuration: number | null;
  targetDistance: number | null;
  completed: boolean;
  activityId: string | null;
  activity?: Activity | null;
}

export const api = {
  getActivities: () => request<Activity[]>("/activities"),
  syncActivities: (opts: { full?: boolean; days?: number } = {}) => {
    const params = new URLSearchParams();
    if (opts.full) params.set("full", "true");
    if (opts.days) params.set("days", String(opts.days));
    return request<{ synced: number; matched: number; pages: number }>(`/activities/sync?${params}`, {
      method: "POST",
    });
  },

  getSessions: () => request<Session[]>("/sessions"),
  createSession: (data: Partial<Session> & { date: string; type: string; title: string }) =>
    request<Session>("/sessions", { method: "POST", body: JSON.stringify(data) }),
  updateSession: (id: string, data: Partial<Pick<Session, "title" | "targetDistance">>) =>
    request<Session>(`/sessions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};
