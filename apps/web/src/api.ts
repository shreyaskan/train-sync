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
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  sessions: Session[];
}

export interface Session {
  id: string;
  planId: string | null;
  date: string;
  type: string;
  title: string;
  description: string | null;
  targetDuration: number | null;
  targetDistance: number | null;
  completed: boolean;
  activityId: string | null;
}

export const api = {
  getActivities: () => request<Activity[]>("/activities"),
  syncActivities: () => request<{ synced: number }>("/activities/sync", { method: "POST" }),

  getPlans: () => request<Plan[]>("/plans"),
  createPlan: (data: { name: string; description?: string }) =>
    request<Plan>("/plans", { method: "POST", body: JSON.stringify(data) }),

  getSessions: () => request<Session[]>("/sessions"),
  createSession: (data: Partial<Session> & { date: string; type: string; title: string }) =>
    request<Session>("/sessions", { method: "POST", body: JSON.stringify(data) }),
};
