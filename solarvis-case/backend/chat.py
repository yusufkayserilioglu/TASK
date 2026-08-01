"""solarVis AI sohbet akışı (EN/TR yerelleştirilmiş).

Durumlar: AWAITING_LOCATION -> AWAITING_CONSUMPTION -> AWAITING_SIZE -> DONE
Frontend her istekte lang gönderir; yeni mesajlar o dilde üretilir (dil
ortada değiştirilirse eski mesajlar eski dilde kalır — doğal chat davranışı).
Hesaplar deterministik; naturalize() LLM kancası bilinçli no-op.
"""
import re
import uuid

from db import create_proposal
from pipeline import run_pipeline

CONVERSATIONS: dict[str, dict] = {}
SIZE_MAP = {"3.6": 3.6, "6": 6.0, "9.6": 9.6}
RESTART_WORDS = {"restart", "new", "yeniden", "baştan", "bastan", "yeni"}

T = {
    "en": {
        "greet1": "Hi! I'm solarVis AI. I'll take you from a location to a "
                  "shareable solar proposal in a few quick steps.",
        "greet2": "First, please share your location as latitude, longitude "
                  "(e.g. 34.0466, 18.4649).",
        "resolved": "Great — I resolved {echo} to our demo site at "
                    "-34.04658, 18.46491 (Cape Town) with a 4-facet hipped "
                    "roof.",
        "ask_consumption": "What is your monthly electricity consumption, "
                           "in kWh?",
        "fixed_prefix": "Consumption is fixed for this case study, so ",
        "continue_with": "{prefix}I'll continue with 1,150 kWh/month "
                         "(13,800 kWh/year) at €0.25/kWh.",
        "ask_size": "How large a system do you need? Pick one:",
        "pick_one": "Please pick one of the three options:",
        "pvgis_error": "I couldn't reach PVGIS and no cached data is "
                       "available, so I can't compute production right now. "
                       "Please try again later.",
        "done": "Done! I placed {panels} panels ({kwp} kWp) producing "
                "~{prod} kWh/year — payback ≈ {payback} years. "
                "Opening your proposal…",
        "capacity_note": "Note: your roof fits at most {panels} panels "
                         "({kwp} kWp), so I sized the system to what's "
                         "actually achievable.",
        "complete": "Analysis is complete. Type 'restart' to run a new one.",
    },
    "tr": {
        "greet1": "Merhaba! Ben solarVis AI. Birkaç hızlı adımda konumdan "
                  "paylaşılabilir bir güneş enerjisi teklifine ulaştıracağım.",
        "greet2": "Önce konumunuzu enlem, boylam olarak paylaşır mısınız? "
                  "(örn. 34.0466, 18.4649)",
        "resolved": "Harika — {echo} 4 facetli kırma çatılı demo sahamıza "
                    "çözümledim: -34.04658, 18.46491 (Cape Town).",
        "ask_consumption": "Aylık elektrik tüketiminiz kaç kWh?",
        "fixed_prefix": "Bu case çalışmasında tüketim sabittir, bu yüzden ",
        "continue_with": "{prefix}1.150 kWh/ay (13.800 kWh/yıl) ve €0,25/kWh "
                         "ile devam ediyorum.",
        "ask_size": "Ne kadarlık bir sisteme ihtiyacınız var? Birini seçin:",
        "pick_one": "Lütfen üç seçenekten birini seçin:",
        "pvgis_error": "PVGIS'e ulaşamadım ve önbellekte veri yok; şu an "
                       "üretim hesaplayamıyorum. Lütfen daha sonra tekrar "
                       "deneyin.",
        "done": "Bitti! En verimli facetlere {panels} panel ({kwp} kWp) "
                "yerleştirdim; yıllık üretim ~{prod} kWh, geri ödeme "
                "≈ {payback} yıl. Teklifiniz açılıyor…",
        "capacity_note": "Not: çatınıza en fazla {panels} panel ({kwp} kWp) "
                         "sığıyor; sistemi gerçekleştirilebilir boyuta göre "
                         "ayarladım.",
        "complete": "Analiz tamamlandı. Yeni bir analiz için 'yeniden' yazın.",
    },
}


