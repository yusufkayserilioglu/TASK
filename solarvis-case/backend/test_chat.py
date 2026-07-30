from chat import handle_message, start_conversation


def test_mutlu_yol_scene_ve_analysis_donuyor():
    cid, greet = start_conversation()
    assert any(m["type"] == "text" for m in greet)
    handle_message(cid, "34.0466, 18.4649")
    msgs = handle_message(cid, "1150")
    assert any(m["type"] == "options" for m in msgs)
    result = handle_message(cid, "6")
    types = [m["type"] for m in result]
    assert "scene" in types and "analysis" in types


def test_gecersiz_boyut_tekrar_sorar():
    cid, _ = start_conversation()
    handle_message(cid, "x")
    handle_message(cid, "y")
    msgs = handle_message(cid, "7 kwp")
    assert any(m["type"] == "options" for m in msgs)
    # akış kilitlenmedi, geçerli seçim hâlâ çalışıyor:
    result = handle_message(cid, "9,6")
    assert any(m["type"] == "analysis" for m in result)


def test_restart():
    cid, _ = start_conversation()
    handle_message(cid, "a"); handle_message(cid, "b"); handle_message(cid, "6")
    msgs = handle_message(cid, "restart")
    assert any("latitude" in m.get("text", "") for m in msgs)