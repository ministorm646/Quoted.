export default function Logo({ name = "QuoteMe", size = 30 }: { name?: string; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <rect width="64" height="64" rx="14" fill="#0E7A55" />
        <rect x="14" y="38" width="30" height="10" rx="3" fill="#FFD84D" />
        <circle cx="31" cy="29" r="14" fill="none" stroke="#fff" strokeWidth="6" />
        <path d="M39 38l10 10" stroke="#10231C" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <span className="font-display font-extrabold text-xl">{name}</span>
    </span>
  );
}
