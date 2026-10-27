import { useEffect, useState } from "react";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { cn } from "cn";
import { api, type Activity, type Session } from "../api.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/rich-text-editor";
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

const ALL_TYPES = ["training", "race", "time trial", "gym", "rest"] as const;
type SessionType = (typeof ALL_TYPES)[number];

// The three "quick add" buttons (besides the generic "Session" one) each
// create a session with a fixed/implied type and a reduced field set.
type AddKind = "session" | "easy-run" | "gym";

const ADD_CONFIG: Record<
  AddKind,
  {
    showTitle: boolean;
    showType: boolean;
    showDescription: boolean;
    typeOptions: SessionType[];
    defaultType: SessionType;
    defaultTitle: string;
  }
> = {
  session: {
    showTitle: true,
    showType: true,
    showDescription: false,
    typeOptions: ["training", "race", "time trial"],
    defaultType: "training",
    defaultTitle: "",
  },
  "easy-run": {
    showTitle: false,
    showType: false,
    showDescription: false,
    typeOptions: [],
    defaultType: "training",
    defaultTitle: "",
  },
  gym: {
    showTitle: true,
    showType: false,
    showDescription: true,
    typeOptions: [],
    defaultType: "gym",
    defaultTitle: "Gym",
  },
};

type SessionDialogState =
  | { mode: "add"; kind: AddKind; date: Date }
  | { mode: "edit"; session: Session }
  | { mode: "complete-gym"; session: Session };

// Each session type gets its own card background so the type is visible at a
// glance on the calendar without showing a text label.
const SESSION_TYPE_BG: Record<string, string> = {
  training: "bg-primary/10",
  race: "bg-[#ff0000]/40",
  "time trial": "bg-amber-500/15",
  gym: "bg-[#f0ba65]/40",
  rest: "bg-[#e3d56b]/40",
};
const ACTIVITY_BG = "bg-[#81d13f]/40";

