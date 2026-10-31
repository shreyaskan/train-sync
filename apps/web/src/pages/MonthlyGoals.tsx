import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

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

  const startEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setEditText(goal.text);
  };

  const saveEdit = async () => {
    const id = editingId;
    const text = editText.trim();
    setEditingId(null);
    if (!id || !text) return;
    try {
      await api.updateGoal(id, { text });
      await load();
    } catch (e) {
      setError(String(e));
    }
  };

  const removeGoal = async (id: string) => {
    try {
      await api.deleteGoal(id);
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
        <p className="text-sm text-muted-foreground">A checklist per month.</p>
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
                        <li key={g.id} className="group/goal flex items-start gap-2 text-sm">
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

                          {editingId === g.id ? (
                            <form
                              className="flex-1"
                              onSubmit={(e) => {
                                e.preventDefault();
                                saveEdit();
                              }}
                            >
                              <Input
                                autoFocus
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onBlur={saveEdit}
                                className="h-6 px-1.5 text-sm"
                              />
                            </form>
                          ) : (
                            <>
                              <span
                                className={cn(
                                  "flex-1",
                                  g.completed && "text-muted-foreground line-through",
                                )}
                              >
                                {g.text}
                              </span>
                              <div className="hidden shrink-0 items-center gap-1 group-hover/goal:flex">
                                <button
                                  type="button"
                                  onClick={() => startEdit(g)}
                                  aria-label="Edit goal"
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeGoal(g.id)}
                                  aria-label="Delete goal"
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </>
                          )}
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
