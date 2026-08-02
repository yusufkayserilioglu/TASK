export type Lang = "en" | "tr";

const en = {
  chat: {
    subtitle: "AI-powered solar proposal assistant",
    placeholder: "Type your message…",
    send: "Send",
    proposalReady: "Your solar proposal is ready",
    panels: "panels",
    payback: "payback",
    yrs: "yrs",
    viewProposal: "View proposal →",
    openingAuto: "Opening automatically…",
  },
  scene: {
    kind: { eave: "Eave", hip: "Hip", ridge: "Ridge" } as Record<string, string>,
    orientation: { dikey: "portrait", yatay: "landscape" } as Record<string, string>,
    edges: "Edges",
    facetsTitle: "Facets (25° pitch)",
    dir: "Dir",
    azimuth: "Azimuth",
    projected: "Projected",
    trueCol: "True",
    panels: "Panels",
    totalTrue: "Total true area",
    tableNote: "Areas in m² · Panels = placed/capacity · hover rows to highlight",
    fullImage: "Full image",
    focusRoof: "Focus roof",
    placed: (a: number, b: number) => `${a}/${b} panels placed`,
    offline: " — offline ranking",
    capacity: (a: number, b: number) =>
      `Roof capacity limits the system to ${a} of ${b} panels.`,
    length: "Length",
    facet: "Facet",
    trueArea: "True area",
    projectedShort: "Projected",
  },
  analysis: {
    title: "Financial Analysis",
    sized: (k: number) => ` (requested ${k} kWp — sized to roof capacity)`,
    annualProduction: "Annual production",
    coverage: "Coverage",
    annualSavings: "Annual savings",
    payback: "Payback",
    net20: "20-yr net benefit",
    yrs: "yrs",
    year: "Year",
    paybackLine: (p: number) => `Payback ~${p} yrs`,
    series: "Cumulative cash flow",
    footnote: (c: string) =>
      `Simplified model: flat tariff €0.25/kWh · no degradation · savings capped at annual consumption (${c} kWh) · CAPEX $10,000 (≈EUR 1:1)`,
  },
  proposal: {
    title: "Solar Proposal",
    preparedBy: "Prepared by solarVis AI",
    panels: "panels",
    loading: "Loading proposal…",
    backendDown:
      "Cannot reach the backend — make sure uvicorn is running on port 8000.",
    downloadPdf: "Download PDF report",
    preparing: "Preparing PDF…",
    copyLink: "Copy proposal link",
    copied: "Copied ✓",
    newChat: "Start new chat",
    proposalId: "Proposal ID",
    poweredBy: "Powered by solarVis AI",
  },
  scene3d: {
    hint: "Drag to rotate · Scroll to zoom",
    loading: "Loading 3D scene…",
  },
  summary: {
    title: "Proposal Summary",
    prose: (a: {
      kwp: number; n: number; fl: string; prod: string;
      cov: number; sav: string; pay: string; net: string;
    }) =>
      `Based on your inputs — a monthly consumption of 1,150 kWh ` +
      `(13,800 kWh/year) at €0.25/kWh — we designed a ${a.kwp} kWp solar ` +
      `system using ${a.n} × 400 Wp panels (1 m × 2 m each), placed ` +
      `automatically on the best-oriented facets of your roof (${a.fl}). ` +
      `PVGIS simulations estimate an annual production of about ` +
      `${a.prod} kWh, covering roughly ${a.cov}% of your consumption. ` +
      `That saves about €${a.sav} per year: the $10,000 investment pays ` +
      `for itself in ~${a.pay} years and yields ~€${a.net} net benefit ` +
      `over 20 years.`,
    capacityNote: (n: number, kwp: number) =>
      `Your roof physically fits at most ${n} panels, so the system was ` +
      `sized to ${kwp} kWp — the sweet spot for this roof.`,
    facts: {
      systemSize: "System size",
      panelSpec: "Panel",
      placement: "Placement",
      consumption: "Annual consumption",
      production: "Annual production",
      coverage: "Coverage",
      savings: "Annual savings",
      payback: "Payback period",
      net20: "20-year net benefit",
      panelSpecV: (n: number) => `${n} × 400 Wp · 1 m × 2 m`,
      paybackV: (p: string) => `~${p} years`,
    },
  },
};

