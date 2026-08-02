import base64
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from chat import handle_message, start_conversation
from config import (FIXED_LAT, FIXED_LON, IMG_PX, SCALE, SIZE, ZOOM,
                    meters_per_pixel)
from panels import place_panels
from pipeline import run_pipeline
from report import build_pdf
from roof import build_roof_model
from db import create_proposal, get_proposal, init_db, record_view
from notify import notify_proposal_viewed

load_dotenv()  # backend/.env dosyasındaki anahtarları okur

app = FastAPI(title="solarVis Case API")
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
SATELLITE_CACHE = DATA_DIR / "satellite.png"

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/map-meta")
def map_meta():
    """Frontend'in ölçüm ve çizim için ihtiyaç duyduğu her şey."""
    return {
        "lat": FIXED_LAT,
        "lon": FIXED_LON,
        "zoom": ZOOM,
        "scale": SCALE,
        "imageSizePx": IMG_PX,
        "metersPerPixel": meters_per_pixel(FIXED_LAT, ZOOM, SCALE),
    }


@app.get("/api/satellite-image")
def satellite_image():
    # 1) Cache varsa Google'a hiç gitme (evaluator anahtarsız çalıştırabilsin).
    if SATELLITE_CACHE.exists():
        return FileResponse(SATELLITE_CACHE, media_type="image/png")

    # 2) Cache yok ve anahtar da yoksa: açıklayıcı hata
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Görüntü cache'te yok ve GOOGLE_MAPS_API_KEY tanımlı değil. "
                   "backend/.env dosyasına anahtar ekleyin ya da data/satellite.png sağlayın.",
        )

    # 3) Google Static Maps'ten çek, diske kaydet, döndür
    params = {
        "center": f"{FIXED_LAT},{FIXED_LON}",
        "zoom": ZOOM,
        "size": f"{SIZE}x{SIZE}",
        "scale": SCALE,
        "maptype": "satellite",
        "key": GOOGLE_MAPS_API_KEY,
    }
    resp = httpx.get(
        "https://maps.googleapis.com/maps/api/staticmap",
        params=params,
        timeout=30,
    )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Google Static Maps hatası ({resp.status_code}): {resp.text[:200]}",
        )

    SATELLITE_CACHE.write_bytes(resp.content)
    return FileResponse(SATELLITE_CACHE, media_type="image/png")


@app.get("/api/roof")
def roof():
    if not (DATA_DIR / "roof.json").exists():
        raise HTTPException(
            status_code=404,
            detail="data/roof.json bulunamadı — önce işaretleme adımını tamamlayın.",
        )
    mpp = meters_per_pixel(FIXED_LAT, ZOOM, SCALE)
    return build_roof_model(mpp)


@app.get("/api/panels")
def panels(kwp: float = 6.0):
    if kwp not in (3.6, 6.0, 9.6):
        raise HTTPException(status_code=400,
                            detail="kwp yalnızca 3.6, 6.0 veya 9.6 olabilir.")
    if not (DATA_DIR / "roof.json").exists():
        raise HTTPException(status_code=404, detail="data/roof.json bulunamadı.")
    mpp = meters_per_pixel(FIXED_LAT, ZOOM, SCALE)
    model = build_roof_model(mpp)
    return place_panels(model, kwp, mpp, FIXED_LAT, FIXED_LON)


@app.get("/api/analysis")
def analysis(kwp: float = 6.0):
    if kwp not in (3.6, 6.0, 9.6):
        raise HTTPException(status_code=400,
                            detail="kwp yalnızca 3.6, 6.0 veya 9.6 olabilir.")
    if not (DATA_DIR / "roof.json").exists():
        raise HTTPException(status_code=404, detail="data/roof.json bulunamadı.")
    _, result = run_pipeline(kwp)
    if result is None:
        raise HTTPException(status_code=503,
                            detail="PVGIS verisi yok (ağ + cache bulunamadı).")
    return result


# ---------------- Chat ----------------

class ChatStartIn(BaseModel):
    lang: str = "en"


class ChatMessageIn(BaseModel):
    conversationId: str
    message: str
    lang: str = "en"


@app.post("/api/chat/start")
def chat_start(body: ChatStartIn | None = None):
    lang = body.lang if body else "en"
    cid, messages = start_conversation(lang)
    return {"conversationId": cid, "messages": messages}


@app.post("/api/chat/message")
def chat_message(body: ChatMessageIn):
    messages = handle_message(body.conversationId, body.message, body.lang)
    if messages is None:
        raise HTTPException(status_code=404,
                            detail="Konuşma bulunamadı; sayfayı yenileyin.")
    return {"messages": messages}


# ---------------- PDF Raporu ----------------

class ReportIn(BaseModel):
    kwp: float
    sceneImage: str | None = None
    lang: str = "en"


@app.post("/api/report")
def report(body: ReportIn):
    if body.kwp not in (3.6, 6.0, 9.6):
        raise HTTPException(status_code=400,
                            detail="kwp yalnızca 3.6, 6.0 veya 9.6 olabilir.")
    _, a = run_pipeline(body.kwp)
    if a is None:
        raise HTTPException(status_code=503,
                            detail="PVGIS verisi yok; rapor üretilemiyor.")
    png = None
    if body.sceneImage and "," in body.sceneImage:
        try:
            png = base64.b64decode(body.sceneImage.split(",", 1)[1])
        except Exception:
            png = None
    pdf = build_pdf(a, png, body.lang)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition":
                 f'attachment; filename="solar-feasibility-{body.kwp}kWp.pdf"'},
    )


@app.get("/api/proposals/{pid}")
def proposals_get(pid: str):
    p = get_proposal(pid)
    if p is None:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı.")
    return p


@app.post("/api/proposals/{pid}/view")
def proposals_view(pid: str):
    if not record_view(pid):
        raise HTTPException(status_code=404, detail="Teklif bulunamadı.")
    p = get_proposal(pid)
    status = notify_proposal_viewed(pid, p["viewCount"])
    return {"ok": True, "viewCount": p["viewCount"], "notify": status}