export default function Logo({ name = "QuoteMe", size = 30 }: { name?: string; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <rect width="64" height="64" rx="14" style={{ fill: "var(--accent)" }} />
        <rect x="14" y="38" width="30" height="10" rx="3" style={{ fill: "var(--highlight)" }} />
        <circle cx="31" cy="29" r="14" fill="none" strokeWidth="6" style={{ stroke: "var(--accent-content)" }} />
        <path d="M39 38l10 10" strokeWidth="6" strokeLinecap="round" style={{ stroke: "var(--accent-content)" }} />
      </svg>
      <span className="font-display font-extrabold text-xl">{name}</span>
    </span>
  );
}
