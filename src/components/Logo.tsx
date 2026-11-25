// "Quoted." The full stop is part of the name, so it is always drawn in the accent colour.
export default function Logo({ name = "Quoted", size = 30, mark = true }: { name?: string; size?: number; mark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {mark && (
        <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <rect width="64" height="64" rx="15" style={{ fill: "var(--accent)" }} />
          <circle cx="29" cy="29" r="14" fill="none" strokeWidth="7" style={{ stroke: "var(--accent-content)" }} />
          <circle cx="47" cy="47" r="5" style={{ fill: "var(--accent-content)" }} />
        </svg>
      )}
      <span className="font-display font-extrabold text-xl tracking-tight">{name}<span aria-hidden="true" className="ml-0.5 inline-block rounded-full border-2 border-(--ink) bg-(--accent)" style={{ width: "0.32em", height: "0.32em" }} /><span className="sr-only">.</span></span>
    </span>
  );
}
