// Appearance: a light or dark mode plus an accent colour. Saved on this device straight away,
// and on the account (see Settings) so it follows the person to other devices.
export type Mode = "light" | "dark" | "system";
type Palette = { name: string; light: string; hl: string; dark: string; darkContent: string; hlDark: string };

export const PALETTES = {
  forest: { name: "Forest", light: "#0E7A55", hl: "#FFD84D", dark: "#34D399", darkContent: "#052E1F", hlDark: "rgba(255,216,77,0.32)" },
  ocean: { name: "Ocean", light: "#0E7490", hl: "#FFE08A", dark: "#22D3EE", darkContent: "#04323B", hlDark: "rgba(255,224,138,0.30)" },
  sunset: { name: "Sunset", light: "#C2410C", hl: "#FDE68A", dark: "#FB923C", darkContent: "#3B1503", hlDark: "rgba(253,230,138,0.30)" },
  berry: { name: "Berry", light: "#BE185D", hl: "#FDE68A", dark: "#F472B6", darkContent: "#3D0A22", hlDark: "rgba(253,230,138,0.30)" },
  violet: { name: "Violet", light: "#6D28D9", hl: "#FDE68A", dark: "#A78BFA", darkContent: "#1E0F4A", hlDark: "rgba(253,230,138,0.30)" },
  graphite: { name: "Graphite", light: "#334155", hl: "#FDE68A", dark: "#CBD5E1", darkContent: "#0F172A", hlDark: "rgba(253,230,138,0.30)" },
} satisfies Record<string, Palette>;
export type AccentId = keyof typeof PALETTES;
export type Appearance = { mode: Mode; accent: AccentId };

const KEY = "qm-appearance";
export const DEFAULT_APPEARANCE: Appearance = { mode: "system", accent: "forest" };
const valid = (a: any): a is Appearance => !!a && ["light", "dark", "system"].includes(a.mode) && a.accent in PALETTES;

export function loadLocal(): Appearance {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (valid(v)) return v; } catch { /* use default */ }
  return DEFAULT_APPEARANCE;
}
const saveLocal = (a: Appearance) => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* private mode */ } };
const prefersDark = () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;

let current: Appearance = DEFAULT_APPEARANCE;
export const getAppearance = () => current;

export function applyAppearance(a: Appearance) {
  current = a;
  const dark = a.mode === "dark" || (a.mode === "system" && prefersDark());
  const p = PALETTES[a.accent];
  const root = document.documentElement;
  const accent = dark ? p.dark : p.light;
  const content = dark ? p.darkContent : "#ffffff";
  root.dataset.theme = dark ? "nudge-dark" : "nudge";
  const set = (k: string, v: string) => root.style.setProperty(k, v);
  set("--accent", accent); set("--accent-content", content); set("--highlight", dark ? p.hlDark : p.hl);
  set("--color-primary", accent); set("--color-primary-content", content);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0d1612" : accent);
}

export function setAppearance(a: Appearance) { applyAppearance(a); saveLocal(a); }
export function asAppearance(v: unknown): Appearance | null { return valid(v) ? v : null; }

// Call once before the first screen is drawn.
export function initAppearance() {
  applyAppearance(loadLocal());
  if (typeof matchMedia === "function") matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (current.mode === "system") applyAppearance(current); });
}
