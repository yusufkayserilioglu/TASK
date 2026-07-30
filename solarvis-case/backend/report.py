"""PDF fizibilite raporu (fpdf2).

Neden fpdf2: WeasyPrint Windows'ta GTK sistem bağımlılığı ister; fpdf2 saf
Python, evaluator makinesinde sıfır kurulum riski. Kümülatif grafik bile ek
bağımlılıksız, fpdf çizim komutlarıyla üretilir.
Not: core fontlar latin-1 -> "€" glifi yok, metinde "EUR" kullanıldı.
"""
import math
from datetime import date
from io import BytesIO

from fpdf import FPDF

NAVY = (22, 40, 63)
AMBER = (202, 138, 4)
GRAY = (100, 116, 139)
SKY = (14, 165, 233)
GRID = (226, 232, 240)


class Report(FPDF):
    def header(self):
        self.set_font("helvetica", "B", 16)
        self.set_text_color(*NAVY)
        self.cell(0, 10, "Solar Feasibility Report",
                  new_x="LMARGIN", new_y="NEXT")
        self.set_font("helvetica", "", 9)
        self.set_text_color(*GRAY)
        self.cell(0, 5,
                  f"solarVis AI - automated proposal - {date.today().isoformat()}",
                  new_x="LMARGIN", new_y="NEXT")
        self.ln(3)

    def section(self, title):
        self.set_font("helvetica", "B", 12)
        self.set_text_color(*AMBER)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(0, 0, 0)

    def kv(self, k, v):
        self.set_font("helvetica", "", 10)
        self.cell(70, 6, k)
        self.set_font("helvetica", "B", 10)
        self.cell(0, 6, str(v), new_x="LMARGIN", new_y="NEXT")


def _chart(pdf, cashflow, payback, x, y, w, h):
    """Kümülatif nakit akışı: grid + yıl noktaları + başabaş + anotasyonlar."""
    vals = [c["cumulative"] for c in cashflow]
    vmin, vmax = min(vals), max(vals)
    span = (vmax - vmin) or 1
    pad = span * 0.07
    lo, hi = vmin - pad, vmax + pad
    n = len(vals) - 1

    def px(year):
        return x + w * year / n

    def py(v):
        return y + h * (1 - (v - lo) / (hi - lo))

    # Çerçeve
    pdf.set_draw_color(203, 213, 225)
    pdf.rect(x, y, w, h)

    # Yatay grid + y etiketleri
    step = 10_000 if span > 25_000 else 5_000
    t = math.ceil(lo / step) * step
    pdf.set_font("helvetica", "", 7)
    pdf.set_text_color(*GRAY)
    while t <= hi:
        yy = py(t)
        if abs(t) > 1e-9:
            pdf.set_draw_color(*GRID)
            pdf.set_dash_pattern(dash=0.8, gap=1.2)
            pdf.line(x, yy, x + w, yy)
            pdf.set_dash_pattern()
        pdf.text(x - 11, yy + 1, f"{int(t / 1000)}k" if t else "0")
        t += step

    # Dikey grid (5 yılda bir) + yıl etiketleri
    for yr in range(0, n + 1, 5):
        xx = px(yr)
        pdf.set_draw_color(*GRID)
        pdf.set_dash_pattern(dash=0.8, gap=1.2)
        pdf.line(xx, y, xx, y + h)
        pdf.set_dash_pattern()
        pdf.text(xx - 1.2, y + h + 4, str(yr))

    # Başabaş (sıfır) çizgisi
    pdf.set_draw_color(148, 163, 184)
    pdf.line(x, py(0), x + w, py(0))
    pdf.set_font("helvetica", "I", 7)
    pdf.text(x + w - 17, py(0) - 1.5, "break-even")

    # Geri ödeme dikeyi + etiket
    if payback:
        pdf.set_draw_color(*AMBER)
        pdf.set_line_width(0.45)
        pdf.line(px(payback), y, px(payback), y + h)
        pdf.set_line_width(0.2)
        pdf.set_text_color(*AMBER)
        pdf.set_font("helvetica", "B", 8)
        pdf.text(px(payback) + 1.5, y + 4, f"Payback ~ {payback} yrs")

    # Eğri
    pdf.set_draw_color(*SKY)
    pdf.set_line_width(0.6)
    for i in range(1, len(vals)):
        pdf.line(px(i - 1), py(vals[i - 1]), px(i), py(vals[i]))
    pdf.set_line_width(0.2)

    # Yıllık nokta işaretçileri
    pdf.set_fill_color(*SKY)
    for i, v in enumerate(vals):
        r = 0.7
        pdf.ellipse(px(i) - r, py(v) - r, 2 * r, 2 * r, style="F")

    # Başabaş kesişim noktası (amber)
    if payback:
        pdf.set_fill_color(*AMBER)
        r = 1.3
        pdf.ellipse(px(payback) - r, py(0) - r, 2 * r, 2 * r, style="F")

    # Uç değer anotasyonları
    pdf.set_font("helvetica", "B", 8)
    pdf.set_text_color(*SKY)
    pdf.text(px(n) - 26, py(vals[-1]) - 2, f"EUR {int(vals[-1]):,}")
    pdf.set_font("helvetica", "", 7)
    pdf.set_text_color(*GRAY)
    pdf.text(px(0) + 1.5, py(vals[0]) - 2, f"CAPEX {int(vals[0]):,}")

    # Eksen başlığı
    pdf.set_font("helvetica", "I", 7)
    pdf.text(x + w / 2 - 4, y + h + 8, "Years")
    pdf.set_text_color(0, 0, 0)


