"use client";

import {
  ResponsiveContainer, ComposedChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import { useLang } from "./LanguageProvider";

export type Analysis = {
  inputs: {
    monthlyConsumptionKwh: number; annualConsumptionKwh: number;
    unitPriceEur: number; capex: number; horizonYears: number;
  };
  annualProductionKwh: number;
  coveredKwh: number;
  coverageRatio: number;
  annualSavingsEur: number;
  paybackYears: number | null;
  netBenefit20yEur: number;
  cashflow: { year: number; annualSavings: number; cumulative: number }[];
  placement: {
    requestedKwp: number; actualKwp: number;
    placedPanels: number; requestedPanels: number;
    warning: string | null;
    perFacet: {
      facetId: string; compass: string; kwp: number;
      estAnnualKwh: number | null; specificYield: number | null;
    }[];
  };
};

export default function AnalysisSection({ data }: { data: Analysis | null }) {
  const { lang, t } = useLang();
  if (!data) return null;

  const locale = lang === "tr" ? "tr-TR" : "en-US";
  const eur = (v: number) =>
    "€" + v.toLocaleString(locale, { maximumFractionDigits: 0 });

  const stats = [
    {
      k: t.analysis.annualProduction,
      v: `${data.annualProductionKwh.toLocaleString(locale)} kWh`,
    },
    { k: t.analysis.coverage, v: `${Math.round(data.coverageRatio * 100)}%` },
    { k: t.analysis.annualSavings, v: eur(data.annualSavingsEur) },
    {
      k: t.analysis.payback,
      v: data.paybackYears
        ? `${data.paybackYears} ${t.analysis.yrs}`
        : "—",
      accent: true,
    },
    { k: t.analysis.net20, v: eur(data.netBenefit20yEur) },
  ];

  return (
    <div className="w-full max-w-2xl bg-[#0f1a2e] border border-slate-800
                    rounded-xl p-4 space-y-3">
      <h3 className="font-semibold text-slate-100">
        {t.analysis.title} — {data.placement.actualKwp} kWp
        {data.placement.actualKwp !== data.placement.requestedKwp && (
          <span className="text-slate-400 font-normal text-sm">
            {t.analysis.sized(data.placement.requestedKwp)}
          </span>
        )}
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
        {stats.map((s) => (
          <div key={s.k} className="bg-[#0b1526] border border-slate-800
                                    rounded-lg p-2">
            <div className="text-xs text-slate-400">{s.k}</div>
            <div className={`font-semibold text-sm ${
              s.accent ? "text-amber-300" : "text-slate-100"
            }`}>
              {s.v}
            </div>
          </div>
        ))}
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.cashflow}
            margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c2942" />
            <XAxis dataKey="year" tick={{ fill: "#7d8db0", fontSize: 12 }}
              stroke="#24344f" />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              tick={{ fill: "#7d8db0", fontSize: 12 }} stroke="#24344f" />
            <Tooltip
              formatter={(v) => eur(Number(v))}
              labelFormatter={(y) => `${t.analysis.year} ${y}`}
              contentStyle={{
                background: "#0d1830", border: "1px solid #24344f",
                borderRadius: 8, fontSize: 12,
              }}
              labelStyle={{ color: "#9fb0cd" }}
              itemStyle={{ color: "#fbbf24" }}
            />
            <ReferenceLine y={0} stroke="#3b4a6b" />
            {data.paybackYears && (
              <ReferenceLine x={Math.ceil(data.paybackYears)} stroke="#38bdf8"
                label={{ value: t.analysis.paybackLine(data.paybackYears),
                         fill: "#7dd3fc", fontSize: 12,
                         position: "insideTopLeft" }} />
            )}
            <Area type="monotone" dataKey="cumulative"
              name={t.analysis.series}
              stroke="#fbbf24" strokeWidth={2}
              fill="rgba(251,191,36,0.12)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-slate-500">
        {t.analysis.footnote(
          data.inputs.annualConsumptionKwh.toLocaleString(locale)
        )}
      </p>
    </div>
  );
}