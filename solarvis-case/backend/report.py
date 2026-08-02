"""PDF fizibilite raporu (fpdf2), EN/TR.

Türkçe glifler için DejaVu Sans repo'dan gömülür (backend/fonts/).
Fontlar yoksa: helvetica + transliterasyon fallback'i (rapor asla bozulmaz).
"""
import math
from datetime import date
from io import BytesIO
from pathlib import Path

from fpdf import FPDF

FONT_DIR = Path(__file__).parent / "fonts"
TR_MAP = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")

NAVY = (22, 40, 63)
AMBER = (202, 138, 4)
GRAY = (100, 116, 139)
SKY = (14, 165, 233)
GRID = (226, 232, 240)

L = {
    "en": {
        "title": "Solar Feasibility Report",
        "sub": "solarVis AI - automated proposal - {d}",
        "s1": "1. Inputs",
        "loc": "Location",
        "loc_v": "-34.04658, 18.46491 (fixed demo site, Cape Town)",
        "cons": "Monthly consumption",
        "cons_v": "1,150 kWh (13,800 kWh/year)",
        "price": "Unit electricity price",
        "price_v": "EUR 0.25 / kWh",
        "req": "Requested system size",
        "inst": "Installed system",
        "inst_v": "{kwp} kWp - {n} x 400 Wp panels",
        "cap": "Note: roof capacity limits the system to {n} panels.",
        "s2": "2. Panel Layout",
        "no_img": "(layout image unavailable)",
        "s3": "3. Energy Production (PVGIS, 25 deg tilt)",
        "th": ["Facet", "Azimuth", "Panels", "kWp", "kWh/kWp/yr", "kWh/yr"],
        "total": "Total annual production: {p} kWh (coverage: {c}%)",
        "s4": "4. Financial Analysis (20 years)",
        "sav": "Annual savings",
        "capex": "CAPEX",
        "capex_v": "USD 10,000 (1:1 EUR assumed)",
        "pay": "Payback period",
        "pay_v": "{p} years",
        "net": "20-year net benefit",
        "chart": "Cumulative cash flow (EUR)",
        "breakeven": "break-even",
        "pay_line": "Payback ~ {p} yrs",
        "years": "Years",
        "foot": "Simplified model per case methodology: flat tariff "
                "EUR 0.25/kWh, no degradation, savings capped at annual "
                "consumption.",
        "sum_t": "2. Executive Summary",
        "sum_b": "Based on your inputs - a monthly consumption of 1,150 kWh "
                 "(13,800 kWh/year) at EUR 0.25/kWh - a {kwp} kWp solar "
                 "system was designed using {n} x 400 Wp panels (1 m x 2 m "
                 "each), placed automatically on the best-oriented roof "
                 "facets ({fl}). PVGIS simulations estimate an annual "
                 "production of about {prod} kWh, covering roughly {cov}% "
                 "of consumption. This saves about EUR {sav} per year: the "
                 "USD 10,000 investment pays back in ~{pay} years and "
                 "yields ~EUR {net} net benefit over 20 years.",
    },
    "tr": {
        "title": "Güneş Enerjisi Fizibilite Raporu",
        "sub": "solarVis AI - otomatik teklif - {d}",
        "s1": "1. Girdiler",
        "loc": "Konum",
        "loc_v": "-34.04658, 18.46491 (sabit demo saha, Cape Town)",
        "cons": "Aylık tüketim",
        "cons_v": "1.150 kWh (13.800 kWh/yıl)",
        "price": "Birim elektrik fiyatı",
        "price_v": "EUR 0,25 / kWh",
        "req": "İstenen sistem boyutu",
        "inst": "Kurulan sistem",
        "inst_v": "{kwp} kWp - {n} x 400 Wp panel",
        "cap": "Not: çatı kapasitesi sistemi {n} panelle sınırlıyor.",
        "s2": "2. Panel Yerleşimi",
        "no_img": "(yerleşim görseli mevcut değil)",
        "s3": "3. Enerji Üretimi (PVGIS, 25 derece eğim)",
        "th": ["Facet", "Azimut", "Panel", "kWp", "kWh/kWp/yıl", "kWh/yıl"],
        "total": "Toplam yıllık üretim: {p} kWh (karşılama: %{c})",
        "s4": "4. Finansal Analiz (20 yıl)",
        "sav": "Yıllık tasarruf",
        "capex": "CAPEX",
        "capex_v": "USD 10.000 (1:1 EUR varsayımı)",
        "pay": "Geri ödeme süresi",
        "pay_v": "{p} yıl",
        "net": "20 yıl net kazanç",
        "chart": "Kümülatif nakit akışı (EUR)",
        "breakeven": "başabaş",
        "pay_line": "Geri ödeme ~ {p} yıl",
        "years": "Yıl",
        "foot": "Case metodolojisine göre basitleştirilmiş model: sabit "
                "tarife EUR 0,25/kWh, degradasyon yok, tasarruf yıllık "
                "tüketimle sınırlı.",
        "sum_t": "2. Yönetici Özeti",
        "sum_b": "Girdilerinize göre - ayda 1.150 kWh (yılda 13.800 kWh) "
                 "tüketim ve 0,25 EUR/kWh birim fiyat - her biri 1 m x 2 m "
                 "olan {n} adet 400 Wp panelle {kwp} kWp'lik bir güneş "
                 "enerjisi sistemi tasarlandı; paneller çatının en verimli "
                 "yüzeylerine otomatik yerleştirildi ({fl}). PVGIS "
                 "simülasyonlarına göre yıllık üretim yaklaşık {prod} kWh "
                 "olup tüketimin yaklaşık %{cov} kadarını karşılar. Bu, "
                 "yılda yaklaşık {sav} EUR tasarruf demektir: 10.000 USD "
                 "yatırım ~{pay} yılda kendini öder ve 20 yılda ~{net} EUR "
                 "net kazanç sağlar.",
    },
}


