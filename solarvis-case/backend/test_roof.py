from main import FIXED_LAT, SCALE, ZOOM, meters_per_pixel
from roof import _shoelace_px2, build_roof_model


def test_facet_izdusum_alanlari_dis_poligona_esit():
    mpp = meters_per_pixel(FIXED_LAT, ZOOM, SCALE)
    model = build_roof_model(mpp)
    facet_toplam = sum(f["projectedAreaM2"] for f in model["facets"])
    dis_poligon = _shoelace_px2(model["cornersPx"]) * mpp * mpp
    assert abs(facet_toplam - dis_poligon) < 1.0  # m², yuvarlama payı


def test_dokuz_kenar_ve_dort_facet():
    mpp = meters_per_pixel(FIXED_LAT, ZOOM, SCALE)
    model = build_roof_model(mpp)
    assert len(model["edges"]) == 9
    assert len(model["facets"]) == 4