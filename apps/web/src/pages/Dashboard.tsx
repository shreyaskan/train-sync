import { useEffect, useState } from "react";
import { api, type Activity } from "../api.js";

export default function Dashboard() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.getActivities().then(setActivities).catch((e) => setError(String(e)));

  useEffect(() => {
    load();
  }, []);

  const sync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await api.syncActivities();
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
      <button onClick={sync} disabled={syncing}>
        {syncing ? "Syncing..." : "Sync from Garmin"}
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
