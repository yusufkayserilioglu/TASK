"""Basitleştirilmiş finansal analiz (case metodolojisi).

Kural: YILLIK üretimin YILLIK tüketimi karşılayan kısmı tasarruf sayılır.
Sadeleştirmeler (case'in izin verdiği): sabit elektrik fiyatı, degradasyon yok.
Para birimi: CAPEX $ / tasarruf € tutarsızlığı 1:1 kabul edildi (README'de notlu).
"""

MONTHLY_KWH = 1150.0
PRICE_EUR = 0.25
CAPEX = 10_000.0
YEARS = 20


def analyze(annual_production_kwh: float):
    annual_consumption = MONTHLY_KWH * 12          # 13.800 kWh
    covered = min(annual_production_kwh, annual_consumption)
    annual_savings = covered * PRICE_EUR
    payback = CAPEX / annual_savings if annual_savings > 0 else None

    cashflow = [
        {
            "year": y,
            "annualSavings": round(annual_savings, 2) if y > 0 else 0.0,
            "cumulative": round(-CAPEX + annual_savings * y, 2),
        }
        for y in range(YEARS + 1)                  # yıl 0 = -CAPEX
    ]

    return {
        "inputs": {
            "monthlyConsumptionKwh": MONTHLY_KWH,
            "annualConsumptionKwh": annual_consumption,
            "unitPriceEur": PRICE_EUR,
            "capex": CAPEX,
            "horizonYears": YEARS,
        },
        "annualProductionKwh": round(annual_production_kwh),
        "coveredKwh": round(covered),
        "coverageRatio": round(covered / annual_consumption, 3),
        "annualSavingsEur": round(annual_savings, 2),
        "paybackYears": round(payback, 1) if payback else None,
        "netBenefit20yEur": round(-CAPEX + annual_savings * YEARS, 2),
        "cashflow": cashflow,
    }