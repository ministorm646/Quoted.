import { STATUS } from "../lib";

export default function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: "badge-neutral" };
  return <span className={`badge ${s.cls} font-medium whitespace-nowrap`}>{s.label}</span>;
}
