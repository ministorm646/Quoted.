import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";

// scrypt (memory-hard) with settings from the OWASP password storage guidance (N=2^14, r=8, p=5).
// Only the salted hash is stored, never the password.
const N = 16384, R = 8, P = 5, KEYLEN = 32;

const derive = (pw: string, salt: Buffer, n: number, r: number, p: number) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(pw.normalize("NFKC"), salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? reject(e) : resolve(k))));

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(pw, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

// With no stored hash (unknown email) it still does the same work against a throwaway hash,
// so a wrong email and a wrong password take the same time and look the same.
let dummy: Promise<string> | null = null;
export async function verifyPassword(pw: string, stored: string | null): Promise<boolean> {
  const hash = stored ?? (await (dummy ??= hashPassword(randomBytes(12).toString("hex"))));
  const [scheme, n, r, p, salt, key] = hash.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = await derive(pw, Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p));
  return stored !== null && actual.length === expected.length && timingSafeEqual(actual, expected);
}

const COMMON = new Set([
  "password12", "password123", "password1234", "passw0rd123", "1234567890", "12345678910", "123456789012", "qwertyuiop", "qwerty12345",
  "letmein1234", "iloveyou123", "admin12345", "welcome123", "welcome1234", "changeme123", "1q2w3e4r5t", "abc1234567", "football123",
  "monkey12345", "dragon12345", "baseball123", "trustno1234", "sunshine123", "princess123", "superman123", "000000000000",
]);

// Returns a message to show the person, or null if the password is acceptable.
export function checkPassword(pw: string, email: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (pw.length > 128) return "Use 128 characters or fewer.";
  const lower = pw.toLowerCase();
  if (/^(.)\1+$/.test(pw) || new Set(pw).size < 5) return "Use a mix of different characters.";
  if (COMMON.has(lower) || lower.includes("quoteme") || /^(password|qwerty|letmein)/.test(lower)) return "That password is too easy to guess.";
  const local = email.split("@")[0].toLowerCase();
  if (local.length >= 4 && lower.includes(local)) return "Don't use your email address inside your password.";
  return null;
}
