from pipeline import run_pipeline
from report import build_pdf


def test_pdf_uretimi_gorselsiz_de_calisir():
    _, a = run_pipeline(6.0)
    assert a is not None
    pdf = build_pdf(a, None)
    assert pdf[:4] == b"%PDF"
    assert len(pdf) > 3000