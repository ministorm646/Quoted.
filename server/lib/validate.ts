import { cleanEmail, cleanText, parsePounds } from "./util.js";

export type QuoteInput = { clientName: string; clientEmail: string; amountPence: number; description: string };

export function parseQuote(b: Record<string, any>): { ok: true; value: QuoteInput } | { ok: false; error: string } {
  const clientName = cleanText(b.clientName, 80);
  const clientEmail = cleanEmail(b.clientEmail);
  const amountPence = parsePounds(b.amount);
  const description = cleanText(b.description, 140);
  if (!clientName) return { ok: false, error: "Enter the client's name." };
  if (!clientEmail) return { ok: false, error: "Enter a valid client email." };
  if (amountPence === null) return { ok: false, error: "Enter the quote amount in pounds, for example 450 or 1250.50." };
  if (!description) return { ok: false, error: "Add a one-line description of the job." };
  return { ok: true, value: { clientName, clientEmail, amountPence, description } };
}
