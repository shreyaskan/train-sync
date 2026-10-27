import { useEffect, useState } from "react";
import { api, type Session } from "../api.js";

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("run");

  const load = () => api.getSessions().then(setSessions);

  useEffect(() => {
    load();
  }, []);

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    await api.createSession({ title, date, type });
    setTitle("");
    setDate("");
    await load();
  };

  return (
    <div>
      <h1>Sessions</h1>
      <form onSubmit={createSession}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          title="Set a specific time if you have multiple sessions of the same type on the same day (e.g. warm up / main set / cool down) — sync matches each synced activity to the closest planned time."
        />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="run">Run</option>
          <option value="bike">Bike</option>
          <option value="swim">Swim</option>
          <option value="strength">Strength</option>
        </select>
        <button type="submit">Add session</button>
      </form>
      <ul>
        {sessions.map((s) => (
          <li key={s.id}>
            {new Date(s.date).toLocaleString()} — {s.type} — {s.title}{" "}
            {s.completed ? "✅" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
