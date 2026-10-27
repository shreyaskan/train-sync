import { useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { api, type Activity, type Session } from "../api.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

function formatKm(meters: number) {
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ActivityStats({ activity }: { activity: Activity }) {
  return (
    <div className="mt-1.5 space-y-1 text-sm text-muted-foreground">
      <div className="truncate text-base font-bold text-foreground">
        {activity.name ?? "Untitled"}
      </div>
      <div>Distance: {formatKm(activity.distanceM ?? 0)}</div>
      <div>Time: {formatClock(activity.durationSec)}</div>
      {activity.avgHr != null && <div>Avg HR: {activity.avgHr}bpm</div>}
    </div>
  );
}

export default function Calendar() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState(() => mondayOf(new Date()));
  const [syncing, setSyncing] = useState(false);
  const [syncDays, setSyncDays] = useState(30);
  const [lastResult, setLastResult] = useState<{ synced: number; matched: number } | null>(null);

  const load = () =>
    Promise.all([api.getSessions(), api.getActivities()])
      .then(([sessions, activities]) => {
        setSessions(sessions);
        setActivities(activities);
      })
      .catch((e) => setError(String(e)));

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

  if (error) return <p className="text-destructive">{error}</p>;

  // Activities already linked to a session are shown inside that session's
  // card instead of as a separate entry.
  const linkedActivityIds = new Set(sessions.map((s) => s.activityId).filter(Boolean));
  const unmatchedActivities = activities.filter((a) => !linkedActivityIds.has(a.id));

  const weeks = Array.from({ length: NUM_WEEKS }, (_, i) => {
    const weekStart = new Date(anchor.getTime() + i * 7 * DAY_MS);
    const days = Array.from({ length: 7 }, (_, d) => new Date(weekStart.getTime() + d * DAY_MS));
    return { weekStart, days };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAnchor(new Date(anchor.getTime() - 7 * DAY_MS))}
          >
            <ChevronLeft /> Prev
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setAnchor(mondayOf(new Date()))}>
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAnchor(new Date(anchor.getTime() + 7 * DAY_MS))}
          >
            Next <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          value={syncDays}
          onChange={(e) => setSyncDays(Number(e.target.value))}
          className="w-16"
        />
        <span className="text-sm text-muted-foreground">days</span>
        <Button size="sm" onClick={() => sync({ days: syncDays })} disabled={syncing}>
          {syncing ? "Syncing..." : "Sync from Garmin"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => sync({ full: true })} disabled={syncing}>
          Full history sync
        </Button>
        {lastResult && (
          <span className="text-sm text-muted-foreground">
            Synced {lastResult.synced}, matched {lastResult.matched} to sessions.
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16"></TableHead>
              {DAY_LABELS.map((label) => (
                <TableHead key={label} className="w-[13%] min-w-0">
                  {label}
                </TableHead>
              ))}
              <TableHead className="w-[11%] min-w-0">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {weeks.map(({ weekStart, days }) => {
              const weekSessions = sessions.filter((s) =>
                days.some((d) => sameDay(d, new Date(s.date))),
              );
              const weekUnmatched = unmatchedActivities.filter((a) =>
                days.some((d) => sameDay(d, new Date(a.startTime))),
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
              const actual = [
                ...weekSessions.map((s) => s.activity).filter((a): a is Activity => !!a),
                ...weekUnmatched,
              ].reduce(
                (acc, a) => ({
                  distance: acc.distance + (a.distanceM ?? 0),
                  duration: acc.duration + a.durationSec,
                }),
                { distance: 0, duration: 0 },
              );

              return (
                <TableRow key={weekStart.toISOString()} className="align-top">
                  <TableCell className="whitespace-nowrap align-top text-xs text-muted-foreground">
                    {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </TableCell>
                  {days.map((day) => {
                    const daySessions = weekSessions.filter((s) =>
                      sameDay(day, new Date(s.date)),
                    );
                    const dayUnmatched = weekUnmatched.filter((a) =>
                      sameDay(day, new Date(a.startTime)),
                    );
                    return (
                      <TableCell key={day.toISOString()} className="align-top whitespace-normal">
                        <div className="space-y-2">
                          {daySessions.map((s) => (
                            <div key={s.id} className="rounded-md bg-accent/60 p-3">
                              <div className="flex items-center gap-1.5 text-sm font-medium">
                                {s.completed && (
                                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                                )}
                                <span>{s.title}</span>
                              </div>
                              <div className="mt-1 flex items-center gap-1.5">
                                <Badge variant="secondary">{s.type}</Badge>
                              </div>
                              {s.activity && <ActivityStats activity={s.activity} />}
                            </div>
                          ))}
                          {dayUnmatched.map((a) => (
                            <div key={a.id} className="rounded-md bg-muted/40 p-3">
                              <ActivityStats activity={a} />
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="align-top whitespace-normal text-xs">
                    <div className="text-muted-foreground">
                      Planned: {formatDistance(planned.distance)} /{" "}
                      {formatDuration(planned.duration)}
                    </div>
                    <div className="font-medium">
                      Actual: {formatDistance(actual.distance)} /{" "}
                      {formatDuration(actual.duration)}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
