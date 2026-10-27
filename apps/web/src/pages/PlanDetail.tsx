import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Plan, type Session } from "../api.js";

function startOfWeekRef(plan: Plan): Date {
  if (plan.startDate) return new Date(plan.startDate);
  if (plan.sessions.length > 0) {
    return new Date(Math.min(...plan.sessions.map((s) => new Date(s.date).getTime())));
  }
  return new Date();
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function groupByWeek(sessions: Session[], ref: Date) {
  const weeks = new Map<number, Session[]>();
  for (const s of sessions) {
    const weekIndex = Math.floor((new Date(s.date).getTime() - ref.getTime()) / WEEK_MS);
    if (!weeks.has(weekIndex)) weeks.set(weekIndex, []);
    weeks.get(weekIndex)!.push(s);
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weekIndex, sessions]) => ({
      weekIndex,
      start: new Date(ref.getTime() + weekIndex * WEEK_MS),
      sessions: sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    }));
}

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("run");

  const load = () => {
    if (!id) return;
    api.getPlan(id).then(setPlan).catch((e) => setError(String(e)));
  };

  useEffect(() => {
    load();
  }, [id]);

  const addSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !title.trim() || !date) return;
    await api.createSession({ planId: id, title, date, type });
    setTitle("");
    setDate("");
    await load();
  };

  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!plan) return <p>Loading...</p>;

  const ref = startOfWeekRef(plan);
  const weeks = groupByWeek(plan.sessions, ref);

  return (
    <div>
      <p>
        <Link to="/plans">&larr; Plans</Link>
      </p>
      <h1>{plan.name}</h1>
      {plan.description && <p>{plan.description}</p>}

      {weeks.length === 0 && <p>No sessions yet.</p>}
      {weeks.map(({ weekIndex, start, sessions }) => {
        const end = new Date(start.getTime() + WEEK_MS - DAY_MS);
        return (
          <div key={weekIndex} style={{ marginBottom: 16 }}>
            <h3>
              Week {weekIndex + 1} ({start.toLocaleDateString()} – {end.toLocaleDateString()})
            </h3>
            <ul>
              {sessions.map((s) => (
                <li key={s.id}>
                  {new Date(s.date).toLocaleString(undefined, {
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  — {s.type} — {s.title} {s.completed ? "✅" : ""}
                  {s.activity && (
                    <>
                      {" "}
                      ({(s.activity.distanceM ? s.activity.distanceM / 1000 : 0).toFixed(1)} km,{" "}
                      {Math.round(s.activity.durationSec / 60)} min)
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <h3>Add session</h3>
      <form onSubmit={addSession}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="run">Run</option>
          <option value="bike">Bike</option>
          <option value="swim">Swim</option>
          <option value="strength">Strength</option>
        </select>
        <button type="submit">Add session</button>
      </form>
    </div>
  );
}
