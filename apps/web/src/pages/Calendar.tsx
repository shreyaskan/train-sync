import { useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { api, type Activity, type Session } from "../api.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SessionDialogState = { mode: "add"; date: Date } | { mode: "edit"; session: Session };

const SESSION_TYPES = ["training", "race", "time trial", "gym"] as const;
const DEFAULT_SESSION_TYPE: (typeof SESSION_TYPES)[number] = "training";

// Each session type gets its own card background so the type is visible at a
// glance on the calendar without showing a text label.
const SESSION_TYPE_BG: Record<string, string> = {
  training: "bg-primary/10",
  race: "bg-[#ff0000]/40",
  "time trial": "bg-amber-500/15",
  gym: "bg-[#f0ba65]/40",
};
const ACTIVITY_BG = "bg-[#81d13f]/40";

function sessionBg(type: string) {
  return SESSION_TYPE_BG[type] ?? SESSION_TYPE_BG[DEFAULT_SESSION_TYPE];
}

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

  const [dialog, setDialog] = useState<SessionDialogState | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDistance, setFormDistance] = useState("");
  const [formType, setFormType] = useState<string>(DEFAULT_SESSION_TYPE);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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

  const openAddDialog = (date: Date) => {
    setDialog({ mode: "add", date });
    setFormTitle("");
    setFormDistance("");
    setFormType(DEFAULT_SESSION_TYPE);
    setConfirmingDelete(false);
  };

  const openEditDialog = (session: Session) => {
    setDialog({ mode: "edit", session });
    setFormTitle(session.title);
    setFormDistance(session.targetDistance != null ? String(session.targetDistance / 1000) : "");
    setFormType(
      (SESSION_TYPES as readonly string[]).includes(session.type)
        ? session.type
        : DEFAULT_SESSION_TYPE,
    );
    setConfirmingDelete(false);
  };

  const closeDialog = () => {
    setDialog(null);
    setFormTitle("");
    setFormDistance("");
    setFormType(DEFAULT_SESSION_TYPE);
    setConfirmingDelete(false);
  };

  const submitSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dialog || !formTitle.trim()) return;
    setSaving(true);
    try {
      const targetDistance = formDistance ? Number(formDistance) * 1000 : undefined;
      if (dialog.mode === "add") {
        await api.createSession({
          date: dialog.date.toISOString(),
          title: formTitle,
          type: formType,
          targetDistance,
        });
      } else {
        await api.updateSession(dialog.session.id, {
          title: formTitle,
          type: formType,
          targetDistance,
        });
      }
      closeDialog();
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteSession = async () => {
    if (!dialog || dialog.mode !== "edit") return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await api.deleteSession(dialog.session.id);
      closeDialog();
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(false);
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
                      <TableCell
                        key={day.toISOString()}
                        className="group align-top whitespace-normal"
                      >
                        <div className="flex min-h-[104px] flex-col space-y-2">
                          {daySessions.map((s) => (
                            <div
                              key={s.id}
                              className={`group/card relative rounded-md ${sessionBg(s.type)} p-3`}
                            >
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="absolute top-1 right-1 opacity-0 transition-opacity group-hover/card:opacity-100"
                                onClick={() => openEditDialog(s)}
                              >
                                <Pencil />
                              </Button>
                              <div className="flex items-center gap-1.5 pr-6 text-base font-bold">
                                {s.completed && (
                                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                                )}
                                <span className="truncate">{s.title}</span>
                              </div>
                              {!s.activity && (
                                <div className="mt-1 text-sm text-muted-foreground">
                                  Distance:{" "}
                                  {s.targetDistance != null ? formatKm(s.targetDistance) : "-"}
                                </div>
                              )}
                              {s.activity && <ActivityStats activity={s.activity} />}
                            </div>
                          ))}
                          {dayUnmatched.map((a) => (
                            <div key={a.id} className={`rounded-md ${ACTIVITY_BG} p-3`}>
                              <ActivityStats activity={a} />
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full flex-1 border border-dashed border-border text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => openAddDialog(day)}
                          >
                            <Plus />
                          </Button>
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

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog &&
                (dialog.mode === "add" ? dialog.date : new Date(dialog.session.date)).toLocaleDateString(
                  undefined,
                  { weekday: "long", month: "short", day: "numeric" },
                )}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitSession} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="session-title">Title</Label>
              <Input
                id="session-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Easy 5k"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-distance">Distance (km)</Label>
              <Input
                id="session-distance"
                type="number"
                step="0.1"
                min={0}
                value={formDistance}
                onChange={(e) => setFormDistance(e.target.value)}
                placeholder="5"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t[0].toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="sm:justify-between">
              {dialog?.mode === "edit" ? (
                <Button
                  type="button"
                  variant={confirmingDelete ? "destructive" : "ghost"}
                  size="icon"
                  disabled={deleting}
                  onClick={deleteSession}
                  title={confirmingDelete ? "Click again to confirm" : "Delete session"}
                >
                  <Trash2 />
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={saving || !formTitle.trim()}>
                {saving ? "Saving..." : dialog?.mode === "edit" ? "Save changes" : "Add session"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
