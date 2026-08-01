"""Panel yerleşimi.

Yöntem: her facet, saçak eksenli yerel koordinata alınır ve eğik düzleme
"açılır" (saçağa dik mesafeler 1/cos(25°) ile uzar). Gerçek yüzeyde paneller
grid olarak denenir (shapely contains), sığanlar izdüşüme geri projekte edilir.

Yönelim optimizasyonu: her facet için hem dikey (1 m saçak x 2 m eğim) hem
yatay (2 m saçak x 1 m eğim) yerleşim denenir, çok panel sığdıran kazanır.
Sığ facetlerde (saçak-mahya derinliği ~1 panel boyu) bu fark 2 kata çıkar.

Facetler PVGIS özgül verimine göre sıralanıp doldurulur.
"""
import math

from shapely.geometry import MultiPolygon, Polygon, box

from pvgis import azimuth_to_aspect, specific_yield

PANEL_WP = 400
MARGIN = 0.3     # m, kenar payı (montaj/rüzgar bölgesi)
GAP = 0.05       # m, paneller arası boşluk
COS_P = math.cos(math.radians(25.0))


def _unit(x, y):
    n = math.hypot(x, y) or 1.0
    return x / n, y / n


def _facet_frame(facet):
    """Yerel eksenler: u = saçak yönü, v = saçaktan sırta (facet içine) dik."""
    p1, p2 = facet["eave"]
    u = _unit(p2[0] - p1[0], p2[1] - p1[1])
    cx = sum(p[0] for p in facet["polygonPx"]) / len(facet["polygonPx"])
    cy = sum(p[1] for p in facet["polygonPx"]) / len(facet["polygonPx"])
    mx, my = (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2
    for vx, vy in ((-u[1], u[0]), (u[1], -u[0])):
        if vx * (cx - mx) + vy * (cy - my) > 0:  # facet merkezine bakan normal
            return p1, u, (vx, vy)
    return p1, u, (-u[1], u[0])  # teorik olarak ulaşılmaz


def _grid_layout(inset, pw, ph):
    """inset poligonuna pw x ph kutuları saçaktan yukarı grid diz."""
    minx, miny, maxx, maxy = inset.bounds
    out, y = [], miny
    while y + ph <= maxy + 1e-9:
        x = minx
        while x + pw <= maxx + 1e-9:
            if inset.contains(box(x, y, x + pw, y + ph)):
                out.append((x, y, pw, ph))
                x += pw + GAP
            else:
                x += 0.1  # sığmadıysa kaydırarak dene (eğik hip kenarları için)
        y += ph + GAP
    return out


def facet_capacity_layout(facet, mpp):
    """Facet'e sığan TÜM paneller: (pikselPoligonListesi, yönelim)."""
    p1, u, v = _facet_frame(facet)

    def to_local(q):  # piksel -> açılmış yüzey metresi
        dx, dy = q[0] - p1[0], q[1] - p1[1]
        return ((dx * u[0] + dy * u[1]) * mpp,
                (dx * v[0] + dy * v[1]) * mpp / COS_P)

    def to_px(um, vs):  # açılmış yüzey metresi -> piksel
        vm = vs * COS_P
        return [round(p1[0] + (u[0] * um + v[0] * vm) / mpp, 1),
                round(p1[1] + (u[1] * um + v[1] * vm) / mpp, 1)]

    poly = Polygon([to_local(q) for q in facet["polygonPx"]])
    inset = poly.buffer(-MARGIN)
    if inset.is_empty:
        return [], "-"
    if isinstance(inset, MultiPolygon):  # tuhaf geometride en büyük parçayı al
        inset = max(inset.geoms, key=lambda g: g.area)

    portrait = _grid_layout(inset, 1.0, 2.0)
    landscape = _grid_layout(inset, 2.0, 1.0)
    boxes, orient = (
        (landscape, "yatay") if len(landscape) > len(portrait)
        else (portrait, "dikey")
    )

    panels = []
    for (x, y, pw, ph) in boxes:
        corners = [(x, y), (x + pw, y), (x + pw, y + ph), (x, y + ph)]
        panels.append([to_px(a, b) for a, b in corners])
    return panels, orient


def place_panels(model, kwp: float, mpp: float, lat: float, lon: float):
    requested = round(kwp * 1000 / PANEL_WP)

    ranked, yield_source = [], "pvgis"
    for f in model["facets"]:
        aspect = azimuth_to_aspect(f["azimuthDeg"])
        try:
            ey = specific_yield(lat, lon, aspect)
        except Exception:
            # Ağ yok + cache yok: kuzeye açısal yakınlıkla sırala (güney yarımküre)
            yield_source = "fallback"
            ey = -min(f["azimuthDeg"], 360 - f["azimuthDeg"])
        layout, orient = facet_capacity_layout(f, mpp)
        ranked.append({"facet": f, "aspect": aspect, "ey": ey,
                       "layout": layout, "orient": orient})
    ranked.sort(key=lambda r: r["ey"], reverse=True)

    panels, per_facet, remaining = [], [], requested
    for r in ranked:
        take = min(len(r["layout"]), remaining)
        for poly in r["layout"][:take]:
            panels.append({"facetId": r["facet"]["id"], "polygonPx": poly})
        placed_kwp = take * PANEL_WP / 1000
        per_facet.append({
            "facetId": r["facet"]["id"],
            "compass": r["facet"]["compass"],
            "azimuthDeg": r["facet"]["azimuthDeg"],
            "aspect": r["aspect"],
            "orientation": r["orient"],
            "specificYield": round(r["ey"], 1) if yield_source == "pvgis" else None,
            "capacity": len(r["layout"]),
            "placed": take,
            "kwp": placed_kwp,
            "aspect": round(r["aspect"], 1),
            "estAnnualKwh": round(r["ey"] * placed_kwp, 0)
            if yield_source == "pvgis" else None,
        })
        remaining -= take

    return {
        "requestedKwp": kwp,
        "requestedPanels": requested,
        "placedPanels": requested - remaining,
        "yieldSource": yield_source,
        "warning": (f"Roof capacity limits the system to "
                    f"{requested - remaining} of {requested} panels.")
        if remaining > 0 else None,
        "panels": panels,
        "perFacet": per_facet,
    }