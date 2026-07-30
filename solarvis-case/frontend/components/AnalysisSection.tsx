"use client";

import {
  ResponsiveContainer, ComposedChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";

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

const eur = (v: number) =>
  v.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " €";

export default function AnalysisSection({ data }: { data: Analysis | null }) {
  if (!data) return null;

  const stats = [
    { k: "Yıllık üretim", v: `${data.annualProductionKwh.toLocaleString("tr-TR")} kWh` },
    { k: "Tüketim karşılama", v: `%${Math.round(data.coverageRatio * 100)}` },
    { k: "Yıllık tasarruf", v: eur(data.annualSavingsEur) },
    { k: "Geri ödeme", v: data.paybackYears ? `${data.paybackYears} yıl` : "—" },
    { k: "20 yıl net kazanç", v: eur(data.netBenefit20yEur) },
  ];

  return (
    <div className="w-[640px] bg-white rounded-lg shadow p-4 space-y-3">
      <h3 className="font-semibold">
        Finansal Analiz — {data.placement.actualKwp} kWp
        {data.placement.actualKwp !== data.placement.requestedKwp &&
          ` (istenen ${data.placement.requestedKwp} kWp, çatı kapasitesi kadarı kuruldu)`}
      </h3>

      <div className="grid grid-cols-5 gap-2 text-center">
        {stats.map((s) => (
          <div key={s.k} className="bg-gray-50 rounded p-2">
            <div className="text-xs text-gray-500">{s.k}</div>
            <div className="font-semibold text-sm">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.cashflow}
            margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => eur(Number(v))}
              labelFormatter={(y) => `Yıl ${y}`} />
            <ReferenceLine y={0} stroke="#64748b" />
            {data.paybackYears && (
              <ReferenceLine x={Math.ceil(data.paybackYears)} stroke="#f59e0b"
                label={{ value: `Geri ödeme ~${data.paybackYears} yıl`,
                    fill: "#b45309", fontSize: 12, position: "insideTopLeft" }} />
            )}
            <Area type="monotone" dataKey="cumulative"
              name="Kümülatif nakit akışı"
              stroke="#0ea5e9" fill="rgba(14,165,233,0.15)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-gray-400">
        Basitleştirilmiş model: sabit fiyat 0,25 €/kWh · degradasyon yok ·
        tasarruf yıllık tüketimle ({data.inputs.annualConsumptionKwh.toLocaleString("tr-TR")} kWh)
        sınırlı · CAPEX 10.000 (USD≈EUR 1:1)
      </p>
    </div>
  );
}