import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft } from "lucide-react";
import { api, type Plan, type Session } from "../api.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  if (error) return <p className="text-destructive">{error}</p>;
  if (!plan) return <p className="text-muted-foreground">Loading...</p>;

  const ref = startOfWeekRef(plan);
  const weeks = groupByWeek(plan.sessions, ref);

  return (
    <div className="space-y-4">
      <Link
        to="/plans"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Plans
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{plan.name}</h1>
        {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
      </div>

      {weeks.length === 0 && <p className="text-sm text-muted-foreground">No sessions yet.</p>}
      <div className="space-y-4">
        {weeks.map(({ weekIndex, start, sessions }) => {
          const end = new Date(start.getTime() + WEEK_MS - DAY_MS);
          return (
            <Card key={weekIndex} className="p-4">
              <h3 className="mb-2 text-sm font-semibold">
                Week {weekIndex + 1}{" "}
                <span className="font-normal text-muted-foreground">
                  ({start.toLocaleDateString()} – {end.toLocaleDateString()})
                </span>
              </h3>
              <ul className="divide-y divide-border">
                {sessions.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-1.5 text-sm">
                    <span className="w-28 shrink-0 text-muted-foreground">
                      {new Date(s.date).toLocaleString(undefined, {
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <Badge variant="secondary">{s.type}</Badge>
                    <span className="flex-1 truncate">{s.title}</span>
                    {s.completed && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
                    {s.activity && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {((s.activity.distanceM ?? 0) / 1000).toFixed(1)} km,{" "}
                        {Math.round(s.activity.durationSec / 60)} min
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Add session</h3>
        <form onSubmit={addSession} className="flex flex-wrap items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="max-w-[200px]"
          />
          <Input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="max-w-[220px]"
          />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="run">Run</SelectItem>
              <SelectItem value="bike">Bike</SelectItem>
              <SelectItem value="swim">Swim</SelectItem>
              <SelectItem value="strength">Strength</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit">Add session</Button>
        </form>
      </Card>
    </div>
  );
}
