"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import AnalysisSection, { Analysis } from "@/components/AnalysisSection";
import { useLang, LangToggle } from "@/components/LanguageProvider";

const RoofScene = dynamic(() => import("@/components/RoofScene"), {
  ssr: false,
});

const API = "http://localhost:8000";

type Proposal = {
  id: string;
  createdAt: string;
  kwp: number;
  analysis: Analysis;
  viewCount: number;
};

export default function ProposalPage() {
  const { id } = useParams<{ id: string }>();
  const { lang, t } = useLang();
  const [p, setP] = useState<Proposal | null>(null);
  const [err, setErr] = useState<"down" | string>("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const viewed = useRef(false);
  const snap = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/api/proposals/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail);
        return r.json();
      })
      .then(setP)
      .catch((e) =>
        setErr(String(e).includes("Failed to fetch") ? "down" : String(e))
      );

    if (!viewed.current) {
      viewed.current = true;
      fetch(`${API}/api/proposals/${id}/view`, { method: "POST" }).catch(
        () => {}
      );
    }
  }, [id]);

  async function downloadPdf() {
    if (!p || pdfBusy) return;
    setPdfBusy(true);
    try {
      const r = await fetch(`${API}/api/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kwp: p.kwp, sceneImage: snap.current }),
      });
      if (!r.ok) throw new Error((await r.json()).detail);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `solar-feasibility-${p.kwp}kWp.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(String(e));
    } finally {
      setPdfBusy(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (err)
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-slate-400 text-center">
          {err === "down" ? t.proposal.backendDown : err}
        </p>
      </main>
    );

  if (!p)
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">{t.proposal.loading}</p>
      </main>
    );

  return (
    <main className="min-h-screen flex justify-center py-8 px-4">
      <div className="w-full max-w-3xl space-y-4">
        <header className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center
                          justify-center text-[#0b1220] text-lg font-bold">
            ☀
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-slate-100">
              {t.proposal.title}
            </h1>
            <p className="text-sm text-slate-400">
              {t.proposal.preparedBy} ·{" "}
              {new Date(p.createdAt).toLocaleDateString(
                lang === "tr" ? "tr-TR" : "en-GB"
              )}{" "}
              · {p.analysis.placement.actualKwp} kWp ·{" "}
              {p.analysis.placement.placedPanels} {t.proposal.panels}
            </p>
          </div>
          <LangToggle />
        </header>

        <div className="bg-[#0f1a2e] border border-slate-800 rounded-xl p-4">
          <RoofScene
            kwp={p.kwp}
            showControls={false}
            showTable={true}
            tableLayout="below"
            onSnapshot={(u) => {
              snap.current = u;
            }}
          />
        </div>

        <AnalysisSection data={p.analysis} />

        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <button onClick={downloadPdf} disabled={pdfBusy}
            className="px-5 py-2 rounded-full bg-amber-400 text-[#0b1220]
                       text-sm font-semibold hover:bg-amber-300
                       disabled:opacity-40 transition">
            {pdfBusy ? t.proposal.preparing : t.proposal.downloadPdf}
          </button>
          <button onClick={copyLink}
            className="px-5 py-2 rounded-full border border-slate-700
                       text-slate-300 text-sm hover:bg-white/5 transition">
            {copied ? t.proposal.copied : t.proposal.copyLink}
          </button>
          <Link href="/"
            className="px-5 py-2 rounded-full border border-slate-700
                       text-slate-300 text-sm hover:bg-white/5 transition">
            {t.proposal.newChat}
          </Link>
        </div>

        <footer className="text-center text-xs text-slate-500 pt-2">
          {t.proposal.proposalId}: {p.id} · {t.proposal.poweredBy}
        </footer>
      </div>
    </main>
  );
}