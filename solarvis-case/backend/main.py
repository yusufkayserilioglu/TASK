import math
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from roof import build_roof_model

from panels import place_panels

from config import FIXED_LAT, FIXED_LON, ZOOM, SCALE, SIZE, IMG_PX, meters_per_pixel

from pipeline import run_pipeline

from pydantic import BaseModel

from chat import handle_message, start_conversation

class ChatMessageIn(BaseModel):
    conversationId: str
    message: str


load_dotenv()  # backend/.env dosyasındaki anahtarları okur

app = FastAPI(title="solarVis Case API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# config ve pipeline çözdü
# --- Sabitler ---------------------------------------------------------------
# Case'teki koordinat (34.046..., 18.464...) pozitif enlemle Akdeniz'de denize
# düşüyor; case görsellerindeki mahalle Cape Town'a ait. Bu yüzden enlemi
# negatif alıyoruz. (README ve DECISIONS.md'ye not düşülecek.)
# FIXED_LAT = -34.04658242871865
# FIXED_LON = 18.46491476666948
# ZOOM = 20
# SCALE = 2              # Google'dan 2x (retina) çözünürlük iste
# SIZE = 640             # istek boyutu; scale=2 ile gelen görüntü 1280x1280 px
# IMG_PX = SIZE * SCALE  # 1280 — tüm piksel koordinat sistemimiz bu boyutta

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
SATELLITE_CACHE = DATA_DIR / "satellite.png"

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

# config ve pipeline çözdü
# def meters_per_pixel(lat: float, zoom: int, scale: int) -> float:
#     """Web Mercator'da bu enlemde 1 pikselin kaç metre olduğu.

#     156543.03392 = 2 * pi * 6378137 (Dünya yarıçapı) / 256
#     yani zoom 0'da, ekvatorda, tek tile'lık dünyada metre/piksel.
#     Her zoom seviyesi çözünürlüğü ikiye katlar (2**zoom),
#     scale=2 retina görüntüde her piksel yarı mesafeye denk gelir.
#     """
#     return 156543.03392 * math.cos(math.radians(lat)) / (2 ** zoom) / scale


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
    # 1) Cache varsa Google'a hiç gitme.
    #    Evaluator'ın API anahtarı olmayacak; repo'ya koyacağımız bu cache
    #    sayesinde proje anahtarsız da çalışacak.
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


@app.post("/api/chat/start")
def chat_start():
    cid, messages = start_conversation()
    return {"conversationId": cid, "messages": messages}


@app.post("/api/chat/message")
def chat_message(body: ChatMessageIn):
    messages = handle_message(body.conversationId, body.message)
    if messages is None:
        raise HTTPException(status_code=404,
                            detail="Konuşma bulunamadı; sayfayı yenileyin.")
    return {"messages": messages}