// A completed session (matched to a real Garmin activity) turns the same
// green as a standalone activity card, overriding its type color — type
// matters while it's still planned, completion matters once it's done.
function sessionBg(session: Session) {
  if (session.completed) return ACTIVITY_BG;
  return SESSION_TYPE_BG[session.type] ?? SESSION_TYPE_BG.training;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayIndex = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
  d.setDate(d.getDate() - dayIndex);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
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
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// showName is false when nested inside a session card, which already shows
// the session's own title — the Garmin activity's name (e.g. "Reading
// Running") shouldn't override or duplicate the planned session's name.
function ActivityStats({ activity, showName = true }: { activity: Activity; showName?: boolean }) {
  return (
    <div className="mt-1.5 space-y-1 text-sm text-muted-foreground">
      {showName && (
        <div className="truncate text-base font-bold text-foreground">
          {activity.name ?? "Untitled"}
        </div>
      )}
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
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));
  const [syncing, setSyncing] = useState(false);
  const [syncDays, setSyncDays] = useState(30);
  const [lastResult, setLastResult] = useState<{ synced: number; matched: number } | null>(null);

  const [dialog, setDialog] = useState<SessionDialogState | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDistance, setFormDistance] = useState("");
  const [formType, setFormType] = useState<SessionType>("training");
  const [formDescription, setFormDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState(false);

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

  const openAddDialog = (date: Date, kind: AddKind) => {
    const cfg = ADD_CONFIG[kind];
    setDialog({ mode: "add", kind, date });
    setFormTitle(cfg.defaultTitle);
    setFormDistance("");
    setFormType(cfg.defaultType);
    setFormDescription("");
  };

  const openEditDialog = (session: Session) => {
    setDialog({ mode: "edit", session });
    setFormTitle(session.title);
    setFormDistance(session.targetDistance != null ? String(session.targetDistance / 1000) : "");
    setFormType(
      (ALL_TYPES as readonly string[]).includes(session.type)
        ? (session.type as SessionType)
        : "training",
    );
    setFormDescription("");
  };

  const openCompleteGymDialog = (session: Session) => {
    setDialog({ mode: "complete-gym", session });
    setFormDescription(session.description ?? "");
  };

  const closeDialog = () => {
    setDialog(null);
    setFormTitle("");
    setFormDistance("");
    setFormType("training");
    setFormDescription("");
  };

  // "Rest" has no dialog — it adds a fixed card immediately.
  const addRestSession = async (date: Date) => {
    setError(null);
    try {
      await api.createSession({ date: date.toISOString(), title: "Rest", type: "rest" });
      await load();
    } catch (e) {
      setError(String(e));
    }
  };

  const submitSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dialog || dialog.mode === "complete-gym") return;
    const isEasyRun = dialog.mode === "add" && dialog.kind === "easy-run";
    if (isEasyRun ? !formDistance.trim() : !formTitle.trim()) return;

    setSaving(true);
    try {
      const targetDistance = formDistance ? Number(formDistance) * 1000 : undefined;
      const description = formDescription.trim() ? formDescription : undefined;
      if (dialog.mode === "add") {
        await api.createSession({
          date: dialog.date.toISOString(),
          title: isEasyRun ? `Easy ${formDistance}` : formTitle,
          type: isEasyRun ? "training" : formType,
          targetDistance,
          description,
        });
      } else {
        await api.updateSession(dialog.session.id, {
          title: formTitle,
          type: formType,
          targetDistance,
          description,
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

  const completeGymSession = async () => {
    if (!dialog || dialog.mode !== "complete-gym") return;
    setCompleting(true);
    try {
      await api.updateSession(dialog.session.id, {
        description: formDescription,
        completed: true,
      });
      closeDialog();
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setCompleting(false);
    }
  };

  const formConfig = !dialog
    ? null
    : dialog.mode === "edit"
      ? { showTitle: true, showType: true, showDescription: false, typeOptions: [...ALL_TYPES] }
      : dialog.mode === "add"
        ? ADD_CONFIG[dialog.kind]
        : null;

  if (error) return <p className="text-destructive">{error}</p>;

  // Activities already linked to a session are shown inside that session's
  // card instead of as a separate entry.
  const linkedActivityIds = new Set(sessions.map((s) => s.activityId).filter(Boolean));
  const unmatchedActivities = activities.filter((a) => !linkedActivityIds.has(a.id));

  const today = new Date();

  // The grid covers every Mon-Sun week that touches the anchor month, so the
  // first row may start before the 1st and the last row may run past the
  // last day of the month.
  const lastOfMonth = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0);
  const weeks = [];
  for (let weekStart = mondayOf(monthAnchor); weekStart <= lastOfMonth; ) {
    const days = Array.from({ length: 7 }, (_, d) => new Date(weekStart.getTime() + d * DAY_MS));
    weeks.push({ weekStart, days });
    weekStart = new Date(weekStart.getTime() + 7 * DAY_MS);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {monthAnchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h1>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))
            }
          >
            <ChevronLeft /> Prev
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMonthAnchor(startOfMonth(new Date()))}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))
            }
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
                        className={cn(
                          "group align-top whitespace-normal",
                          sameDay(day, today) && "rounded-md ring-2 ring-inset ring-sky-400",
                        )}
                      >
                        <div className="flex min-h-[104px] flex-col space-y-2">
                          {daySessions.map((s) => (
                            <div
                              key={s.id}
                              className={`group/card relative rounded-md ${sessionBg(s)} p-3`}
                            >
                              <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100">
                                {s.type === "gym" && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    title="Complete gym session"
                                    onClick={() => openCompleteGymDialog(s)}
                                  >
                                    <Check />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => openEditDialog(s)}
                                >
                                  <Pencil />
                                </Button>
                              </div>
                              <div className="flex items-center gap-1.5 pr-14 text-base font-bold">
                                {s.completed && (
                                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                                )}
                                <span className="truncate">{s.title}</span>
                              </div>
                              {!s.activity && s.type !== "rest" && (
                                <div className="mt-1 text-sm text-muted-foreground">
                                  Distance:{" "}
                                  {s.targetDistance != null ? formatKm(s.targetDistance) : "-"}
                                </div>
                              )}
                              {s.activity && (
                                <ActivityStats activity={s.activity} showName={false} />
                              )}
                            </div>
                          ))}
                          {dayUnmatched.map((a) => (
                            <div key={a.id} className={`rounded-md ${ACTIVITY_BG} p-3`}>
                              <ActivityStats activity={a} />
                            </div>
                          ))}
                          <div className="grid flex-1 grid-cols-2 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="border border-dashed border-border text-muted-foreground"
                              onClick={() => openAddDialog(day, "easy-run")}
                            >
                              Easy run
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="border border-dashed border-border text-muted-foreground"
                              onClick={() => openAddDialog(day, "session")}
                            >
                              Session
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="border border-dashed border-border text-muted-foreground"
                              onClick={() => addRestSession(day)}
                            >
                              Rest
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="border border-dashed border-border text-muted-foreground"
                              onClick={() => openAddDialog(day, "gym")}
                            >
                              Gym
                            </Button>
                          </div>
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
          {dialog?.mode === "complete-gym" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Description</Label>
                <RichTextEditor value={formDescription} onChange={setFormDescription} />
              </div>
              <DialogFooter>
                <Button onClick={completeGymSession} disabled={completing}>
                  {completing ? "Completing..." : "Complete"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={submitSession} className="space-y-4">
              {formConfig?.showTitle && (
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
              )}
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
                  autoFocus={!formConfig?.showTitle}
                />
              </div>
              {formConfig?.showType && (
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={formType} onValueChange={(v) => setFormType(v as SessionType)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {formConfig.typeOptions.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t[0].toUpperCase() + t.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {formConfig?.showDescription && (
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <RichTextEditor value={formDescription} onChange={setFormDescription} />
                </div>
              )}
              <DialogFooter className="sm:justify-between">
                {dialog?.mode === "edit" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={deleting}
                    onClick={deleteSession}
                    title="Delete session"
                  >
                    <Trash2 />
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  type="submit"
                  disabled={
                    saving ||
                    (formConfig?.showTitle === false ? !formDistance.trim() : !formTitle.trim())
                  }
                >
                  {saving ? "Saving..." : dialog?.mode === "edit" ? "Save changes" : "Add"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