def build_pdf(a: dict, scene_png: bytes | None) -> bytes:
    p = a["placement"]
    pdf = Report()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.section("1. Inputs")
    pdf.kv("Location", "-34.04658, 18.46491 (fixed demo site, Cape Town)")
    pdf.kv("Monthly consumption", "1,150 kWh (13,800 kWh/year)")
    pdf.kv("Unit electricity price", "EUR 0.25 / kWh")
    pdf.kv("Requested system size", f'{p["requestedKwp"]} kWp')
    pdf.kv("Installed system",
           f'{p["actualKwp"]} kWp - {p["placedPanels"]} x 400 Wp panels')
    if p["warning"]:
        pdf.set_font("helvetica", "I", 9)
        pdf.set_text_color(*AMBER)
        pdf.multi_cell(0, 5, "Note: roof capacity limits the system to "
                             f'{p["placedPanels"]} panels.')
        pdf.set_text_color(0, 0, 0)
    pdf.ln(2)

    pdf.section("2. Panel Layout")
    if scene_png:
        pdf.image(BytesIO(scene_png), x=45, w=120)
    else:
        pdf.set_font("helvetica", "I", 9)
        pdf.cell(0, 6, "(layout image unavailable)",
                 new_x="LMARGIN", new_y="NEXT")

    pdf.add_page()
    pdf.section("3. Energy Production (PVGIS, 25 deg tilt)")
    headers = ["Facet", "Azimuth", "Panels", "kWp", "kWh/kWp/yr", "kWh/yr"]
    widths = [22, 26, 22, 22, 34, 34]
    pdf.set_font("helvetica", "B", 9)
    for hdr, wd in zip(headers, widths):
        pdf.cell(wd, 7, hdr, border=1)
    pdf.ln()
    pdf.set_font("helvetica", "", 9)
    for f in p["perFacet"]:
        if f["placed"] == 0:
            continue
        row = [f["compass"], f'{f["azimuthDeg"]}', str(f["placed"]),
               f'{f["kwp"]}', f'{f["specificYield"]}',
               f'{int(f["estAnnualKwh"]):,}']
        for val, wd in zip(row, widths):
            pdf.cell(wd, 7, val, border=1)
        pdf.ln()
    pdf.set_font("helvetica", "B", 10)
    pdf.ln(1)
    pdf.cell(0, 8,
             f'Total annual production: {a["annualProductionKwh"]:,} kWh '
             f'({round(a["coverageRatio"] * 100)}% of consumption)',
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    pdf.section("4. Financial Analysis (20 years)")
    pdf.kv("Annual savings", f'EUR {a["annualSavingsEur"]:,.0f}')
    pdf.kv("CAPEX", f'USD {a["inputs"]["capex"]:,.0f} (1:1 EUR assumed)')
    pdf.kv("Payback period", f'{a["paybackYears"]} years')
    pdf.kv("20-year net benefit", f'EUR {a["netBenefit20yEur"]:,.0f}')
    pdf.ln(3)
    pdf.set_font("helvetica", "I", 8)
    pdf.set_text_color(*GRAY)
    pdf.cell(0, 5, "Cumulative cash flow (EUR)",
             new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(1)
    y0 = pdf.get_y()
    _chart(pdf, a["cashflow"], a["paybackYears"], x=25, y=y0, w=160, h=65)
    pdf.set_y(y0 + 65 + 13)
    pdf.set_font("helvetica", "I", 8)
    pdf.set_text_color(*GRAY)
    pdf.multi_cell(0, 4,
                   "Simplified model per case methodology: flat tariff "
                   "EUR 0.25/kWh, no degradation, savings capped at annual "
                   "consumption.")
    return bytes(pdf.output())