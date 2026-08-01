"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang, LangToggle } from "./LanguageProvider";
import { Lang } from "@/lib/i18n";

const API = "http://localhost:8000";

type Msg =
  | { role: "user"; type: "text"; text: string }
  | { role: "assistant"; type: "text"; text: string }
  | { role: "assistant"; type: "options";
      options: { label: string; value: string }[] }
  | { role: "assistant"; type: "proposal"; redirect?: boolean;
      proposalId: string; proposalUrl: string; kwp: number; panels: number;
      paybackYears: number | null };

export default function ChatPanel() {
  const router = useRouter();
  const { lang, t } = useLang();
  const [cid, setCid] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const redirected = useRef<Set<string>>(new Set());
  const hasUser = useRef(false);

  async function startChat(l: Lang) {
    try {
      const r = await fetch(`${API}/api/chat/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: l }),
      });
      const d = await r.json();
      setCid(d.conversationId);
      setMsgs(d.messages);
    } catch (e) {
      setErr(String(e));
    }
  }

  // İlk açılışta ve (kullanıcı henüz yazmadıysa) dil değişince selamlamayı
  // seçilen dilde yeniden başlat.
  useEffect(() => {
    if (hasUser.current) return;
    startChat(lang);
  }, [lang]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  useEffect(() => {
    const prop = msgs.find(
      (m): m is Extract<Msg, { type: "proposal" }> =>
        m.type === "proposal" && !!m.redirect &&
        !redirected.current.has(m.proposalId)
    );
    if (!prop) return;
    redirected.current.add(prop.proposalId);
    const timer = setTimeout(
      () => router.push(`/proposal/${prop.proposalId}`), 1200
    );
    return () => clearTimeout(timer);
  }, [msgs, router]);

  async function send(text: string) {
    if (!text.trim() || busy || !cid) return;
    hasUser.current = true;
    setErr("");
    setMsgs((m) => [...m, { role: "user", type: "text", text }]);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: cid, message: text, lang }),
      });
      if (!r.ok) throw new Error((await r.json()).detail);
      const d = await r.json();
      setMsgs((m) => [...m, ...d.messages]);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  const lastOptionsIdx = msgs.reduce(
    (acc, m, i) => (m.type === "options" ? i : acc), -1
  );

  return (
    <div className="w-full max-w-3xl flex flex-col h-[calc(100vh-3rem)]">
      <header className="pb-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center
                        justify-center text-[#0b1220] text-lg font-bold
                        shadow-lg shadow-amber-500/20">
          ☀
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-slate-100 leading-tight">
            solarVis AI
          </h1>
          <p className="text-xs text-slate-400">{t.chat.subtitle}</p>
        </div>
        <LangToggle />
      </header>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {msgs.map((m, i) => {
          if (m.type === "text") {
            const user = m.role === "user";
            return (
              <div key={i}
                className={`flex ${user ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm
                  leading-relaxed whitespace-pre-wrap ${
                    user
                      ? "bg-amber-400 text-[#0b1220] font-medium rounded-br-sm"
                      : "bg-[#111d33] text-slate-100 border border-slate-800 rounded-bl-sm"
                  }`}>
                  {m.text}
                </div>
              </div>
            );
          }
          if (m.type === "options") {
            const active = i === lastOptionsIdx && !busy;
            return (
              <div key={i} className="flex gap-2 pl-1">
                {m.options.map((o) => (
                  <button key={o.value}
                    disabled={!active}
                    onClick={() => send(o.value)}
                    className={`px-4 py-1.5 rounded-full text-sm border
                      transition ${
                      active
                        ? "border-amber-400/70 text-amber-300 hover:bg-amber-400/10"
                        : "border-slate-800 text-slate-600"
                    }`}>
                    {o.label}
                  </button>
                ))}
              </div>
            );
          }
          if (m.type === "proposal") {
            return (
              <div key={i}
                className="max-w-[85%] rounded-xl border border-amber-400/60
                           bg-gradient-to-br from-[#132038] to-[#0f1a2e]
                           p-4 space-y-3 shadow-lg shadow-amber-500/5">
                <div className="flex items-center gap-2">
                  <span className="text-amber-300 text-lg">☀</span>
                  <span className="font-semibold text-slate-100">
                    {t.chat.proposalReady}
                  </span>
                </div>
                <div className="flex gap-4 text-sm text-slate-300">
                  <span>
                    <span className="font-mono text-amber-300">{m.kwp}</span>{" "}
                    kWp
                  </span>
                  <span>
                    <span className="font-mono text-amber-300">
                      {m.panels}
                    </span>{" "}
                    {t.chat.panels}
                  </span>
                  {m.paybackYears && (
                    <span>
                      {t.chat.payback}{" "}
                      <span className="font-mono text-amber-300">
                        ~{m.paybackYears} {t.chat.yrs}
                      </span>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => router.push(`/proposal/${m.proposalId}`)}
                    className="px-4 py-1.5 rounded-full text-sm bg-amber-400
                               text-[#0b1220] font-semibold hover:bg-amber-300
                               transition">
                    {t.chat.viewProposal}
                  </button>
                  <span className="flex items-center gap-1.5 text-xs
                                   text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400
                                     animate-pulse" />
                    {t.chat.openingAuto}
                  </span>
                </div>
              </div>
            );
          }
          return null;
        })}
        {busy && (
          <div className="flex items-center gap-1.5 pl-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400
                             animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400
                             animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400
                             animate-bounce [animation-delay:300ms]" />
          </div>
        )}
        {err && <p className="text-sm text-red-400">{err}</p>}
        <div ref={endRef} />
      </div>

      <div className="pt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder={t.chat.placeholder}
          className="flex-1 rounded-full bg-[#0f1a2e] border border-slate-700
                     px-4 py-2 text-sm text-slate-100 placeholder-slate-500
                     focus:outline-none focus:border-amber-400 transition"
        />
        <button onClick={() => send(input)} disabled={busy}
          className="px-5 py-2 rounded-full bg-amber-400 text-[#0b1220]
                     text-sm font-semibold hover:bg-amber-300
                     disabled:opacity-40 transition">
          {t.chat.send}
        </button>
      </div>
    </div>
  );
}