const tr: typeof en = {
  chat: {
    subtitle: "Yapay zekâ destekli güneş enerjisi teklif asistanı",
    placeholder: "Mesajınızı yazın…",
    send: "Gönder",
    proposalReady: "Güneş enerjisi teklifiniz hazır",
    panels: "panel",
    payback: "geri ödeme",
    yrs: "yıl",
    viewProposal: "Teklifi görüntüle →",
    openingAuto: "Otomatik açılıyor…",
  },
  scene: {
    kind: { eave: "Saçak", hip: "Hip", ridge: "Mahya" },
    orientation: { dikey: "dikey", yatay: "yatay" },
    edges: "Kenarlar",
    facetsTitle: "Facetler (25° eğim)",
    dir: "Yön",
    azimuth: "Azimut",
    projected: "İzdüşüm",
    trueCol: "Gerçek",
    panels: "Panel",
    totalTrue: "Toplam gerçek alan",
    tableNote: "Alanlar m² · Panel = yerleşen/kapasite · vurgulamak için satırların üzerine gelin",
    fullImage: "Tüm görüntü",
    focusRoof: "Çatıya odaklan",
    placed: (a: number, b: number) => `${a}/${b} panel yerleşti`,
    offline: " — çevrimdışı sıralama",
    capacity: (a: number, b: number) =>
      `Çatı kapasitesi nedeniyle ${b} panelden ${a} tanesi yerleştirilebildi.`,
    length: "Uzunluk",
    facet: "Facet",
    trueArea: "Gerçek alan",
    projectedShort: "İzdüşüm",
  },
  analysis: {
    title: "Finansal Analiz",
    sized: (k: number) =>
      ` (istenen ${k} kWp — çatı kapasitesine göre boyutlandırıldı)`,
    annualProduction: "Yıllık üretim",
    coverage: "Karşılama",
    annualSavings: "Yıllık tasarruf",
    payback: "Geri ödeme",
    net20: "20 yıl net kazanç",
    yrs: "yıl",
    year: "Yıl",
    paybackLine: (p: number) => `Geri ödeme ~${p} yıl`,
    series: "Kümülatif nakit akışı",
    footnote: (c: string) =>
      `Basitleştirilmiş model: sabit tarife €0,25/kWh · degradasyon yok · tasarruf yıllık tüketimle (${c} kWh) sınırlı · CAPEX $10.000 (≈EUR 1:1)`,
  },
  proposal: {
    title: "Güneş Enerjisi Teklifi",
    preparedBy: "solarVis AI tarafından hazırlandı",
    panels: "panel",
    loading: "Teklif yükleniyor…",
    backendDown:
      "Backend'e ulaşılamıyor — uvicorn'un 8000 portunda çalıştığından emin olun.",
    downloadPdf: "PDF raporu indir",
    preparing: "PDF hazırlanıyor…",
    copyLink: "Teklif linkini kopyala",
    copied: "Kopyalandı ✓",
    newChat: "Yeni sohbet başlat",
    proposalId: "Teklif No",
    poweredBy: "Powered by solarVis AI",
  },
  scene3d: {
    hint: "Döndürmek için sürükleyin · Kaydırarak yakınlaştırın",
    loading: "3B sahne yükleniyor…",
  },
  summary: {
    title: "Teklif Özeti",
    prose: (a: {
      kwp: number; n: number; fl: string; prod: string;
      cov: number; sav: string; pay: string; net: string;
    }) =>
      `Girdilerinize göre — ayda 1.150 kWh (yılda 13.800 kWh) tüketim ve ` +
      `€0,25/kWh birim fiyat — her biri 1 m × 2 m olan ${a.n} adet 400 Wp ` +
      `panelle ${a.kwp} kWp'lik bir güneş enerjisi sistemi tasarladık; ` +
      `paneller çatınızın en verimli yüzeylerine otomatik yerleştirildi ` +
      `(${a.fl}). PVGIS simülasyonlarına göre yıllık üretim yaklaşık ` +
      `${a.prod} kWh olup tüketiminizin yaklaşık %${a.cov} kadarını ` +
      `karşılar. Bu, yılda yaklaşık €${a.sav} tasarruf demektir: ` +
      `$10.000'lık yatırım ~${a.pay} yılda kendini öder ve 20 yılda ` +
      `~€${a.net} net kazanç sağlar.`,
    capacityNote: (n: number, kwp: number) =>
      `Çatınıza fiziksel olarak en fazla ${n} panel sığıyor; bu yüzden ` +
      `sistem ${kwp} kWp olarak boyutlandırıldı — bu çatı için ideal nokta.`,
    facts: {
      systemSize: "Sistem boyutu",
      panelSpec: "Panel",
      placement: "Yerleşim",
      consumption: "Yıllık tüketim",
      production: "Yıllık üretim",
      coverage: "Karşılama",
      savings: "Yıllık tasarruf",
      payback: "Geri ödeme süresi",
      net20: "20 yıl net kazanç",
      panelSpecV: (n: number) => `${n} adet 400 Wp · 1 m × 2 m`,
      paybackV: (p: string) => `~${p} yıl`,
    },
  },
};

export const STRINGS = { en, tr };