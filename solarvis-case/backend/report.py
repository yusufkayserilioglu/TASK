"""PDF fizibilite raporu (fpdf2).

Neden fpdf2: WeasyPrint Windows'ta GTK sistem bağımlılığı ister; fpdf2 saf
Python, evaluator makinesinde sıfır kurulum riski. Kümülatif grafik bile ek
bağımlılıksız, fpdf çizim komutlarıyla üretilir.
Not: core fontlar latin-1 -> "€" glifi yok, metinde "EUR" kullanıldı.
"""
from datetime import date
from io import BytesIO

from fpdf import FPDF

NAVY = (22, 40, 63)
AMBER = (202, 138, 4)
GRAY = (100, 116, 139)
SKY = (14, 165, 233)


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
    vals = [c["cumulative"] for c in cashflow]
    vmin, vmax = min(vals), max(vals)
    span = (vmax - vmin) or 1

    def px(year):
        return x + w * year / (len(vals) - 1)

    def py(v):
        return y + h * (1 - (v - vmin) / span)

    pdf.set_draw_color(203, 213, 225)
    pdf.rect(x, y, w, h)
    pdf.set_draw_color(148, 163, 184)
    pdf.line(x, py(0), x + w, py(0))          # sıfır çizgisi
    if payback:
        pdf.set_draw_color(*AMBER)
        pdf.line(px(payback), y, px(payback), y + h)
    pdf.set_draw_color(*SKY)
    pdf.set_line_width(0.5)
    for i in range(1, len(vals)):
        pdf.line(px(i - 1), py(vals[i - 1]), px(i), py(vals[i]))
    pdf.set_line_width(0.2)
    pdf.set_font("helvetica", "", 7)
    pdf.set_text_color(*GRAY)
    for yr in (0, 5, 10, 15, 20):
        pdf.text(px(yr) - 1, y + h + 4, str(yr))
    pdf.text(x - 12, py(0) + 1, "0")
    pdf.text(x - 12, py(vmax) + 2, f"{int(vmax / 1000)}k")
    pdf.text(x - 12, py(vmin), f"{int(vmin / 1000)}k")
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
             f'({int(a["coverageRatio"] * 100)}% of consumption)',
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    pdf.section("4. Financial Analysis (20 years)")
    pdf.kv("Annual savings", f'EUR {a["annualSavingsEur"]:,.0f}')
    pdf.kv("CAPEX", f'USD {a["inputs"]["capex"]:,.0f} (1:1 EUR assumed)')
    pdf.kv("Payback period", f'{a["paybackYears"]} years')
    pdf.kv("20-year net benefit", f'EUR {a["netBenefit20yEur"]:,.0f}')
    pdf.ln(4)
    _chart(pdf, a["cashflow"], a["paybackYears"],
           x=25, y=pdf.get_y(), w=160, h=60)
    pdf.set_y(pdf.get_y() + 70)
    pdf.set_font("helvetica", "I", 8)
    pdf.set_text_color(*GRAY)
    pdf.multi_cell(0, 4,
                   "Simplified model per case methodology: flat tariff "
                   "EUR 0.25/kWh, no degradation, savings capped at annual "
                   "consumption.")
    return bytes(pdf.output())