import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import Verify from "./pages/Verify";
import Dashboard from "./pages/Dashboard";
import AddQuote from "./pages/AddQuote";
import QuoteDetail from "./pages/QuoteDetail";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/app" element={<Dashboard />} />
        <Route path="/app/new" element={<AddQuote />} />
        <Route path="/app/quotes/:id" element={<QuoteDetail />} />
        <Route path="/app/settings" element={<Settings />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
