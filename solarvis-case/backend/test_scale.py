from main import meters_per_pixel


def test_case_lokasyonunda_olcek():
    # lat=-34.0466, zoom=20, scale=2 -> ~0.0619 m/px
    m = meters_per_pixel(-34.04658242871865, 20, 2)
    assert abs(m - 0.0619) < 0.001


def test_ekvator_zoom0():
    # zoom 0, scale 1, ekvator: tüm dünya 256 px -> 156543 m/px sabitinin kendisi
    assert abs(meters_per_pixel(0, 0, 1) - 156543.03392) < 0.01