import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Session } from "../api.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const NUM_WEEKS = 6;

function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayIndex = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
  d.setDate(d.getDate() - dayIndex);
  return d;
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function formatDistance(meters: number) {
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Calendar() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState(() => mondayOf(new Date()));

  useEffect(() => {
    api.getSessions().then(setSessions).catch((e) => setError(String(e)));
  }, []);

  if (error) return <p style={{ color: "red" }}>{error}</p>;

  const weeks = Array.from({ length: NUM_WEEKS }, (_, i) => {
    const weekStart = new Date(anchor.getTime() + i * 7 * DAY_MS);
    const days = Array.from({ length: 7 }, (_, d) => new Date(weekStart.getTime() + d * DAY_MS));
    return { weekStart, days };
  });

  return (
    <div>
      <h1>Calendar</h1>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setAnchor(new Date(anchor.getTime() - 7 * DAY_MS))}>
          &larr; Prev week
        </button>{" "}
        <button onClick={() => setAnchor(mondayOf(new Date()))}>Today</button>{" "}
        <button onClick={() => setAnchor(new Date(anchor.getTime() + 7 * DAY_MS))}>
          Next week &rarr;
        </button>
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 4 }}></th>
            {DAY_LABELS.map((label) => (
              <th key={label} style={{ textAlign: "left", padding: 4, minWidth: 110 }}>
                {label}
              </th>
            ))}
            <th style={{ textAlign: "left", padding: 4, minWidth: 140 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map(({ weekStart, days }) => {
            const weekSessions = sessions.filter((s) =>
              days.some((d) => sameDay(d, new Date(s.date))),
            );

            // Planned fields are stored in the same units as the matching
            // Activity fields (meters / seconds) so planned and actual can
            // be summed side by side.
            const planned = weekSessions.reduce(
              (acc, s) => ({
                distance: acc.distance + (s.targetDistance ?? 0),
                duration: acc.duration + (s.targetDuration ?? 0),
              }),
              { distance: 0, duration: 0 },
            );
            const actual = weekSessions.reduce(
              (acc, s) => ({
                distance: acc.distance + (s.activity?.distanceM ?? 0),
                duration: acc.duration + (s.activity?.durationSec ?? 0),
              }),
              { distance: 0, duration: 0 },
            );

            return (
              <tr key={weekStart.toISOString()}>
                <td style={{ padding: 4, verticalAlign: "top", whiteSpace: "nowrap" }}>
                  {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </td>
                {days.map((day) => {
                  const daySessions = weekSessions.filter((s) => sameDay(day, new Date(s.date)));
                  return (
                    <td
                      key={day.toISOString()}
                      style={{ padding: 4, verticalAlign: "top", border: "1px solid #ddd" }}
                    >
                      {daySessions.map((s) => (
                        <div key={s.id} style={{ marginBottom: 4 }}>
                          <div>
                            {s.completed ? "✅ " : ""}
                            {s.title}
                          </div>
                          <small>
                            {s.type}
                            {s.plan ? ` · ${s.plan.name}` : ""}
                          </small>
                        </div>
                      ))}
                    </td>
                  );
                })}
                <td style={{ padding: 4, verticalAlign: "top" }}>
                  <div>
                    Planned: {formatDistance(planned.distance)} / {formatDuration(planned.duration)}
                  </div>
                  <div>
                    Actual: {formatDistance(actual.distance)} / {formatDuration(actual.duration)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p style={{ marginTop: 16 }}>
        <Link to="/plans">View plans</Link>
      </p>
    </div>
  );
}
