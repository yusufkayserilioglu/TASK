"""solarVis AI sohbet akışı.

Durumlar: AWAITING_LOCATION -> AWAITING_CONSUMPTION -> AWAITING_SIZE -> DONE
Konuşma durumu bellekte; teklifler SQLite'a kalıcı yazılır (db.py).
Mimari not: hesaplar deterministik; metinler naturalize() kancasından geçer,
istenirse oraya LLM katmanı takılır (opsiyonel iyileştirme).
"""
import re
import uuid

from db import create_proposal
from pipeline import run_pipeline

CONVERSATIONS: dict[str, dict] = {}

SIZE_MAP = {"3.6": 3.6, "6": 6.0, "9.6": 9.6}


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


def _greeting():
    return [
        _text("Hi! I'm solarVis AI. I'll take you from a location to a "
              "shareable solar proposal in a few quick steps."),
        _text("First, please share your location as latitude, longitude "
              "(e.g. 34.0466, 18.4649)."),
    ]


def start_conversation():
    cid = str(uuid.uuid4())
    CONVERSATIONS[cid] = {"state": "AWAITING_LOCATION"}
    return cid, naturalize(_greeting())


def _normalize_size(t: str):
    k = t.lower().replace("kwp", "").strip().replace(",", ".")
    if "." in k:
        k = k.rstrip("0").rstrip(".")   # "6.0" -> "6", "9.6" kalır
    return k


def handle_message(cid: str, text: str):
    conv = CONVERSATIONS.get(cid)
    if conv is None:
        return None
    t = text.strip()

    if conv["state"] == "AWAITING_LOCATION":
        conv["state"] = "AWAITING_CONSUMPTION"
        echo = f'"{t}"' if t else "your input"
        return naturalize([
            _text(f"Great — I resolved {echo} to our demo site at "
                  "-34.04658, 18.46491 (Cape Town) with a 4-facet hipped roof."),
            _text("What is your monthly electricity consumption, in kWh?"),
        ])

    if conv["state"] == "AWAITING_CONSUMPTION":
        conv["state"] = "AWAITING_SIZE"
        num = re.search(r"\d[\d.,]*", t)
        typed = num.group().replace(".", "").replace(",", "") if num else None
        prefix = ("Consumption is fixed for this case study, so "
                  if typed and typed != "1150" else "")
        return naturalize([
            _text(f"{prefix}I'll continue with 1,150 kWh/month "
                  "(13,800 kWh/year) at €0.25/kWh."),
            _text("How large a system do you need? Pick one:"),
            _size_options(),
        ])

    if conv["state"] == "AWAITING_SIZE":
        key = _normalize_size(t)
        if key not in SIZE_MAP:
            return naturalize([
                _text("Please pick one of the three options:"),
                _size_options(),
            ])
        kwp = SIZE_MAP[key]
        placement, a = run_pipeline(kwp)
        if a is None:
            return naturalize([_text(
                "I couldn't reach PVGIS and no cached data is available, "
                "so I can't compute production right now. Please try again later."
            )])
        conv.update({"state": "DONE", "kwp": kwp})

        msgs = [
            _text(f"Here's your roof with {a['placement']['placedPanels']} "
                  f"panels placed ({a['placement']['actualKwp']} kWp), "
                  "prioritizing the best-oriented facets:"),
            {"role": "assistant", "type": "scene", "kwp": kwp},
        ]
        if a["placement"]["warning"]:
            msgs.append(_text(
                f"One note: your roof fits at most "
                f"{a['placement']['placedPanels']} panels "
                f"({a['placement']['actualKwp']} kWp), so I sized everything "
                "to what's actually achievable — the sweet spot for this roof."
            ))

        pid = create_proposal(kwp, a)
        url = f"http://localhost:3000/proposal/{pid}"
        msgs += [
            _text(f"The system produces ~{a['annualProductionKwh']:,} kWh/year, "
                  f"covering {round(a['coverageRatio'] * 100)}% of your "
                  f"consumption. Annual savings ≈ "
                  f"€{a['annualSavingsEur']:,.0f}, payback ≈ "
                  f"{a['paybackYears']} years, 20-year net benefit ≈ "
                  f"€{a['netBenefit20yEur']:,.0f}."),
            {"role": "assistant", "type": "analysis", "data": a},
            _text("Your feasibility report and shareable proposal are ready "
                  "below — anyone with the link can view it online. "
                  "Type 'restart' for a new analysis."),
            {"role": "assistant", "type": "actions", "kwp": kwp,
             "proposalId": pid, "proposalUrl": url},
        ]
        return naturalize(msgs)

    # DONE
    if t.lower() in ("restart", "baştan", "yeni", "new"):
        CONVERSATIONS[cid] = {"state": "AWAITING_LOCATION"}
        return naturalize(_greeting())
    return naturalize([_text("Analysis is complete. Type 'restart' to run a "
                             "new one.")])