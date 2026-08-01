from chat import handle_message, start_conversation


def test_mutlu_yol_proposal_donuyor():
    cid, greet = start_conversation()
    assert any(m["type"] == "text" for m in greet)
    handle_message(cid, "34.0466, 18.4649")
    msgs = handle_message(cid, "1150")
    assert any(m["type"] == "options" for m in msgs)
    result = handle_message(cid, "6")
    prop = next(m for m in result if m["type"] == "proposal")
    assert prop["redirect"] is True
    assert prop["panels"] == 15 and "/proposal/" in prop["proposalUrl"]


def test_gecersiz_boyut_tekrar_sorar():
    cid, _ = start_conversation()
    handle_message(cid, "x")
    handle_message(cid, "y")
    msgs = handle_message(cid, "7 kwp")
    assert any(m["type"] == "options" for m in msgs)
    result = handle_message(cid, "9,6")
    assert any(m["type"] == "proposal" for m in result)


def test_restart():
    cid, _ = start_conversation()
    handle_message(cid, "a"); handle_message(cid, "b"); handle_message(cid, "6")
    msgs = handle_message(cid, "restart")
    assert any("latitude" in m.get("text", "") for m in msgs)


def test_turkce_baslangic_ve_akis():
    cid, greet = start_conversation("tr")
    texts = " ".join(m.get("text", "") for m in greet)
    assert "Merhaba" in texts
    msgs = handle_message(cid, "istanbul")
    assert any("çözümledim" in m.get("text", "") for m in msgs)