def _fmt(n, lang):
    s = f"{n:,}"
    return s.replace(",", ".") if lang == "tr" else s


def _text(t):
    return {"role": "assistant", "type": "text", "text": t}


def _size_options():
    return {
        "role": "assistant", "type": "options",
        "options": [
            {"label": "3.6 kWp", "value": "3.6"},
            {"label": "6 kWp", "value": "6"},
            {"label": "9.6 kWp", "value": "9.6"},
        ],
    }


def naturalize(messages):
    """Opsiyonel LLM kancası: şimdilik no-op (deterministik metinler)."""
    return messages


def _greeting(l):
    return [_text(l["greet1"]), _text(l["greet2"])]


def start_conversation(lang: str = "en"):
    lang = lang if lang in T else "en"
    cid = str(uuid.uuid4())
    CONVERSATIONS[cid] = {"state": "AWAITING_LOCATION", "lang": lang}
    return cid, naturalize(_greeting(T[lang]))


def _normalize_size(t: str):
    k = t.lower().replace("kwp", "").strip().replace(",", ".")
    if "." in k:
        k = k.rstrip("0").rstrip(".")   # "6.0" -> "6", "9.6" kalır
    return k


def handle_message(cid: str, text: str, lang: str | None = None):
    conv = CONVERSATIONS.get(cid)
    if conv is None:
        return None
    if lang in T:
        conv["lang"] = lang
    lng = conv.get("lang", "en")
    l = T[lng]
    t = text.strip()

    if conv["state"] == "AWAITING_LOCATION":
        conv["state"] = "AWAITING_CONSUMPTION"
        if lng == "tr":
            echo = f'"{t}" girdinizi' if t else "girdinizi"
        else:
            echo = f'"{t}"' if t else "your input"
        return naturalize([
            _text(l["resolved"].format(echo=echo)),
            _text(l["ask_consumption"]),
        ])

    if conv["state"] == "AWAITING_CONSUMPTION":
        conv["state"] = "AWAITING_SIZE"
        num = re.search(r"\d[\d.,]*", t)
        typed = num.group().replace(".", "").replace(",", "") if num else None
        # Kullanıcı 1150 dışında BİR ŞEY söylediyse (farklı sayı YA DA sayısız
        # metin), sabitleme açıklamasını göster; sessizce üzerine yazma.
        prefix = "" if typed == "1150" else l["fixed_prefix"]
        return naturalize([
            _text(l["continue_with"].format(prefix=prefix)),
            _text(l["ask_size"]),
            _size_options(),
        ])

    if conv["state"] == "AWAITING_SIZE":
        key = _normalize_size(t)
        if key not in SIZE_MAP:
            return naturalize([_text(l["pick_one"]), _size_options()])
        kwp = SIZE_MAP[key]
        placement, a = run_pipeline(kwp)
        if a is None:
            return naturalize([_text(l["pvgis_error"])])
        conv.update({"state": "DONE", "kwp": kwp})

        pid = create_proposal(kwp, a)
        url = f"http://localhost:3000/proposal/{pid}"

        payback = a["paybackYears"]
        payback_s = (str(payback).replace(".", ",")
                     if lng == "tr" else str(payback))
        msgs = [
            _text(l["done"].format(
                panels=a["placement"]["placedPanels"],
                kwp=a["placement"]["actualKwp"],
                prod=_fmt(a["annualProductionKwh"], lng),
                payback=payback_s,
            )),
        ]
        if a["placement"]["warning"]:
            msgs.append(_text(l["capacity_note"].format(
                panels=a["placement"]["placedPanels"],
                kwp=a["placement"]["actualKwp"],
            )))
        msgs.append(
            {"role": "assistant", "type": "proposal", "redirect": True,
             "proposalId": pid, "proposalUrl": url,
             "kwp": a["placement"]["actualKwp"],
             "panels": a["placement"]["placedPanels"],
             "paybackYears": a["paybackYears"]},
        )
        return naturalize(msgs)

    # DONE
    if t.lower() in RESTART_WORDS:
        CONVERSATIONS[cid] = {"state": "AWAITING_LOCATION", "lang": lng}
        return naturalize(_greeting(l))
    return naturalize([_text(l["complete"])])