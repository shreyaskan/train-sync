import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { api, type Session } from "../api.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Sessions</h1>
      <form onSubmit={createSession} className="flex flex-wrap items-center gap-2">
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
          title="Set a specific time if you have multiple sessions of the same type on the same day (e.g. warm up / main set / cool down) — sync matches each synced activity to the closest planned time."
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
      <ul className="divide-y divide-border rounded-lg border border-border">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="w-40 shrink-0 text-muted-foreground">
              {new Date(s.date).toLocaleString()}
            </span>
            <Badge variant="secondary">{s.type}</Badge>
            <span className="flex-1 truncate">{s.title}</span>
            {s.completed && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
          </li>
        ))}
      </ul>
    </div>
  );
}
