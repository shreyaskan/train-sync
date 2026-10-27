import { useEffect, useState } from "react";
import { api, type Plan } from "../api.js";

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
    <div>
      <h1>Plans</h1>
      <form onSubmit={createPlan}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Plan name (e.g. Marathon block)"
        />
        <button type="submit">Create plan</button>
      </form>
      <ul>
        {plans.map((p) => (
          <li key={p.id}>
            {p.name} — {p.sessions.length} session(s)
          </li>
        ))}
      </ul>
    </div>
  );
}
