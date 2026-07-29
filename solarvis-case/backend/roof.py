"""Çatı geometrisi: roof.json'dan kenarları, facet alanlarını ve azimutları türetir.

Koordinat sistemi: 1280x1280 görüntü pikselleri, +x sağ (doğu), +y AŞAĞI (güney).
Google Static Maps kuzey-yukarı olduğu için pusula açısı: bearing = atan2(dx, -dy).
"""
import json
import math
from pathlib import Path

DATA = Path(__file__).parent / "data"
PITCH_DEG = 25.0

COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def _dist(p, q):
    return math.hypot(q[0] - p[0], q[1] - p[1])


def _mid(p, q):
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]


def _bearing(dx, dy):
    """Görüntü vektörü -> pusula açısı (0=K, 90=D, 180=G, 270=B)."""
    return (math.degrees(math.atan2(dx, -dy)) + 360) % 360


def _shoelace_px2(poly):
    """Poligon alanı (piksel^2), Shoelace formülü."""
    a = 0.0
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2


def build_roof_model(mpp: float):
    raw = json.loads((DATA / "roof.json").read_text())
    corners = raw["corners"]
    ridge = raw["ridge"]
    r_mid = _mid(ridge[0], ridge[1])

    def near_ridge(p):
        """Hipped çatıda her köşe, kendine en yakın sırt ucuna bağlanır."""
        return ridge[0] if _dist(p, ridge[0]) <= _dist(p, ridge[1]) else ridge[1]

    edges = {}   # aynı kenarı iki kez eklememek için (hip'ler iki facet'e ortak)
    facets = []

    def add_edge(p, q, kind):
        key = tuple(sorted((tuple(p), tuple(q))))
        if key not in edges:
            edges[key] = {
                "from": p, "to": q, "kind": kind,
                "lengthM": round(_dist(p, q) * mpp, 2),
            }

    for i in range(4):
        p1, p2 = corners[i], corners[(i + 1) % 4]      # saçak (dış kenar)
        r1, r2 = near_ridge(p1), near_ridge(p2)

        # Facet poligonu: iki köşe aynı sırt ucuna bağlanıyorsa ÜÇGEN, yoksa YAMUK
        poly = [p1, p2, r2] if r1 == r2 else [p1, p2, r2, r1]

        add_edge(p1, p2, "eave")
        add_edge(p2, r2, "hip")
        if r1 != r2:
            add_edge(r2, r1, "ridge")
        add_edge(r1, p1, "hip")

        # Azimut: saçağa dik iki aday normalden, sırt ortasından DIŞARI bakanı seç
        ex, ey = p2[0] - p1[0], p2[1] - p1[1]
        m = _mid(p1, p2)
        bearing = None
        for nx, ny in ((-ey, ex), (ey, -ex)):
            if nx * (r_mid[0] - m[0]) + ny * (r_mid[1] - m[1]) < 0:
                bearing = _bearing(nx, ny)
                break

        proj_m2 = _shoelace_px2(poly) * mpp * mpp
        true_m2 = proj_m2 / math.cos(math.radians(PITCH_DEG))  # 25° eğim düzeltmesi

        facets.append({
            "id": f"facet-{i}",
            "polygonPx": poly,
            "eave": [p1, p2],
            "projectedAreaM2": round(proj_m2, 1),
            "trueAreaM2": round(true_m2, 1),
            "azimuthDeg": round(bearing, 1),
            "compass": COMPASS[round(bearing / 45) % 8],
        })

    return {
        "pitchDeg": PITCH_DEG,
        "cornersPx": corners,
        "ridgePx": ridge,
        "edges": list(edges.values()),
        "facets": facets,
    }