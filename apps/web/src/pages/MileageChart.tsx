import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api, type Activity, type Session } from "../api.js";
import { Button } from "@/components/ui/button";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const WINDOW_WEEKS = 16;
// Position today's week 9 weeks into the window, so a few months of history
// lead into it with room to look ahead for the rest of the block.
const PAST_WEEKS = 9;

// Validated against the app's dark navy surface (see dataviz skill): both
// pass lightness band / chroma floor / CVD separation / contrast.
const PLANNED_COLOR = "#3b82f6";
const COMPLETED_COLOR = "#16a34a";

const WIDTH = 1120;
const HEIGHT = 400;
const MARGIN = { left: 56, right: 16, top: 16, bottom: 36 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;

function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayIndex = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayIndex);
  return d;
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function formatKm(meters: number) {
  return `${(meters / 1000).toFixed(1)}km`;
}

export default function MileageChart() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const today = new Date();
  const [anchor, setAnchor] = useState(() => mondayOf(new Date(today.getTime() - PAST_WEEKS * WEEK_MS)));

  useEffect(() => {
    Promise.all([api.getSessions(), api.getActivities()])
      .then(([s, a]) => {
        setSessions(s);
        setActivities(a);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="text-destructive">{error}</p>;

  const linkedActivityIds = new Set(sessions.map((s) => s.activityId).filter(Boolean));
  const unmatchedActivities = activities.filter((a) => !linkedActivityIds.has(a.id));

  const weeks = Array.from({ length: WINDOW_WEEKS }, (_, i) => {
    const weekStart = new Date(anchor.getTime() + i * WEEK_MS);
    const weekEnd = new Date(weekStart.getTime() + WEEK_MS);
    const inWeek = (d: Date) => d >= weekStart && d < weekEnd;

    const weekSessions = sessions.filter((s) => inWeek(new Date(s.date)));
    const weekUnmatched = unmatchedActivities.filter((a) => inWeek(new Date(a.startTime)));

    const plannedM = weekSessions.reduce((sum, s) => sum + (s.targetDistance ?? 0), 0);
    const completedM = [
      ...weekSessions.map((s) => s.activity).filter((a): a is Activity => !!a),
      ...weekUnmatched,
    ].reduce((sum, a) => sum + (a.distanceM ?? 0), 0);

    return {
      weekStart,
      plannedKm: plannedM / 1000,
      completedKm: completedM / 1000,
      isFuture: weekStart > today,
    };
  });

  const maxKm = Math.max(10, ...weeks.map((w) => Math.max(w.plannedKm, w.isFuture ? 0 : w.completedKm)));
  const yMax = Math.ceil(maxKm / 10) * 10;

  const x = (i: number) => MARGIN.left + (PLOT_W * i) / (WINDOW_WEEKS - 1);
  const y = (km: number) => MARGIN.top + PLOT_H * (1 - km / yMax);

  const plannedPath = weeks
    .map((w, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(w.plannedKm).toFixed(1)}`)
    .join(" ");

  const completedWeeks = weeks
    .map((w, i) => ({ ...w, i }))
    .filter((w) => !w.isFuture);
  const completedLinePath = completedWeeks
    .map((w, j) => `${j === 0 ? "M" : "L"}${x(w.i).toFixed(1)},${y(w.completedKm).toFixed(1)}`)
    .join(" ");
  const completedAreaPath =
    completedWeeks.length > 0
      ? `${completedLinePath} L${x(completedWeeks[completedWeeks.length - 1].i).toFixed(1)},${y(0).toFixed(1)} L${x(completedWeeks[0].i).toFixed(1)},${y(0).toFixed(1)} Z`
      : "";

  let todayWeekIndex = -1;
  weeks.forEach((w, i) => {
    if (!w.isFuture) todayWeekIndex = i;
  });
  const todayX = todayWeekIndex >= 0 ? x(todayWeekIndex) : null;

  const ticks = [0, yMax / 2, yMax];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Weekly mileage</h1>
          <p className="text-sm text-muted-foreground">
            Planned vs. completed distance, by week commencing
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAnchor(new Date(anchor.getTime() - 4 * WEEK_MS))}
          >
            <ChevronLeft /> Prev
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAnchor(mondayOf(new Date(today.getTime() - PAST_WEEKS * WEEK_MS)))}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAnchor(new Date(anchor.getTime() + 4 * WEEK_MS))}
          >
            Next <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="flex gap-5 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <svg width="18" height="10" aria-hidden="true">
            <line x1="0" y1="5" x2="18" y2="5" stroke={PLANNED_COLOR} strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          Planned
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="18" height="10" aria-hidden="true">
            <rect width="18" height="10" rx="2" fill={COMPLETED_COLOR} opacity="0.35" />
            <line x1="0" y1="2" x2="18" y2="2" stroke={COMPLETED_COLOR} strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          Completed
        </div>
        {todayX != null && (
          <div className="flex items-center gap-1.5">
            <svg width="18" height="10" aria-hidden="true">
              <line x1="9" y1="0" x2="9" y2="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3,3" />
            </svg>
            Today
          </div>
        )}
      </div>

      <div className="rounded-lg bg-card p-4">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block w-full"
          role="img"
          aria-label={`Weekly mileage over ${WINDOW_WEEKS} weeks: planned as a line, completed as an area`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={MARGIN.left}
                y1={y(t)}
                x2={WIDTH - MARGIN.right}
                y2={y(t)}
                stroke="var(--border)"
                strokeWidth="1"
              />
              <text x={MARGIN.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">
                {t === yMax ? `${t}km` : t}
              </text>
            </g>
          ))}

          {todayX != null && (
            <line
              x1={todayX}
              y1={MARGIN.top}
              x2={todayX}
              y2={HEIGHT - MARGIN.bottom}
              stroke="var(--muted-foreground)"
              strokeWidth="1.5"
              strokeDasharray="3,3"
            />
          )}

          {completedAreaPath && <path d={completedAreaPath} fill={COMPLETED_COLOR} opacity="0.1" />}
          {completedLinePath && (
            <path
              d={completedLinePath}
              fill="none"
              stroke={COMPLETED_COLOR}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          <path
            d={plannedPath}
            fill="none"
            stroke={PLANNED_COLOR}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {weeks.map((w, i) => (
            <circle key={`hit-${i}`} cx={x(i)} cy={y(w.plannedKm)} r="10" fill="transparent">
              <title>
                Week of {w.weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} — Planned{" "}
                {w.plannedKm.toFixed(1)}km
                {!w.isFuture && ` · Completed ${w.completedKm.toFixed(1)}km`}
              </title>
            </circle>
          ))}

          <g fontSize="10" fill="var(--muted-foreground)" textAnchor="middle">
            {weeks.map((w, i) => (
              <text key={i} x={x(i)} y={HEIGHT - 8}>
                {w.weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </text>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