class Report(FPDF):
    def __init__(self, strings, lang):
        super().__init__()
        self.strings = strings
        self.pdf_lang = lang
        reg = FONT_DIR / "DejaVuSans.ttf"
        bold = FONT_DIR / "DejaVuSans-Bold.ttf"
        ital = FONT_DIR / "DejaVuSans-Oblique.ttf"
        if reg.exists():
            # Bold/Oblique dosyaları yoksa regular'a düşülür; unicode kapsamı
            # (Türkçe karakterler) yine de korunur, sadece ağırlık/eğim aynı kalır.
            self.add_font("DejaVu", "", str(reg))
            self.add_font("DejaVu", "B", str(bold if bold.exists() else reg))
            self.add_font("DejaVu", "I", str(ital if ital.exists() else reg))
            self.font_family_name, self.unicode_ok = "DejaVu", True
        else:
            self.font_family_name, self.unicode_ok = "helvetica", False

    def tx(self, txt: str) -> str:
        """Unicode font yoksa Türkçe karakterleri ASCII'ye indir."""
        return txt if self.unicode_ok else txt.translate(TR_MAP)

    def fmt_num(self, n) -> str:
        s = f"{int(n):,}"
        return s.replace(",", ".") if self.pdf_lang == "tr" else s

    def header(self):
        self.set_font(self.font_family_name, "B", 16)
        self.set_text_color(*NAVY)
        self.cell(0, 10, self.tx(self.strings["title"]),
                  new_x="LMARGIN", new_y="NEXT")
        self.set_font(self.font_family_name, "", 9)
        self.set_text_color(*GRAY)
        self.cell(0, 5, self.tx(self.strings["sub"].format(d=date.today().isoformat())),
                  new_x="LMARGIN", new_y="NEXT")
        self.ln(3)

    def section(self, title):
        self.set_font(self.font_family_name, "B", 12)
        self.set_text_color(*AMBER)
        self.cell(0, 8, self.tx(title), new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(0, 0, 0)

    def kv(self, k, v):
        self.set_font(self.font_family_name, "", 10)
        self.cell(70, 6, self.tx(k))
        self.set_font(self.font_family_name, "B", 10)
        self.cell(0, 6, self.tx(str(v)), new_x="LMARGIN", new_y="NEXT")


def _chart(pdf, cashflow, payback, payback_s, x, y, w, h):
    vals = [c["cumulative"] for c in cashflow]
    vmin, vmax = min(vals), max(vals)
    span = (vmax - vmin) or 1
    pad = span * 0.07
    lo, hi = vmin - pad, vmax + pad
    n = len(vals) - 1
    # Grafik 0..n yıl aralığını kapsar; payback bunun ötesindeyse (düşük
    # üretim senaryosu) işaretçiyi kutunun dışına taşırmak yerine kenara sabitle.
    payback_px_year = min(payback, n) if payback else None
    payback_overflow = bool(payback) and payback > n

    def px(year):
        return x + w * year / n

    def py(v):
        return y + h * (1 - (v - lo) / (hi - lo))

    pdf.set_draw_color(203, 213, 225)
    pdf.rect(x, y, w, h)

    step = 10_000 if span > 25_000 else 5_000
    t = math.ceil(lo / step) * step
    pdf.set_font(pdf.font_family_name, "", 7)
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

    for yr in range(0, n + 1, 5):
        xx = px(yr)
        pdf.set_draw_color(*GRID)
        pdf.set_dash_pattern(dash=0.8, gap=1.2)
        pdf.line(xx, y, xx, y + h)
        pdf.set_dash_pattern()
        pdf.text(xx - 1.2, y + h + 4, str(yr))

    pdf.set_draw_color(148, 163, 184)
    pdf.line(x, py(0), x + w, py(0))
    pdf.set_font(pdf.font_family_name, "I", 7)
    pdf.text(x + w - 18, py(0) - 1.5, pdf.tx(pdf.strings["breakeven"]))

    if payback:
        pdf.set_draw_color(*AMBER)
        pdf.set_line_width(0.45)
        pdf.line(px(payback_px_year), y, px(payback_px_year), y + h)
        pdf.set_line_width(0.2)
        pdf.set_text_color(*AMBER)
        pdf.set_font(pdf.font_family_name, "B", 8)
        label = pdf.tx(pdf.strings["pay_line"].format(p=payback_s))
        label_x = (px(payback_px_year) - pdf.get_string_width(label) - 1.5
                   if payback_overflow else px(payback_px_year) + 1.5)
        pdf.text(label_x, y + 4, label)

    pdf.set_draw_color(*SKY)
    pdf.set_line_width(0.6)
    for i in range(1, len(vals)):
        pdf.line(px(i - 1), py(vals[i - 1]), px(i), py(vals[i]))
    pdf.set_line_width(0.2)

    pdf.set_fill_color(*SKY)
    for i, v in enumerate(vals):
        r = 0.7
        pdf.ellipse(px(i) - r, py(v) - r, 2 * r, 2 * r, style="F")

    if payback:
        pdf.set_fill_color(*AMBER)
        r = 1.3
        pdf.ellipse(px(payback_px_year) - r, py(0) - r, 2 * r, 2 * r, style="F")

    pdf.set_font(pdf.font_family_name, "B", 8)
    pdf.set_text_color(*SKY)
    pdf.text(px(n) - 26, py(vals[-1]) - 2, f"EUR {pdf.fmt_num(vals[-1])}")
    pdf.set_font(pdf.font_family_name, "", 7)
    pdf.set_text_color(*GRAY)
    pdf.text(px(0) + 1.5, py(vals[0]) - 2, f"CAPEX {pdf.fmt_num(vals[0])}")

    pdf.set_font(pdf.font_family_name, "I", 7)
    pdf.text(x + w / 2 - 4, y + h + 8, pdf.tx(pdf.strings["years"]))
    pdf.set_text_color(0, 0, 0)


def build_pdf(a: dict, scene_png: bytes | None, lang: str = "en") -> bytes:
    lang = lang if lang in L else "en"
    s = L[lang]
    p = a["placement"]
    pdf = Report(s, lang)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    payback = a["paybackYears"]
    payback_s = (str(payback).replace(".", ",")
                 if lang == "tr" else str(payback))

    pdf.section(s["s1"])
    pdf.kv(s["loc"], s["loc_v"])
    pdf.kv(s["cons"], s["cons_v"])
    pdf.kv(s["price"], s["price_v"])
    pdf.kv(s["req"], f'{p["requestedKwp"]} kWp')
    pdf.kv(s["inst"], s["inst_v"].format(kwp=p["actualKwp"],
                                         n=p["placedPanels"]))
    if p["warning"]:
        pdf.set_font(pdf.font_family_name, "I", 9)
        pdf.set_text_color(*AMBER)
        pdf.multi_cell(0, 5, pdf.tx(s["cap"].format(n=p["placedPanels"])))
        pdf.set_text_color(0, 0, 0)
    pdf.ln(2)

    fl = ", ".join(f'{f["compass"]}: {f["placed"]}'
                   for f in p["perFacet"] if f["placed"] > 0)
    pdf.section(s["sum_t"])
    pdf.set_font(pdf.font_family_name, "", 10)
    pdf.multi_cell(0, 5.5, pdf.tx(s["sum_b"].format(
        kwp=p["actualKwp"], n=p["placedPanels"], fl=fl,
        prod=pdf.fmt_num(a["annualProductionKwh"]),
        cov=round(a["coverageRatio"] * 100),
        sav=pdf.fmt_num(a["annualSavingsEur"]),
        pay=payback_s,
        net=pdf.fmt_num(a["netBenefit20yEur"]))))
    pdf.ln(2)

    pdf.section(s["s2"])
    if scene_png:
        pdf.image(BytesIO(scene_png), x=45, w=120)
    else:
        pdf.set_font(pdf.font_family_name, "I", 9)
        pdf.cell(0, 6, pdf.tx(s["no_img"]), new_x="LMARGIN", new_y="NEXT")

    pdf.add_page()
    pdf.section(s["s3"])
    widths = [22, 26, 22, 22, 34, 34]
    pdf.set_font(pdf.font_family_name, "B", 9)
    for hdr, wd in zip(s["th"], widths):
        pdf.cell(wd, 7, pdf.tx(hdr), border=1)
    pdf.ln()
    pdf.set_font(pdf.font_family_name, "", 9)
    for f in p["perFacet"]:
        if f["placed"] == 0:
            continue
        row = [f["compass"], f'{f["azimuthDeg"]}', str(f["placed"]),
               f'{f["kwp"]}', f'{f["specificYield"]}',
               pdf.fmt_num(f["estAnnualKwh"])]
        for val, wd in zip(row, widths):
            pdf.cell(wd, 7, val, border=1)
        pdf.ln()
    pdf.set_font(pdf.font_family_name, "B", 10)
    pdf.ln(1)
    pdf.cell(0, 8, pdf.tx(s["total"].format(
        p=pdf.fmt_num(a["annualProductionKwh"]),
        c=round(a["coverageRatio"] * 100))),
        new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    pdf.section(s["s4"])
    pdf.kv(s["sav"], f'EUR {pdf.fmt_num(a["annualSavingsEur"])}')
    pdf.kv(s["capex"], s["capex_v"])
    pdf.kv(s["pay"], s["pay_v"].format(p=payback_s))
    pdf.kv(s["net"], f'EUR {pdf.fmt_num(a["netBenefit20yEur"])}')
    pdf.ln(3)
    pdf.set_font(pdf.font_family_name, "I", 8)
    pdf.set_text_color(*GRAY)
    pdf.cell(0, 5, pdf.tx(s["chart"]), new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(1)
    y0 = pdf.get_y()
    _chart(pdf, a["cashflow"], payback, payback_s, x=25, y=y0, w=160, h=65)
    pdf.set_y(y0 + 65 + 13)
    pdf.set_font(pdf.font_family_name, "I", 8)
    pdf.set_text_color(*GRAY)
    pdf.multi_cell(0, 4, pdf.tx(s["foot"]))
    return bytes(pdf.output())