import { Link } from "react-router-dom";
import Shell from "../components/Shell";
import { usePageTitle } from "../api";

export default function NotFound() {
  usePageTitle("Page not found");
  return (
    <Shell>
      <div className="max-w-md py-8">
        <p className="font-display font-extrabold text-6xl"><span className="hl">404</span></p>
        <h1 className="text-2xl font-extrabold mt-4">We can't find that page</h1>
        <p className="mt-3">The link may be old or mistyped.</p>
        <div className="mt-5 flex gap-2"><Link to="/" className="btn btn-primary">Go to the home page</Link><Link to="/app" className="btn btn-outline">Your quotes</Link></div>
      </div>
    </Shell>
  );
}
