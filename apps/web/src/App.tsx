import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.js";
import Plans from "./pages/Plans.js";
import Sessions from "./pages/Sessions.js";

export default function App() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <nav style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <NavLink to="/">Activities</NavLink>
        <NavLink to="/plans">Plans</NavLink>
        <NavLink to="/sessions">Sessions</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/sessions" element={<Sessions />} />
      </Routes>
    </div>
  );
}
