"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import AnalysisSection, { Analysis } from "@/components/AnalysisSection";

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
  const [p, setP] = useState<Proposal | null>(null);
  const [err, setErr] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
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
        setErr(
          String(e).includes("Failed to fetch")
            ? "Cannot reach the backend — make sure uvicorn is running on port 8000."
            : String(e)
        )
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

  if (err)
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-slate-400 text-center">{err}</p>
      </main>
    );

  if (!p)
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading proposal…</p>
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
          <div>
            <h1 className="text-xl font-semibold text-slate-100">
              Solar Proposal
            </h1>
            <p className="text-sm text-slate-400">
              Prepared by solarVis AI ·{" "}
              {new Date(p.createdAt).toLocaleDateString("en-GB")} ·{" "}
              {p.analysis.placement.actualKwp} kWp ·{" "}
              {p.analysis.placement.placedPanels} panels
            </p>
          </div>
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

        <div className="flex justify-center">
          <button onClick={downloadPdf} disabled={pdfBusy}
            className="px-5 py-2 rounded-full bg-amber-400 text-[#0b1220]
                       text-sm font-semibold hover:bg-amber-300
                       disabled:opacity-40 transition">
            {pdfBusy ? "Preparing PDF…" : "Download PDF report"}
          </button>
        </div>

        <footer className="text-center text-xs text-slate-500 pt-2">
          Proposal ID: {p.id} · Powered by solarVis AI
        </footer>
      </div>
    </main>
  );
}