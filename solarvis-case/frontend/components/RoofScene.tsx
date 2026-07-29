"use client";

import { useEffect, useState } from "react";
import { Stage, Layer, Image as KonvaImage } from "react-konva";

// Koordinat sistemimiz: görüntünün GERÇEK pikselleri (1280x1280).
// Ekranda yarı boyutta (640) gösteriyoruz; Stage'i ölçekliyoruz.
// Böylece tüm ölçümler/çatı koordinatları tek bir kanonik uzayda kalıyor.
const IMG_PX = 1280;
const DISPLAY_PX = 640;
const VIEW_SCALE = DISPLAY_PX / IMG_PX; // 0.5

type MapMeta = {
  lat: number;
  lon: number;
  metersPerPixel: number;
  imageSizePx: number;
};

export default function RoofScene() {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [meta, setMeta] = useState<MapMeta | null>(null);

  useEffect(() => {
    const image = new window.Image();
    // İleride (PDF adımında) canvas'ı PNG'ye çevireceğiz;
    // crossOrigin olmazsa canvas "tainted" olur ve toDataURL patlar.
    image.crossOrigin = "anonymous";
    image.src = "http://localhost:8000/api/satellite-image";
    image.onload = () => setImg(image);

    fetch("http://localhost:8000/api/map-meta")
      .then((r) => r.json())
      .then(setMeta);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      <Stage
        width={DISPLAY_PX}
        height={DISPLAY_PX}
        scaleX={VIEW_SCALE}
        scaleY={VIEW_SCALE}
        className="rounded-lg overflow-hidden shadow"
      >
        <Layer>
          {img && <KonvaImage image={img} width={IMG_PX} height={IMG_PX} />}
        </Layer>
      </Stage>
      {meta && (
        <p className="text-sm text-gray-500">
          Ölçek: {meta.metersPerPixel.toFixed(4)} m/px — görüntü{" "}
          {(meta.metersPerPixel * meta.imageSizePx).toFixed(0)} m ×{" "}
          {(meta.metersPerPixel * meta.imageSizePx).toFixed(0)} m alan kaplıyor
        </p>
      )}
    </div>
  );
}