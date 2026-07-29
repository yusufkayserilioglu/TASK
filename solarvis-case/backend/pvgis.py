"""PVGIS PVcalc: azimut başına özgül verim (kWh/kWp/yıl), cache-first."""
import json
from pathlib import Path

import httpx

CACHE = Path(__file__).parent / "data" / "pvgis_cache"
CACHE.mkdir(parents=True, exist_ok=True)

PVGIS_URL = "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc"


def azimuth_to_aspect(azimuth_deg: float) -> float:
    """Pusula azimutu (0=K, 90=D) -> PVGIS aspect (0=G, -90=D, 90=B, ±180=K)."""
    return ((azimuth_deg - 180 + 540) % 360) - 180


def specific_yield(lat: float, lon: float, aspect: float, angle: float = 25.0) -> float:
    """1 kWp için yıllık üretim (E_y). Cache varsa ağa çıkmaz.

    PVcalc çıktısı peakpower ile lineerdir; bu yüzden peakpower=1 sonucu
    hem facet sıralaması hem de (kWp ile çarpılarak) gerçek üretim için yeter.
    """
    key = CACHE / f"aspect_{round(aspect)}_angle_{round(angle)}.json"
    if key.exists():
        data = json.loads(key.read_text())
    else:
        params = {
            "lat": lat, "lon": lon, "peakpower": 1, "loss": 14,
            "angle": angle, "aspect": aspect, "outputformat": "json",
        }
        resp = httpx.get(PVGIS_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        key.write_text(json.dumps(data))
    return data["outputs"]["totals"]["fixed"]["E_y"]