import { Component, type ReactNode } from "react";

// If a page crashes, show a calm message instead of a blank screen.
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error("Page crashed", error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-(--card) border-2 border-(--line) rounded-xl p-6 max-w-md shadow-[5px_5px_0_var(--shadow)]" role="alert">
          <h1 className="font-display font-extrabold text-2xl">Something went wrong</h1>
          <p className="mt-3">Sorry about that. Reloading the page usually fixes it. Your quotes are safe.</p>
          <button className="btn btn-primary mt-5" onClick={() => window.location.reload()}>Reload the page</button>
        </div>
      </div>
    );
  }
}
