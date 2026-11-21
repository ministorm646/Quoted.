import { useEffect, useRef } from "react";

declare global { interface Window { turnstile?: any } }

let loader: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(s);
  });
  return loader;
}

// Bump resetKey after each submit to get a fresh challenge.
export default function Turnstile(props: { siteKey: string; onToken: (t: string) => void; resetKey?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const cb = useRef(props.onToken);
  cb.current = props.onToken;

  useEffect(() => {
    let gone = false;
    loadScript().then(() => {
      if (gone || !box.current || !window.turnstile) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: props.siteKey,
        callback: (t: string) => cb.current(t),
        "expired-callback": () => cb.current(""),
        "error-callback": () => cb.current(""),
      });
    }).catch(() => cb.current(""));
    return () => { gone = true; if (widget.current && window.turnstile) window.turnstile.remove(widget.current); };
  }, [props.siteKey]);

  useEffect(() => {
    if (props.resetKey && widget.current && window.turnstile) { cb.current(""); window.turnstile.reset(widget.current); }
  }, [props.resetKey]);

  return <div ref={box} className="min-h-[65px]" />;
}
