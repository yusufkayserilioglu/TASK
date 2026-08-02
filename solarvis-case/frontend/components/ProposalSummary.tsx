"use client";

import { useLang } from "./LanguageProvider";
import { Analysis } from "./AnalysisSection";

export default function ProposalSummary({ data }: { data: Analysis | null }) {
  const { lang, t } = useLang();
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

  const facts: [string, string][] = [
    [t.summary.facts.systemSize, `${p.actualKwp} kWp`],
    [t.summary.facts.panelSpec, t.summary.facts.panelSpecV(p.placedPanels)],
    [t.summary.facts.placement, fl],
    [
      t.summary.facts.consumption,
      `${nf(data.inputs.annualConsumptionKwh)} kWh`,
    ],
    [t.summary.facts.production, `${nf(data.annualProductionKwh)} kWh`],
    [t.summary.facts.coverage, `%${Math.round(data.coverageRatio * 100)}`
      .replace(lang === "en" ? "%" : "", lang === "en" ? "" : "%") +
      (lang === "en" ? "%" : "")],
    [t.summary.facts.savings, `€${nf(data.annualSavingsEur)}`],
    [t.summary.facts.payback, t.summary.facts.paybackV(paybackS)],
    [t.summary.facts.net20, `€${nf(data.netBenefit20yEur)}`],
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
    </div>
  );
}