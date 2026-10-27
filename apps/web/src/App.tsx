import { NavLink, Route, Routes } from "react-router-dom";
import { cn } from "cn";
import Calendar from "./pages/Calendar.js";
import Sessions from "./pages/Sessions.js";

const navLinks = [
  { to: "/", label: "Calendar", end: true },
  { to: "/sessions", label: "Sessions" },
];

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-[1800px] items-center gap-1 px-6 py-3">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1800px] px-6 py-6">
        <Routes>
          <Route path="/" element={<Calendar />} />
          <Route path="/sessions" element={<Sessions />} />
        </Routes>
      </main>
    </div>
  );
}
