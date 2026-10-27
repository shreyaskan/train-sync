import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { api, type Session } from "../api.js";
import { Button } from "@/components/ui/button";
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

export default function Calendar() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState(() => mondayOf(new Date()));

  useEffect(() => {
    api.getSessions().then(setSessions).catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="text-destructive">{error}</p>;

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

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20"></TableHead>
              {DAY_LABELS.map((label) => (
                <TableHead key={label} className="min-w-[130px]">
                  {label}
                </TableHead>
              ))}
              <TableHead className="min-w-[160px]">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
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
                <TableRow key={weekStart.toISOString()} className="align-top">
                  <TableCell className="whitespace-nowrap align-top text-xs text-muted-foreground">
                    {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </TableCell>
                  {days.map((day) => {
                    const daySessions = weekSessions.filter((s) =>
                      sameDay(day, new Date(s.date)),
                    );
                    return (
                      <TableCell key={day.toISOString()} className="align-top whitespace-normal">
                        <div className="space-y-1.5">
                          {daySessions.map((s) => (
                            <div key={s.id} className="rounded-md bg-accent/60 p-1.5">
                              <div className="flex items-center gap-1 text-xs font-medium">
                                {s.completed && (
                                  <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
                                )}
                                <span>{s.title}</span>
                              </div>
                              <div className="mt-1 flex items-center gap-1">
                                <Badge variant="secondary" className="text-[10px]">
                                  {s.type}
                                </Badge>
                                {s.plan && (
                                  <span className="truncate text-[10px] text-muted-foreground">
                                    {s.plan.name}
                                  </span>
                                )}
                              </div>
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

      <Link to="/plans" className="text-sm text-primary hover:underline">
        View plans
      </Link>
    </div>
  );
}
