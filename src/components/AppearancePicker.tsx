import { useState } from "react";
import { api } from "../api";
import Icon from "./Icon";
import { PALETTES, getAppearance, setAppearance, type AccentId, type Appearance, type Mode } from "../theme";

const MODES: [Mode, string][] = [["light", "Light"], ["dark", "Dark"], ["system", "Match my device"]];

export default function AppearancePicker() {
  const [a, setA] = useState<Appearance>(getAppearance());
  const [saved, setSaved] = useState(false);

  async function choose(next: Appearance) {
    setA(next); setAppearance(next); setSaved(false); // changes straight away on this device
    const r = await api("/api/prefs", { method: "PUT", body: next }); // and is remembered for your account
    setSaved(r.ok);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="font-medium" id="mode-label">Light or dark</p>
        <div role="radiogroup" aria-labelledby="mode-label" className="mt-2 grid grid-cols-3 gap-2">
          {MODES.map(([m, l]) => (
            <button key={m} type="button" role="radio" aria-checked={a.mode === m} onClick={() => choose({ ...a, mode: m })}
              className={`btn btn-sm h-auto min-h-11 py-2 ${a.mode === m ? "btn-primary" : "btn-outline"}`}>{l}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="font-medium" id="accent-label">Colour</p>
        <div role="radiogroup" aria-labelledby="accent-label" className="mt-2 grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {(Object.keys(PALETTES) as AccentId[]).map((id) => {
            const on = a.accent === id;
            return (
              <button key={id} type="button" role="radio" aria-checked={on} aria-label={PALETTES[id].name} onClick={() => choose({ ...a, accent: id })}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 ${on ? "border-(--line) bg-(--paper)" : "border-transparent"}`}>
                <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-(--line) text-white" style={{ background: PALETTES[id].light }}>{on && <Icon name="check" size={18} />}</span>
                <span className="text-xs font-medium">{PALETTES[id].name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-sm" role="status">{saved ? "Saved to your account." : "Changes show straight away."}</p>
    </div>
  );
}
