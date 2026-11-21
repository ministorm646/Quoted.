import { useEffect, useState } from "react";

const COLOURS = ["#ffd84d", "#0e7a55", "#10231c", "#7fd6b0"];

// A short burst when a quote is won. Disappears on its own; skipped for reduced motion.
export default function Celebrate({ onDone }: { onDone: () => void }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setShow(false); onDone(); }, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <span key={i} className="confetti" style={{
          left: `${(i * 37) % 100}%`, background: COLOURS[i % COLOURS.length],
          animationDelay: `${(i % 7) * 60}ms`, ["--dx" as any]: `${((i * 53) % 120) - 60}px`,
        }} />
      ))}
    </div>
  );
}
