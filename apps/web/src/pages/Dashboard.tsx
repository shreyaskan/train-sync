import { useEffect, useState } from "react";
import { api, type Activity } from "../api.js";

export default function Dashboard() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const load = () => api.getActivities().then(setActivities).catch((e) => setError(String(e)));

  useEffect(() => {
    load();
  }, []);

  const sync = async (opts: { full?: boolean; days?: number } = {}) => {
    setSyncing(true);
    setError(null);
    try {
      await api.syncActivities(opts);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <h1>Activities</h1>
      <input
        type="number"
        min={1}
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        style={{ width: 60 }}
      />{" "}
      days{" "}
      <button onClick={() => sync({ days })} disabled={syncing}>
        {syncing ? "Syncing..." : "Sync from Garmin"}
      </button>{" "}
      <button onClick={() => sync({ full: true })} disabled={syncing}>
        {syncing ? "Syncing..." : "Full history sync"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <ul>
        {activities.map((a) => (
          <li key={a.id}>
            {new Date(a.startTime).toLocaleDateString()} — {a.type} — {a.name ?? "Untitled"} —{" "}
            {Math.round(a.durationSec / 60)} min
          </li>
        ))}
      </ul>
    </div>
  );
}
