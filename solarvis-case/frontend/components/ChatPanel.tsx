"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import AnalysisSection, { Analysis } from "./AnalysisSection";

const RoofScene = dynamic(() => import("./RoofScene"), { ssr: false });

const API = "http://localhost:8000";

type Msg =
  | { role: "user"; type: "text"; text: string }
  | { role: "assistant"; type: "text"; text: string }
  | { role: "assistant"; type: "options";
      options: { label: string; value: string }[] }
  | { role: "assistant"; type: "scene"; kwp: number }
  | { role: "assistant"; type: "analysis"; data: Analysis }
  | { role: "assistant"; type: "actions"; kwp: number;
      proposalId?: string; proposalUrl?: string };

export default function ChatPanel() {
  const [cid, setCid] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const snaps = useRef<Record<string, string>>({});

  useEffect(() => {
    fetch(`${API}/api/chat/start`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        setCid(d.conversationId);
        setMsgs(d.messages);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  async function send(text: string) {
    if (!text.trim() || busy || !cid) return;
    setErr("");
    setMsgs((m) => [...m, { role: "user", type: "text", text }]);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: cid, message: text }),
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

  async function downloadPdf(kwp: number) {
    if (pdfBusy) return;
    setPdfBusy(true);
    setErr("");
    try {
      const r = await fetch(`${API}/api/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kwp,
          sceneImage: snaps.current[String(kwp)] ?? null,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).detail);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `solar-feasibility-${kwp}kWp.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(String(e));
    } finally {
      setPdfBusy(false);
    }
  }

  const lastOptionsIdx = msgs.reduce(
    (acc, m, i) => (m.type === "options" ? i : acc), -1
  );

  return (
    <div className="w-full max-w-4xl flex flex-col h-[calc(100vh-3rem)]">
      <header className="pb-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center
                        justify-center text-[#0b1220] text-lg font-bold
                        shadow-lg shadow-amber-500/20">
          ☀
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-100 leading-tight">
            solarVis AI
          </h1>
          <p className="text-xs text-slate-400">
            AI-powered solar proposal assistant
          </p>
        </div>
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
          if (m.type === "scene") {
            return (
              <div key={i}
                className="bg-[#0f1a2e] border border-slate-800 rounded-xl p-4">
                <RoofScene
                  kwp={m.kwp}
                  showControls={false}
                  showTable={true}
                  tableLayout="below"
                  onSnapshot={(url) => {
                    snaps.current[String(m.kwp)] = url;
                  }}
                />
              </div>
            );
          }
          if (m.type === "analysis") {
            return <AnalysisSection key={i} data={m.data} />;
          }
          if (m.type === "actions") {
            return (
              <div key={i} className="flex flex-wrap gap-2 pl-1">
                <button onClick={() => downloadPdf(m.kwp)} disabled={pdfBusy}
                  className="px-4 py-1.5 rounded-full text-sm border
                             border-amber-400/70 text-amber-300
                             hover:bg-amber-400/10 disabled:opacity-40
                             transition">
                  {pdfBusy ? "Preparing PDF…" : "Download PDF report"}
                </button>
                {m.proposalUrl && (
                  <>
                    <a href={m.proposalUrl} target="_blank" rel="noreferrer"
                      className="px-4 py-1.5 rounded-full text-sm bg-amber-400
                                 text-[#0b1220] font-medium hover:bg-amber-300
                                 transition">
                      Open shareable proposal
                    </a>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(m.proposalUrl!)}
                      className="px-4 py-1.5 rounded-full text-sm border
                                 border-slate-700 text-slate-300
                                 hover:bg-white/5 transition">
                      Copy link
                    </button>
                  </>
                )}
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
          placeholder="Type your message…"
          className="flex-1 rounded-full bg-[#0f1a2e] border border-slate-700
                     px-4 py-2 text-sm text-slate-100 placeholder-slate-500
                     focus:outline-none focus:border-amber-400 transition"
        />
        <button onClick={() => send(input)} disabled={busy}
          className="px-5 py-2 rounded-full bg-amber-400 text-[#0b1220]
                     text-sm font-semibold hover:bg-amber-300
                     disabled:opacity-40 transition">
          Send
        </button>
      </div>
    </div>
  );
}