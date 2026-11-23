import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { initAppearance } from "./theme";
initAppearance();
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import Verify from "./pages/Verify";
import Dashboard from "./pages/Dashboard";
import AddQuote from "./pages/AddQuote";
import QuoteDetail from "./pages/QuoteDetail";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import Refer from "./pages/Refer";
import AdminStats from "./pages/AdminStats";
import SetPassword from "./pages/SetPassword";
import Billing from "./pages/Billing";
import Signup from "./pages/Signup";
import AdminLaunch from "./pages/AdminLaunch";
import Respond from "./pages/Respond";
import Unsubscribe from "./pages/Unsubscribe";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/app" element={<Dashboard />} />
        <Route path="/app/new" element={<AddQuote />} />
        <Route path="/app/quotes/:id" element={<QuoteDetail />} />
        <Route path="/app/refer" element={<Refer />} />
        <Route path="/app/password" element={<SetPassword />} />
        <Route path="/app/billing" element={<Billing />} />
        <Route path="/app/settings" element={<Settings />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/stats" element={<AdminStats />} />
        <Route path="/admin/launch" element={<AdminLaunch />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/r/:token/:action" element={<Respond />} />
        <Route path="/u/:token" element={<Unsubscribe />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
