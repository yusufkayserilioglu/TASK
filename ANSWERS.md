# Questions & Answers

## 1. If I were to add 3 new features to this case, which ones would I add?

**a) Shading analysis.** Orientation is only half of the yield story; the
other half is shade. I would add a sun-path model combined with obstacle
geometry (neighboring buildings and trees from a DSM/LIDAR layer, or drawn
by the user on the same canvas) to compute per-panel hourly shading
factors. This changes both the placement algorithm (avoid chronically
shaded zones instead of purely filling the best-oriented facet) and the
production estimate. It is the single biggest accuracy lever after azimuth
and tilt, and it directly reuses the geometry pipeline this case already
built.

**b) Battery storage + hourly self-consumption simulation.** The case's
annual `min(production, consumption)` rule is a good approximation, but the
product-grade version is an 8,760-hour simulation: PVGIS hourly series on
the production side, a load profile on the consumption side, and battery
capacity as a design variable. That unlocks self-consumption /
self-sufficiency ratios, time-of-use tariffs, and net-metering vs feed-in
scenarios — exactly the financial story that closes sales, presented on the
same cumulative-cashflow visual.

**c) AI roof detection for any address.** Generalize beyond the fixed demo
roof: a segmentation model detects facets and ridge lines from the
satellite image (the project solarVis is already running), fits the same
compact parametric model I used (corners + ridge endpoints), and a
human-in-the-loop correction UI — my one-time marking tool is effectively
the seed of that editor. This is the feature that turns the demo into a
product for any lat/lon.

*(Different idea: a **manual editing mode** — user-entered roof
dimensions and drag-and-drop panel placement — as the human-in-the-loop
counterpart of the automated flow (my one-time marking tool is the seed of
that editor); multi-variant proposal comparison for the same roof; and CRM +
e-signature integration on the shareable proposal page.)*

## 2. Thinking about the future of this project, what are the potential technical bottlenecks?

- **AI facet-detection accuracy and error propagation.** A few pixels of
  segmentation error become tens of centimeters of edge length and a wrong
  panel count. Confidence scoring, human review queues, and tolerance-aware
  placement are needed before measurements can be trusted commercially.
- **Imagery cost, quota and quality.** Google Static Maps pricing and
  request quotas at scale; imagery recency (new construction), off-nadir
  distortion and occlusion. Mitigations: tile caching (this case already
  ships a cache-first layer), alternative providers, and true orthophotos
  for guarantee-grade measurements — pixel→meter accuracy degrades with
  parallax on tall roofs.
- **External dependency on PVGIS.** Rate limits (~30 req/s) and
  availability make it unsuitable as a synchronous per-request dependency.
  The linearity-in-peakpower + aspect-quantized caching used here scales
  naturally into precomputed irradiance grids per region.
- **Hourly simulation compute.** Moving from an annual rule to 8,760-step
  simulations across thousands of proposals demands vectorization, result
  caching keyed by (location, azimuth, tilt), and a background worker
  queue.
- **Document generation at scale.** PDF rendering is CPU-bound; at volume
  it belongs in an async job queue with object storage 
- **Share-link security and tracking noise.** Unauthenticated proposal
  URLs leak customer data at scale — signed URLs with expiry (or auth) are
  needed; per-view notifications require debouncing/first-view filtering
  so the sales team gets signal, not spam.

---

# Sorular & Cevaplar (Türkçe)

## 1. Bu case'e 3 yeni özellik ekleyecek olsam hangilerini eklerdim?

**a) Gölge analizi.** Yönelim, verim hikâyesinin yalnızca yarısı; diğer
yarısı gölge. Güneş yolu modelini engel geometrisiyle (DSM/LIDAR
katmanından ya da kullanıcının aynı tuval üzerinde çizdiği komşu binalar ve
ağaçlar) birleştirip panel başına saatlik gölgelenme katsayıları
hesaplardım. Bu hem yerleşim algoritmasını (yalnızca en iyi yönelimli
yüzeyi doldurmak yerine kronik gölgeli bölgelerden kaçınmak) hem de üretim
tahminini değiştirir. Azimut ve eğimden sonra doğruluğu en çok artıran tek
kalemdir ve bu case'in kurduğu geometri hattını doğrudan yeniden kullanır.

