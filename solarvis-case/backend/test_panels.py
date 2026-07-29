from shapely.geometry import Polygon

from main import FIXED_LAT, FIXED_LON, SCALE, ZOOM, meters_per_pixel
from panels import place_panels
from roof import build_roof_model


def _setup(kwp):
    mpp = meters_per_pixel(FIXED_LAT, ZOOM, SCALE)
    model = build_roof_model(mpp)
    return model, place_panels(model, kwp, mpp, FIXED_LAT, FIXED_LON)


def test_6kwp_15_panel():
    _, res = _setup(6.0)
    assert res["requestedPanels"] == 15
    assert res["placedPanels"] == 15


def test_paneller_kendi_facetinin_icinde():
    model, res = _setup(6.0)
    polys = {f["id"]: Polygon(f["polygonPx"]).buffer(2)  # 2 px tolerans
             for f in model["facets"]}
    for p in res["panels"]:
        assert polys[p["facetId"]].contains(Polygon(p["polygonPx"]))


def test_kapasite_asiminda_uyari_tutarli():
    _, res = _setup(9.6)
    assert res["placedPanels"] <= res["requestedPanels"]
    if res["placedPanels"] < res["requestedPanels"]:
        assert res["warning"]