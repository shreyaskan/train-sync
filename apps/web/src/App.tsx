import { NavLink, Route, Routes } from "react-router-dom";
import Calendar from "./pages/Calendar.js";
import Dashboard from "./pages/Dashboard.js";
import Plans from "./pages/Plans.js";
import PlanDetail from "./pages/PlanDetail.js";
import Sessions from "./pages/Sessions.js";

export default function App() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <nav style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <NavLink to="/">Calendar</NavLink>
        <NavLink to="/activities">Activities</NavLink>
        <NavLink to="/plans">Plans</NavLink>
        <NavLink to="/sessions">Sessions</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<Calendar />} />
        <Route path="/activities" element={<Dashboard />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/plans/:id" element={<PlanDetail />} />
        <Route path="/sessions" element={<Sessions />} />
      </Routes>
    </div>
  );
}
