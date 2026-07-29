from finance import analyze


def test_tasarruf_tuketimle_sinirli():
    r = analyze(20_000)  # üretim tüketimi aşarsa fazlası sayılmaz
    assert r["coveredKwh"] == 13_800
    assert r["annualSavingsEur"] == 13_800 * 0.25


def test_geri_odeme_ve_kumulatif_tutarli():
    r = analyze(8_383)   # C adımında 6 kWp icin cikan gercek deger
    assert abs(r["annualSavingsEur"] - 2095.75) < 0.01
    assert abs(r["paybackYears"] - 4.8) < 0.05
    assert r["cashflow"][-1]["cumulative"] == r["netBenefit20yEur"]
    assert r["cashflow"][4]["cumulative"] < 0 < r["cashflow"][5]["cumulative"]