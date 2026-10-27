import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Plan } from "../api.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [name, setName] = useState("");

  const load = () => api.getPlans().then(setPlans);

  useEffect(() => {
    load();
  }, []);

  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.createPlan({ name });
    setName("");
    await load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Plans</h1>
      <form onSubmit={createPlan} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Plan name (e.g. Marathon block)"
          className="max-w-sm"
        />
        <Button type="submit">Create plan</Button>
      </form>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {plans.map((p) => (
          <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <Link to={`/plans/${p.id}`} className="font-medium text-primary hover:underline">
              {p.name}
            </Link>
            <span className="text-muted-foreground">{p.sessions.length} session(s)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
