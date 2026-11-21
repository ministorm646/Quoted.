export const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: pence % 100 === 0 ? 0 : 2 }).format(pence / 100);

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "";

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Every status carries a text label, never colour alone.
export const STATUS: Record<string, { label: string; cls: string }> = {
  waiting: { label: "Waiting for a reply", cls: "badge-warning" },
  following_up: { label: "Follow-up sent", cls: "badge-info" },
  accepted: { label: "Said yes", cls: "badge-success" },
  question: { label: "Has a question", cls: "badge-info badge-outline" },
  declined: { label: "Not interested", cls: "badge-neutral badge-outline" },
  won: { label: "Won", cls: "badge-success" },
  lost: { label: "Lost", cls: "badge-neutral" },
  paused: { label: "Paused", cls: "badge-neutral badge-outline" },
};

export const EVENT_LABEL: Record<string, string> = {
  created: "Quote logged",
  email_sent: "Follow-up email sent",
  email_failed: "A follow-up could not be sent, we will try again",
  dry_run: "Follow-up prepared in test mode (not sent)",
  client_accept: "Client said yes",
  client_question: "Client has a question",
  client_decline: "Client said not interested",
  client_unsub: "Client unsubscribed from emails",
  marked_won: "You marked it as won",
  marked_lost: "You marked it as lost",
  paused: "You paused follow-ups",
  resumed: "You resumed follow-ups",
};

export type QuoteRow = {
  id: string; clientName: string; amountPence: number; description: string; status: string;
  followupsSent: number; nextFollowupAt: string | null; createdAt: string;
};
