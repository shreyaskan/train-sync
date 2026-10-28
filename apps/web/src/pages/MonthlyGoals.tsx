import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "cn";
import { api, type Goal } from "../api.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Six consecutive calendar quarters, starting with the current one.
const NUM_QUARTERS = 6;

function quarterRows(today: Date) {
  let year = today.getFullYear();
  let month0 = Math.floor(today.getMonth() / 3) * 3; // 0-indexed Jan=0

  const rows: { year: number; months: number[] }[] = [];
  for (let q = 0; q < NUM_QUARTERS; q++) {
    rows.push({ year, months: [month0 + 1, month0 + 2, month0 + 3] });
    month0 += 3;
    if (month0 >= 12) {
      month0 -= 12;
      year += 1;
    }
  }
  return rows;
}

export default function MonthlyGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [newText, setNewText] = useState("");

  const load = () => api.getGoals().then(setGoals).catch((e) => setError(String(e)));

  useEffect(() => {
    load();
  }, []);

  const toggleGoal = async (goal: Goal) => {
    try {
      await api.updateGoal(goal.id, { completed: !goal.completed });
      await load();
    } catch (e) {
      setError(String(e));
    }
  };

  const openAdd = (year: number, month: number) => {
    setAddingKey(`${year}-${month}`);
    setNewText("");
  };

  const submitAdd = async (year: number, month: number) => {
    const text = newText.trim();
    setAddingKey(null);
    if (!text) return;
    try {
      await api.createGoal({ year, month, text });
      await load();
    } catch (e) {
      setError(String(e));
    }
  };

  if (error) return <p className="text-destructive">{error}</p>;

  const today = new Date();
  const rows = quarterRows(today);
  let lastYearShown: number | null = null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Goals</h1>
        <p className="text-sm text-muted-foreground">
          A checklist per month — same calendar shape as the rest of the app, by quarter instead of by week.
        </p>
      </div>

      {rows.map((row) => {
        const showYear = row.year !== lastYearShown;
        lastYearShown = row.year;
        return (
          <div key={`${row.year}-${row.months[0]}`} className="space-y-2.5">
            {showYear && (
              <span className="text-xs font-bold tracking-wide text-muted-foreground">{row.year}</span>
            )}
            <div className="grid grid-cols-3 gap-4">
              {row.months.map((month) => {
                const key = `${row.year}-${month}`;
                const isCurrent = row.year === today.getFullYear() && month === today.getMonth() + 1;
                const monthGoals = goals
                  .filter((g) => g.year === row.year && g.month === month)
                  .sort((a, b) => a.order - b.order);

                return (
                  <div
                    key={key}
                    className={cn(
                      "flex flex-col gap-2.5 rounded-lg bg-card p-4",
                      isCurrent && "ring-2 ring-inset ring-sky-400",
                    )}
                  >
                    <h2 className="text-sm font-bold">{MONTH_NAMES[month - 1]}</h2>
                    <ul className="flex flex-col gap-2">
                      {monthGoals.map((g) => (
                        <li key={g.id} className="flex items-start gap-2 text-sm">
                          <button
                            type="button"
                            onClick={() => toggleGoal(g)}
                            className="mt-0.5 shrink-0"
                            aria-label={g.completed ? "Mark not done" : "Mark done"}
                          >
                            {g.completed ? (
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#16a34a"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <circle cx="12" cy="12" r="9" />
                                <path d="m8.5 12.5 2.5 2.5 5-5" />
                              </svg>
                            ) : (
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-muted-foreground"
                              >
                                <circle cx="12" cy="12" r="9" />
                              </svg>
                            )}
                          </button>
                          <span className={cn(g.completed && "text-muted-foreground line-through")}>
                            {g.text}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {addingKey === key ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          submitAdd(row.year, month);
                        }}
                      >
                        <Input
                          autoFocus
                          value={newText}
                          onChange={(e) => setNewText(e.target.value)}
                          onBlur={() => submitAdd(row.year, month)}
                          placeholder="New goal"
                          className="h-7 text-sm"
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openAdd(row.year, month)}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="size-3.5" /> Add goal
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
