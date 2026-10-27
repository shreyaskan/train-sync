import { useEffect, useState } from "react";
import { api, type Activity } from "../api.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [lastResult, setLastResult] = useState<{ synced: number; matched: number } | null>(null);

  const load = () => api.getActivities().then(setActivities).catch((e) => setError(String(e)));

  useEffect(() => {
    load();
  }, []);

  const sync = async (opts: { full?: boolean; days?: number } = {}) => {
    setSyncing(true);
    setError(null);
    try {
      const result = await api.syncActivities(opts);
      setLastResult(result);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Activities</h1>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-16"
          />
          <span className="text-sm text-muted-foreground">days</span>
          <Button size="sm" onClick={() => sync({ days })} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync from Garmin"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => sync({ full: true })} disabled={syncing}>
            Full history sync
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {lastResult && (
        <p className="text-sm text-muted-foreground">
          Synced {lastResult.synced} activities, matched {lastResult.matched} to planned sessions.
        </p>
      )}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {activities.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              {new Date(a.startTime).toLocaleDateString()}
            </span>
            <Badge variant="secondary">{a.type}</Badge>
            <span className="flex-1 truncate">{a.name ?? "Untitled"}</span>
            <span className="text-muted-foreground">{Math.round(a.durationSec / 60)} min</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
