import { Route, Routes } from "react-router-dom";
import Calendar from "./pages/Calendar.js";

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-[1800px] px-6 py-3">
          <span className="text-sm font-semibold text-foreground">train-sync</span>
        </div>
      </header>
      <main className="mx-auto max-w-[1800px] px-6 py-6">
        <Routes>
          <Route path="/" element={<Calendar />} />
        </Routes>
      </main>
    </div>
  );
}
