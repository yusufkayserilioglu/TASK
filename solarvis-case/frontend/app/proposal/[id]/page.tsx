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
      .catch((e) => setErr(String(e)));

    // Görüntülenme kaydı + satışçıya bildirim (bonus). Ref, React StrictMode'un
    // dev'de effect'i iki kez çalıştırmasına karşı tek POST garantisi verir.
    if (!viewed.current) {
      viewed.current = true;
      fetch(`${API}/api/proposals/${id}/view`, { method: "POST" }).catch((e) =>
        setErr(
          String(e).includes("Failed to fetch")
            ? "Cannot reach the backend — make sure uvicorn is running on port 8000."
            : String(e)
        )
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
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">{err}</p>
      </main>
    );

  if (!p)
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Loading proposal…</p>
      </main>
    );

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center py-8 px-4">
      <div className="w-full max-w-3xl space-y-4">
        <header>
          <h1 className="text-2xl font-semibold">Solar Proposal</h1>
          <p className="text-sm text-gray-500">
            Prepared by solarVis AI ·{" "}
            {new Date(p.createdAt).toLocaleDateString("en-GB")} ·{" "}
            {p.analysis.placement.actualKwp} kWp ·{" "}
            {p.analysis.placement.placedPanels} panels
          </p>
        </header>

        <div className="bg-white rounded-lg shadow p-4">
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
            className="px-5 py-2 rounded-full bg-amber-500 text-white text-sm
                       font-medium disabled:opacity-50">
            {pdfBusy ? "Preparing PDF…" : "Download PDF report"}
          </button>
        </div>

        <footer className="text-center text-xs text-gray-400 pt-2">
          Proposal ID: {p.id} · Powered by solarVis AI
        </footer>
      </div>
    </main>
  );
}