**b) Batarya depolama + saatlik öz-tüketim simülasyonu.** Case'in yıllık
min(üretim, tüketim) kuralı iyi bir yaklaşımdır; ürün seviyesi ise 8.760
saatlik simülasyondur: üretim tarafında PVGIS saatlik serileri, tüketim
tarafında bir yük profili ve tasarım değişkeni olarak batarya kapasitesi.
Bu; öz-tüketim / öz-yeterlilik oranlarını, zamana bağlı tarifeleri ve
net-metering'e karşı şebekeye satış senaryolarını açar — satışı kapatan
finansal hikâyenin ta kendisi, aynı kümülatif nakit akışı görseli üzerinde
sunulur.

**c) Herhangi bir adres için yapay zekâ ile çatı tespiti.** Sabit demo
çatının ötesine genelleme: bir segmentasyon modeli uydu görüntüsünden
facetleri ve mahya çizgilerini tespit eder (solarVis'in zaten yürüttüğü
proje), benim kullandığım kompakt parametrik modele (köşeler + mahya
uçları) otomatik oturtulur; insan-döngüde (human-in-the-loop) düzeltme
arayüzü eklenir — tek seferlik işaretleme aracım fiilen o editörün
tohumudur. Demoyu herhangi bir enlem/boylam için ürüne dönüştüren özellik
budur.

*(Farklı fikir: otomatik akışın insan-döngüde karşılığı olarak **manuel
düzenleme modu** — kullanıcının çatı ölçülerini elle girmesi ve panelleri
sürükle-bırak yerleştirmesi; aynı çatı için çok-varyantlı teklif
karşılaştırması; paylaşılabilir teklif sayfasında CRM + e-imza
entegrasyonu.)*

## 2. Projenin geleceğini düşününce olası teknik darboğazlar neler?

- **Yapay zekâ facet tespitinin doğruluğu ve hata yayılımı.** Birkaç
  piksellik segmentasyon hatası, onlarca santimetrelik kenar uzunluğuna ve
  yanlış panel sayısına dönüşür. Ölçümlere ticari olarak güvenilebilmesi
  için güven skorları, insan inceleme kuyrukları ve toleransa duyarlı
  yerleşim gerekir.
- **Görüntü maliyeti, kotası ve kalitesi.** Ölçekte Google Static Maps
  fiyatlandırması ve istek kotaları; görüntü güncelliği (yeni yapılar),
  nadir-dışı (off-nadir) bozulma ve örtülme. Çözümler: tile önbellekleme
  (bu case cache-first katmanıyla geliyor), alternatif sağlayıcılar ve
  garanti sınıfı ölçüm için gerçek ortofotolar — yüksek çatılarda paralaks
  nedeniyle piksel→metre doğruluğu düşer.
- **PVGIS'e dış bağımlılık.** Rate limit (~30 istek/sn) ve erişilebilirlik,
  onu istek başına eşzamanlı bir bağımlılık olmaktan çıkarır. Burada
  kullanılan "peakpower'da lineerlik + aspect'e göre kuantalanmış
  önbellekleme" yaklaşımı, bölge başına önceden hesaplanmış ışınım
  gridlerine doğal olarak ölçeklenir.
- **Saatlik simülasyon hesabı.** Yıllık kuraldan binlerce teklifte 8.760
  adımlı simülasyona geçiş; vektörizasyon, (konum, azimut, eğim) anahtarlı
  sonuç önbelleği ve arka plan işçi kuyruğu gerektirir.
- **Ölçekte doküman üretimi.** PDF render CPU-yoğun bir iştir; hacimde,
  eşzamanlı istek/yanıt yerine asenkron iş kuyruğu + nesne depolama 
- **Paylaşım linki güvenliği ve bildirim gürültüsü.** Kimlik doğrulamasız
  teklif URL'leri ölçekte müşteri verisi sızdırır — süreli imzalı URL'ler
  (veya kimlik doğrulama) gerekir; görüntüleme başına bildirimler, satış
  ekibinin spam değil sinyal alması için debouncing / ilk-görüntüleme
  filtresi ister.