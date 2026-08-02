# solarVis Case — AI-Powered Solar Proposal Flow

A minimal, fully automated solar proposal experience driven by a chat
interface: location → consumption → system size → automatic panel placement
on a real roof → PVGIS yield → 20-year financials → PDF report → shareable
web proposal.

Built with **Next.js (App Router, TypeScript, Tailwind)** on the frontend and
**FastAPI (Python)** on the backend, as required by the case.

---

## Quick start — no API keys required

Prerequisites: **Node.js ≥ 20** and **Python ≥ 3.11**.

**Backend** (terminal 1):

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows  |  macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

→ API docs at http://localhost:8000/docs

**Frontend** (terminal 2):

```bash
cd frontend
npm install
npm run dev
```

→ App at http://localhost:3000

> **Runs fully offline / key-free.** The satellite image
> (`backend/data/satellite.png`) and all PVGIS responses
> (`backend/data/pvgis_cache/`) are committed to the repo, so evaluating the
> project requires **no Google Maps key and no internet access**. Keep both
> servers running while using the app.

## Optional environment variables

Copy `backend/.env.example` to `backend/.env` if you want live integrations.
Everything is optional — the app has fallbacks for all of them:

| Variable | Purpose | Without it |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Re-fetch the satellite image if the cache is deleted | committed cache is served |
| `RESEND_API_KEY` + `SALES_EMAIL` | Real e-mail notification when a proposal is viewed (bonus) | notification is logged to the backend console |

## What to try

