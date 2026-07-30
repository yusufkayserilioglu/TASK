from db import create_proposal, get_proposal, init_db, record_view
from pipeline import run_pipeline


def test_teklif_kaydet_oku_goruntule():
    init_db()
    _, a = run_pipeline(6.0)
    pid = create_proposal(6.0, a)
    p = get_proposal(pid)
    assert p["kwp"] == 6.0
    assert p["analysis"]["paybackYears"] == a["paybackYears"]
    assert record_view(pid)
    assert get_proposal(pid)["viewCount"] == 1


def test_olmayan_teklif_none():
    init_db()
    assert get_proposal("boyle-bir-id-yok") is None