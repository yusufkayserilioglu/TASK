"use client";

import { useState } from "react";
import { useLang } from "./LanguageProvider";
import { Analysis } from "./AnalysisSection";

export default function ProposalSummary({ data }: { data: Analysis | null }) {
  const { lang, t } = useLang();
  const [year, setYear] = useState(10);
  if (!data) return null;

  const locale = lang === "tr" ? "tr-TR" : "en-US";
  const nf = (v: number) =>
    v.toLocaleString(locale, { maximumFractionDigits: 0 });
  const p = data.placement;
  const fl = p.perFacet
    .filter((f) => f.kwp > 0)
    .map((f) => `${f.compass}: ${Math.round(f.kwp / 0.4)}`)
    .join(", ");
  const paybackS = data.paybackYears
    ? (lang === "tr"
        ? String(data.paybackYears).replace(".", ",")
        : String(data.paybackYears))
    : "—";
  const limited = p.actualKwp !== p.requestedKwp;

  // --- Yıl kaydırıcısı verileri (cashflow'dan türetilir, backend'e gitmez)
  const cf = data.cashflow[Math.min(year, data.cashflow.length - 1)];
  const cumSavings = cf.cumulative + data.inputs.capex; // CAPEX geri eklenir
  const net = cf.cumulative;
  const produced = data.annualProductionKwh * year;
  const covered = data.coveredKwh * year;
  const paidOff = data.paybackYears !== null && year >= data.paybackYears;

  const facts: [string, string][] = [
    [t.summary.facts.systemSize, `${p.actualKwp} kWp`],
    [t.summary.facts.panelSpec, t.summary.facts.panelSpecV(p.placedPanels)],
    [t.summary.facts.placement, fl],
    [
      t.summary.facts.consumption,
      `${nf(data.inputs.annualConsumptionKwh)} kWh`,
    ],
    [t.summary.facts.production, `${nf(data.annualProductionKwh)} kWh`],
    [
      t.summary.facts.coverage,
      lang === "tr"
        ? `%${Math.round(data.coverageRatio * 100)}`
        : `${Math.round(data.coverageRatio * 100)}%`,
    ],
    [t.summary.facts.savings, `€${nf(data.annualSavingsEur)}`],
    [t.summary.facts.payback, t.summary.facts.paybackV(paybackS)],
    [t.summary.facts.net20, `€${nf(data.netBenefit20yEur)}`],
  ];

  const sliderStats: { k: string; v: string; cls?: string }[] = [
    { k: t.summary.slider.cumSavings, v: `€${nf(cumSavings)}` },
    {
      k: t.summary.slider.netPosition,
      v: `${net < 0 ? "−" : "+"}€${nf(Math.abs(net))}`,
      cls: net < 0 ? "text-red-400" : "text-emerald-400",
    },
    { k: t.summary.slider.producedSoFar, v: `${nf(produced)} kWh` },
    { k: t.summary.slider.coveredSoFar, v: `${nf(covered)} kWh` },
  ];

  return (
    <div className="w-full bg-[#0f1a2e] border border-slate-800 rounded-xl
                    p-4 space-y-3">
      <h3 className="font-semibold text-slate-100 flex items-center gap-2">
        <span className="text-amber-300">☀</span>
        {t.summary.title}
      </h3>

      <p className="text-sm leading-relaxed text-slate-300">
        {t.summary.prose({
          kwp: p.actualKwp,
          n: p.placedPanels,
          fl,
          prod: nf(data.annualProductionKwh),
          cov: Math.round(data.coverageRatio * 100),
          sav: nf(data.annualSavingsEur),
          pay: paybackS,
          net: nf(data.netBenefit20yEur),
        })}
      </p>

      {limited && (
        <p className="text-sm text-amber-400">
          {t.summary.capacityNote(p.placedPanels, p.actualKwp)}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 pt-1">
        {facts.map(([k, v]) => (
          <div key={k}
            className="flex justify-between gap-3 text-sm border-b
                       border-slate-800/60 py-1">
            <span className="text-slate-400">{k}</span>
            <span className="font-mono text-slate-100 text-right">{v}</span>
          </div>
        ))}
      </div>

      {/* ---------------- YIL KAYDIRICISI ---------------- */}
      <div className="pt-3 space-y-3 border-t border-slate-800/60">
        <div className="flex items-baseline justify-between">
          <h4 className="text-sm font-semibold text-slate-200">
            {t.summary.slider.title}
          </h4>
          <div className="flex items-center gap-2">
            {paidOff && (
              <span className="text-xs px-2 py-0.5 rounded-full
                               bg-emerald-500/15 text-emerald-400
                               border border-emerald-500/40">
                {t.summary.slider.paidOff}
              </span>
            )}
            <span className="text-sm text-slate-400">
              {t.summary.slider.year}{" "}
              <span className="font-mono text-amber-300 text-lg font-bold">
                {year}
              </span>
              <span className="text-slate-500"> / 20</span>
            </span>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={20}
          step={1}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="sv-year-slider w-full"
          aria-label={t.summary.slider.title}
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          {sliderStats.map((s) => (
            <div key={s.k}
              className="bg-[#0b1526] border border-slate-800 rounded-lg
                         p-2">
              <div className="text-xs text-slate-400">{s.k}</div>
              <div className={`font-mono font-semibold text-sm ${
                s.cls ?? "text-slate-100"
              }`}>
                {s.v}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500">{t.summary.slider.hint}</p>
      </div>
    </div>
  );
}