1. **Chat flow** (http://localhost:3000): solarVis AI starts the
   conversation. Type any location (it transparently resolves to the fixed
   demo site — see the coordinate note below), any consumption (fixed to
   1,150 kWh with an explanation), then pick **3.6 / 6 / 9.6 kWp**.
2. You are redirected to the **shareable proposal page**: 2D scene with
   real-world measurements (hover edges/facets, arrow leaders), **2D/3D
   toggle** (orbit controls, facet badges with hover/click detail cards,
   edge length chips), a plain-language **Proposal Summary**, the financial
   analysis with a 20-year cumulative chart, **PDF download**, copy-link and
   an **EN/TR language toggle** (persisted; the PDF follows the selected
   language).
3. **Tracking bonus**: opening a proposal link fires a view event — watch
   the backend console for the `[notify]` line (or receive a real e-mail if
   Resend is configured). Proposal links survive backend restarts (SQLite).
4. Try **9.6 kWp**: this roof physically fits 15 panels (6 kWp). The app
   sizes the system honestly, tells the customer why, and runs the
   financials on the achievable size.
5. **Engineering view**: http://localhost:3000/debug — kWp switcher,
   per-facet capacity, full-image/focus toggle, 2D/3D.
6. **Tests**: from `backend/` run `python -m pytest -q` → **17 passed**.

## Implementation notes

- **Coordinate correction:** the case coordinate `34.04658, 18.46491` with a
  positive latitude falls in the open Mediterranean Sea, while the case
  imagery matches a Cape Town suburb. All computations therefore use
  **`-34.04658242871865, 18.46491476666948`**. Southern hemisphere ⇒
  **north-facing facets perform best**, confirmed by PVGIS
  (N 1748.6 vs S 1152.5 kWh/kWp/yr).
- **Pixel → meter scale:** `156543.03392 × cos(lat) / 2^zoom / scale`
  (zoom 20, scale 2 ⇒ **0.0619 m/px**; the 1280 px image spans ~79 m).
  Unit-tested; sanity-checked against the ~11 m eaves / ~73 m² footprint.
- **Roof model:** 4 outer corners + 2 ridge ends captured once with a
  built-in marking tool and frozen as `backend/data/roof.json`. A single
  "nearest ridge end" rule derives the 4 facets (2 trapezoids + 2 triangles)
  and all 9 edges. Facet azimuth = outward eave normal
  (`atan2(dx, -dy)` in image space); true area = projected / cos 25°.
- **Panel placement:** each facet is unfolded onto its sloped plane
  (distances perpendicular to the eave × 1/cos 25°), inset by a 0.3 m
  margin, and filled with a shapely grid; **portrait and landscape
  orientations are both tried per facet** and the better one wins. Facets
  are filled in order of PVGIS specific yield.
- **PVGIS:** `PVcalc` output is linear in `peakpower`, so each azimuth is
  queried once with `peakpower=1` (4 calls total); ranking and production
  (yield × kWp) both derive from it. Responses are cached on disk and
  committed. If both network and cache are missing, a compass-based
  fallback ranking keeps the app functional with a clear message.
- **Financials (case methodology):** savings = min(annual production,
  13,800 kWh) × €0.25; CAPEX $10,000 treated 1:1 with EUR (a case
  inconsistency, documented here and in the UI footnote); flat tariff, no
  degradation. 6 kWp ⇒ ~8,383 kWh/yr, 61% coverage, ~€2,096/yr,
  **payback ≈ 4.8 years**, ~€31,915 net over 20 years.
- **PDF:** generated with **fpdf2** (pure Python — avoids WeasyPrint's GTK
  system dependency on Windows). DejaVu Sans is embedded for full Turkish
  glyph support, with an ASCII transliteration fallback if the fonts are
  missing. The 2D scene snapshot is captured **hover-free** via a
  render-level "shooting" mode and posted to the backend.
- **Architecture:** all geometry, placement and finance are deterministic
  Python in the backend (single source of truth, 17 tests). The chat is a
  small state machine; a `naturalize()` hook exists for an optional LLM
  language layer and is intentionally a no-op — AI drives the conversation
  UX, never the numbers.

## Project structure

```
backend/
  main.py            FastAPI app & endpoints
  config.py          fixed coordinate, zoom, pixel→meter scale
  roof.py            6-point roof → 4 facets, 9 edges, azimuths, areas
  panels.py          unfold + grid placement + orientation optimization
  pvgis.py           specific yield (cache-first) + aspect conversion
  finance.py         savings / payback / 20-year cashflow
  pipeline.py        end-to-end computation used by chat, API and PDF
  chat.py            bilingual state machine (EN/TR)
  report.py          bilingual PDF (fpdf2, embedded DejaVu)
  db.py / notify.py  SQLite proposals + view tracking (Resend/console)
  data/              satellite.png, roof.json, pvgis_cache/  (committed)
  fonts/             DejaVu Sans (for Turkish PDF)
  test_*.py          17 tests
frontend/
  app/               / (chat) · /proposal/[id] · /debug
  components/        RoofScene (2D) · Scene3D · AnalysisSection ·
                     ProposalSummary · ChatPanel · LanguageProvider
  lib/i18n.ts        EN/TR dictionary
```

## Known limitations (by design — see ANSWERS.md)

Single fixed roof (per the case), no shading model, flat tariff / no
degradation, unauthenticated share links, a notification on every view.
The proposal URL is `http://localhost:3000/proposal/{id}` since the case
explicitly does not require deployment; in production this would be a
public domain.

---

# solarVis Case — Yapay Zekâ Destekli Güneş Enerjisi Teklif Akışı (Türkçe)

> Bu bölüm, yukarıdaki İngilizce README'nin Türkçe çevirisidir.

Konum → tüketim → sistem boyutu → gerçek bir çatıya otomatik panel yerleşimi
→ PVGIS verimi → 20 yıllık finansal analiz → PDF raporu → paylaşılabilir web
teklifi zincirini uçtan uca bir sohbet arayüzü üzerinden yöneten, minimal ve
tamamen otomatik bir güneş enerjisi teklif deneyimi.

Case'in gerektirdiği şekilde frontend'de **Next.js (App Router, TypeScript,
Tailwind)**, backend'de **FastAPI (Python)** kullanılarak geliştirildi.

---

## Hızlı başlangıç — API anahtarı gerekmez

Ön koşullar: **Node.js ≥ 20** ve **Python ≥ 3.11**.

**Backend** (1. terminal):

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows  |  macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

→ API dokümantasyonu http://localhost:8000/docs adresinde

**Frontend** (2. terminal):

```bash
cd frontend
npm install
npm run dev
```

→ Uygulama http://localhost:3000 adresinde

> **Tamamen offline / anahtarsız çalışır.** Uydu görüntüsü
> (`backend/data/satellite.png`) ve tüm PVGIS yanıtları
> (`backend/data/pvgis_cache/`) repoya commit edilmiştir, bu yüzden projeyi
> değerlendirmek için **Google Maps anahtarı ya da internet erişimi
> gerekmez**. Uygulamayı kullanırken her iki sunucuyu da çalışır durumda
> tutun.

## Opsiyonel ortam değişkenleri

Canlı entegrasyonlar istiyorsanız `backend/.env.example` dosyasını
`backend/.env` olarak kopyalayın. Hepsi opsiyoneldir — uygulamanın her biri
için bir fallback'i var:

| Değişken | Amacı | Olmadan |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Cache silinirse uydu görüntüsünü yeniden çeker | commit edilmiş cache sunulur |
| `RESEND_API_KEY` + `SALES_EMAIL` | Bir teklif görüntülendiğinde gerçek e-posta bildirimi (bonus) | bildirim backend konsoluna loglanır |

## Neler denenebilir

1. **Sohbet akışı** (http://localhost:3000): solarVis AI konuşmayı başlatır.
   Herhangi bir konum yazın (şeffaf şekilde sabit demo sahaya çözümlenir —
   aşağıdaki koordinat notuna bakın), herhangi bir tüketim yazın
   (açıklamasıyla birlikte 1.150 kWh'a sabitlenir), sonra **3,6 / 6 / 9,6
   kWp** seçeneklerinden birini seçin.
2. **Paylaşılabilir teklif sayfasına** yönlendirilirsiniz: gerçek dünya
   ölçüleriyle 2D sahne (kenarlar/facetler üzerine gelince detay, ok
   işaretçileri), **2D/3D geçişi** (orbit kontrolleri, hover/tıklama detay
   kartlı facet rozetleri, kenar uzunluk etiketleri), sade dilde bir
   **Teklif Özeti**, 20 yıllık kümülatif grafikle finansal analiz, **PDF
   indirme**, link kopyalama ve (kalıcı; PDF de seçilen dili takip eder) bir
   **EN/TR dil geçişi**.
3. **Takip bonusu**: bir teklif linkini açmak bir görüntülenme olayı
   tetikler — backend konsolunda `[notify]` satırını izleyin (ya da Resend
   yapılandırılmışsa gerçek bir e-posta alın). Teklif linkleri backend
   yeniden başlatılsa da hayatta kalır (SQLite).
4. **9,6 kWp**'yi deneyin: bu çatıya fiziksel olarak en fazla 15 panel (6
   kWp) sığıyor. Uygulama sistemi dürüstçe boyutlandırıyor, müşteriye
   nedenini söylüyor ve finansalları ulaşılabilir boyut üzerinden
   hesaplıyor.
5. **Mühendislik görünümü**: http://localhost:3000/debug — kWp seçici,
   facet başına kapasite, tam görüntü/çatıya odaklan geçişi, 2D/3D.
6. **Testler**: `backend/` içinden `python -m pytest -q` çalıştırın → **17
   geçti**.

## Uygulama notları

- **Koordinat düzeltmesi:** case'in verdiği `34,04658, 18,46491` koordinatı
  pozitif enlemle açık Akdeniz'e düşerken, case görselleri bir Cape Town
  mahallesiyle eşleşiyor. Bu yüzden tüm hesaplamalar
  **`-34.04658242871865, 18.46491476666948`** değerini kullanıyor. Güney
  yarımküre ⇒ **kuzeye bakan facetler en iyi performansı veriyor**, PVGIS
  ile doğrulandı (K 1748,6'ya karşı G 1152,5 kWh/kWp/yıl).
- **Piksel → metre ölçeği:** `156543.03392 × cos(enlem) / 2^zoom / scale`
  (zoom 20, scale 2 ⇒ **0,0619 m/px**; 1280 piksellik görüntü ~79 m'yi
  kapsıyor). Birim testli; ~11 m'lik saçaklar / ~73 m²'lik taban alanına
  karşı mantık kontrolü yapıldı.
- **Çatı modeli:** yerleşik bir işaretleme aracıyla bir kez yakalanan 4 dış
  köşe + 2 mahya ucu, `backend/data/roof.json` olarak donduruldu. Tek bir
  "en yakın mahya ucu" kuralı 4 facet'i (2 yamuk + 2 üçgen) ve 9 kenarın
  tamamını türetiyor. Facet azimutu = dışa bakan saçak normali (görüntü
  uzayında `atan2(dx, -dy)`); gerçek alan = izdüşüm / cos 25°.
- **Panel yerleşimi:** her facet eğik düzlemine "açılıyor" (saçağa dik
  mesafeler × 1/cos 25°), 0,3 m payla içe büzülüyor ve bir shapely gridiyle
  dolduruluyor; **hem dikey hem yatay yönelimler her facet için denenir**
  ve iyisi kazanır. Facetler PVGIS özgül verim sırasına göre doldurulur.
- **PVGIS:** `PVcalc` çıktısı `peakpower` ile lineerdir, bu yüzden her
  azimut `peakpower=1` ile bir kez sorgulanır (toplam 4 çağrı); hem
  sıralama hem üretim (verim × kWp) bundan türetilir. Yanıtlar diske
  cache'lenir ve commit edilir. Hem ağ hem cache yoksa, pusula tabanlı bir
  fallback sıralama uygulamayı açık bir mesajla çalışır tutar.
- **Finansallar (case metodolojisi):** tasarruf = min(yıllık üretim, 13.800
  kWh) × €0,25; CAPEX $10.000, EUR ile 1:1 kabul edildi (case'in kendi
  tutarsızlığı, burada ve arayüz dipnotunda belgelendi); sabit tarife,
  degradasyon yok. 6 kWp ⇒ ~8.383 kWh/yıl, %61 karşılama, ~€2.096/yıl,
  **geri ödeme ≈ 4,8 yıl**, 20 yılda ~€31.915 net kazanç.
- **PDF:** saf Python olan **fpdf2** ile üretiliyor (Windows'ta
  WeasyPrint'in GTK sistem bağımlılığından kaçınmak için). Tam Türkçe glif
  desteği için DejaVu Sans gömülüyor; fontlar yoksa ASCII transliterasyon
  fallback'i devreye giriyor. 2D sahne görüntüsü, render seviyesinde bir
  "çekim" moduyla **hover'sız** yakalanıp backend'e gönderiliyor.
- **Mimari:** tüm geometri, yerleşim ve finans hesapları backend'de
  deterministik Python kodudur (tek doğruluk kaynağı, 17 test). Sohbet
  küçük bir durum makinesidir; opsiyonel bir LLM dil katmanı için bir
  `naturalize()` kancası var ve bilinçli olarak no-op'tur — yapay zekâ
  konuşma deneyimini yönetir, sayıları asla.

## Proje yapısı

```
backend/
  main.py            FastAPI uygulaması ve endpoint'ler
  config.py          sabit koordinat, zoom, piksel→metre ölçeği
  roof.py            6 noktalı çatı → 4 facet, 9 kenar, azimutlar, alanlar
  panels.py          açma + grid yerleşimi + yönelim optimizasyonu
  pvgis.py           özgül verim (cache-first) + aspect dönüşümü
  finance.py         tasarruf / geri ödeme / 20 yıllık nakit akışı
  pipeline.py        chat, API ve PDF tarafından kullanılan uçtan uca hesap
  chat.py            iki dilli durum makinesi (EN/TR)
  report.py          iki dilli PDF (fpdf2, gömülü DejaVu)
  db.py / notify.py  SQLite teklifleri + görüntülenme takibi (Resend/console)
  data/              satellite.png, roof.json, pvgis_cache/  (commit edilmiş)
  fonts/             DejaVu Sans (Türkçe PDF için)
  test_*.py          17 test
frontend/
  app/               / (chat) · /proposal/[id] · /debug
  components/        RoofScene (2D) · Scene3D · AnalysisSection ·
                     ProposalSummary · ChatPanel · LanguageProvider
  lib/i18n.ts        EN/TR sözlüğü
```

## Bilinen kısıtlar (tasarım gereği — bkz. ANSWERS.md)

Sabit tek çatı (case gereği), gölgeleme modeli yok, sabit tarife /
degradasyon yok, kimlik doğrulaması olmayan paylaşım linkleri, her
görüntülemede bildirim. Teklif URL'i `http://localhost:3000/proposal/{id}`
çünkü case açıkça deployment gerektirmiyor; production'da bu genel bir alan
adı olurdu.