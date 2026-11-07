"use client";
import { useEffect, useRef, useState } from "react";

type Step = { tool: string; label: string; ok: boolean };
type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; steps: Step[]; text: string; shown: number; done: boolean }
  | { role: "notice"; text: string };

const GREETING = "Hi! Ask me about your order or our policies.";

export default function Chat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [turns]);

  const updateLast = (f: (t: Extract<Turn, { role: "assistant" }>) => Partial<Extract<Turn, { role: "assistant" }>>) =>
    setTurns((ts) => {
      const i = ts.length - 1;
      const t = ts[i];
      if (!t || t.role !== "assistant") return ts;
      return [...ts.slice(0, i), { ...t, ...f(t) }];
    });

  // Reveal the finished answer word by word (D-51: sent whole, shown progressively).
  const reveal = (text: string) => {
    const words = text.split(" ").length;
    updateLast(() => ({ text, shown: 0 }));
    let n = 0;
    const id = setInterval(() => {
      n++;
      updateLast(() => ({ shown: n, done: n >= words }));
      if (n >= words) clearInterval(id);
    }, 35);
  };

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setBusy(true);
    setTurns((ts) => [...ts, { role: "user", text }, { role: "assistant", steps: [], text: "", shown: 0, done: false }]);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        reveal(j.error ?? "Sorry, something went wrong. Please try again.");
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let cut;
        while ((cut = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, cut);
          buf = buf.slice(cut + 2);
          const event = /^event: (.+)$/m.exec(chunk)?.[1];
          const data = /^data: (.+)$/m.exec(chunk)?.[1];
          if (!event || !data) continue;
          const d = JSON.parse(data);
          if (event === "step") updateLast((t) => ({ steps: [...t.steps, d] }));
          if (event === "answer" || event === "error") reveal(d.text);
        }
      }
    } catch {
      reveal("Sorry, the connection dropped. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handoff() {
    if (handedOff) return;
    setHandedOff(true);
    const r = await fetch("/api/handoff", { method: "POST" }).then((r) => r.json()).catch(() => null);
    setTurns((ts) => [...ts, { role: "notice", text: r?.text ?? "Sorry, that didn't go through. Please try again." }]);
    if (!r) setHandedOff(false);
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <span className="chat-title">Support</span>
        <button className="person" onClick={handoff} disabled={handedOff}>
          {handedOff ? "Request sent" : "Talk to a person"}
        </button>
      </div>
      <div className="thread">
        <p className="greeting">{GREETING}</p>
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="q">{t.text}</div>
          ) : t.role === "notice" ? (
            <p key={i} className="notice">{t.text}</p>
          ) : (
            <div key={i} className="a">
              {t.steps.length > 0 && (
                <ul className="steps">
                  {t.steps.map((s, j) => (
                    <li key={j} className={s.ok ? "ok" : "no"}>
                      <span className="dot" aria-hidden>{s.ok ? "✓" : "–"}</span>
                      <code>{s.tool}</code> <span>{s.label}</span>
                    </li>
                  ))}
                </ul>
              )}
              {t.text ? (
                <p className="answer">{t.text.split(" ").slice(0, t.shown).join(" ")}</p>
              ) : (
                <p className="working" aria-live="polite">{t.steps.length ? "Checking…" : "Thinking…"}</p>
              )}
            </div>
          )
        )}
        <div ref={end} />
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} placeholder="Ask about your order or our policies" aria-label="Your message" />
        <button type="submit" disabled={busy || !draft.trim()}>Send</button>
      </form>
    </div>
  );
}
