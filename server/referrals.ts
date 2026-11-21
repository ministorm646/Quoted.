import type { Db } from "./db.js";
import { newId } from "./lib/crypto.js";

export const REFERRAL_CAP = 3;

// Called when a business logs its very first quote. If it came from a referral link,
// both businesses get one extra free month, up to REFERRAL_CAP referrals per referrer.
// Safe to call twice: a business can only be credited once, and the cap is checked in the same step.
export async function creditReferral(db: Db, referredBusinessId: string): Promise<boolean> {
  const b = await db.prepare("SELECT referred_by FROM businesses WHERE id = ?").bind(referredBusinessId).first<{ referred_by: string | null }>();
  if (!b?.referred_by) return false;
  const [ins] = await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO referrals (id, referrer_business_id, referred_business_id, credited_at)
       SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM referrals WHERE referrer_business_id = ?) < ?`,
    ).bind(newId(), b.referred_by, referredBusinessId, new Date().toISOString(), b.referred_by, REFERRAL_CAP),
    db.prepare(
      `UPDATE businesses SET free_until = date(max(free_until, date('now')), '+1 month')
       WHERE id IN (?, ?) AND changes() > 0`,
    ).bind(b.referred_by, referredBusinessId),
  ]);
  return ins.meta.changes === 1;
}
