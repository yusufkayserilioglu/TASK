"""Uçtan uca hesap: geometri -> yerleşim -> üretim -> finans."""
from config import FIXED_LAT, FIXED_LON, SCALE, ZOOM, meters_per_pixel
from finance import analyze
from panels import place_panels
from roof import build_roof_model


def run_pipeline(kwp: float):
    mpp = meters_per_pixel(FIXED_LAT, ZOOM, SCALE)
    model = build_roof_model(mpp)
    placement = place_panels(model, kwp, mpp, FIXED_LAT, FIXED_LON)

    analysis = None
    if placement["yieldSource"] == "pvgis":
        total = sum(f["estAnnualKwh"] or 0 for f in placement["perFacet"])
        analysis = analyze(total)
        analysis["placement"] = {
            "requestedKwp": placement["requestedKwp"],
            "actualKwp": round(placement["placedPanels"] * 0.4, 1),
            "placedPanels": placement["placedPanels"],
            "requestedPanels": placement["requestedPanels"],
            "warning": placement["warning"],
            "perFacet": placement["perFacet"],
        }
    return placement, analysis