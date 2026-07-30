"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Stage, Layer, Image as KonvaImage, Circle, Line, Text, Label, Tag,
} from "react-konva";

const IMG_PX = 1280;
const DISPLAY_PX = 640;
const FULL_SCALE = DISPLAY_PX / IMG_PX;
const MARKING_MODE = false;

const KIND_TR: Record<string, string> = {
  eave: "Saçak", hip: "Hip", ridge: "Mahya",
};

type Edge = { from: number[]; to: number[]; kind: string; lengthM: number };
type Facet = {
  id: string; polygonPx: number[][]; projectedAreaM2: number;
  trueAreaM2: number; azimuthDeg: number; compass: string;
};
type Roof = {
  cornersPx: number[][]; ridgePx: number[][]; edges: Edge[]; facets: Facet[];
};
type PanelsResp = {
  requestedKwp: number; requestedPanels: number; placedPanels: number;
  warning: string | null; yieldSource: string;
  panels: { facetId: string; polygonPx: number[][] }[];
  perFacet: {
    facetId: string; compass: string; orientation: string;
    specificYield: number | null; capacity: number; placed: number;
  }[];
};
type Hover = { type: "edge" | "facet"; id: number } | null;

export default function RoofScene({
  kwp: kwpProp,
  showControls = true,
  showTable = true,
}: {
  kwp?: number;
  showControls?: boolean;
  showTable?: boolean;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [points, setPoints] = useState<number[][]>([]);
  const [roof, setRoof] = useState<Roof | null>(null);
  const [focus, setFocus] = useState(true);
  const [hover, setHover] = useState<Hover>(null);
  const [kwp, setKwp] = useState(kwpProp ?? 6.0);
  const [pl, setPl] = useState<PanelsResp | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (kwpProp !== undefined) setKwp(kwpProp);
  }, [kwpProp]);

  useEffect(() => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.src = "http://localhost:8000/api/satellite-image";
    image.onload = () => setImg(image);

    if (!MARKING_MODE) {
      setErr("");
      fetch("http://localhost:8000/api/roof")
        .then(async (r) => {
          if (!r.ok) throw new Error((await r.json()).detail);
          return r.json();
        })
        .then(setRoof)
        .catch((e) => setErr(String(e)));
    }
  }, []);

  useEffect(() => {
    if (MARKING_MODE) return;
    setErr("");
    setPl(null);
    fetch(`http://localhost:8000/api/panels?kwp=${kwp}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail);
        return r.json();
      })
      .then(setPl)
      .catch((e) => setErr(String(e)));
  }, [kwp]);

  const view = useMemo(() => {
    if (!roof || !focus || MARKING_MODE)
      return { scale: FULL_SCALE, x: 0, y: 0 };
    const pts = [...roof.cornersPx, ...roof.ridgePx];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    let minX = Math.min(...xs), maxX = Math.max(...xs);
    let minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 0.35 * Math.max(maxX - minX, maxY - minY);
    minX -= pad; maxX += pad; minY -= pad; maxY += pad;
    const size = Math.max(maxX - minX, maxY - minY);
    const scale = DISPLAY_PX / size;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    return {
      scale,
      x: DISPLAY_PX / 2 - cx * scale,
      y: DISPLAY_PX / 2 - cy * scale,
    };
  }, [roof, focus]);

  const center = useMemo(() => {
    if (!roof) return [0, 0];
    const c = roof.cornersPx;
    return [
      c.reduce((s, p) => s + p[0], 0) / c.length,
      c.reduce((s, p) => s + p[1], 0) / c.length,
    ];
  }, [roof]);

  function handleClick(e: any) {
    if (!MARKING_MODE || points.length >= 6) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const t = stage.getAbsoluteTransform().copy().invert();
    const p = t.point(pos);
    setPoints([...points, [Math.round(p.x), Math.round(p.y)]]);
  }

  const json =
    points.length === 6
      ? JSON.stringify({
          imageSizePx: IMG_PX,
          corners: points.slice(0, 4),
          ridge: points.slice(4),
        })
      : null;

  const centroid = (poly: number[][]) => [
    poly.reduce((s, p) => s + p[0], 0) / poly.length,
    poly.reduce((s, p) => s + p[1], 0) / poly.length,
  ];

  const totalTrue = roof
    ? roof.facets.reduce((s, f) => s + f.trueAreaM2, 0)
    : 0;

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* ---------------- SAHNE ---------------- */}
      <div
        className="flex flex-col items-center gap-2"
        style={{ cursor: hover ? "pointer" : "default" }}
      >
        <Stage
          width={DISPLAY_PX} height={DISPLAY_PX}
          scaleX={view.scale} scaleY={view.scale}
          x={view.x} y={view.y}
          onClick={handleClick}
          className="rounded-lg overflow-hidden shadow"
        >
          <Layer>
            {img && <KonvaImage image={img} width={IMG_PX} height={IMG_PX} />}

            {MARKING_MODE &&
              points.map((p, i) => (
                <Circle key={i} x={p[0]} y={p[1]} radius={7}
                  fill={i < 4 ? "#ef4444" : "#3b82f6"}
                  stroke="white" strokeWidth={2} />
              ))}

            {/* Facet dolguları (hover yakalayıcı) */}
            {roof?.facets.map((f, i) => (
              <Line
                key={`fill-${f.id}`}
                points={f.polygonPx.flat()}
                closed
                fill={
                  hover?.type === "facet" && hover.id === i
                    ? "rgba(250,204,21,0.30)"
                    : "rgba(0,0,0,0.01)"
                }
                onMouseEnter={() => setHover({ type: "facet", id: i })}
                onMouseLeave={() => setHover(null)}
              />
            ))}

            {/* Paneller */}
            {pl?.panels.map((p, i) => (
              <Line key={`panel-${i}`}
                points={p.polygonPx.flat()}
                closed
                fill="#16283f"
                stroke="rgba(255,255,255,0.75)"
                strokeWidth={0.8}
                listening={false}
              />
            ))}

            {/* 9 kenar */}
            {roof?.edges.map((e, i) => {
              const hovered = hover?.type === "edge" && hover.id === i;
              return (
                <Line key={i}
                  points={[e.from[0], e.from[1], e.to[0], e.to[1]]}
                  stroke={hovered ? "#facc15" : "white"}
                  strokeWidth={hovered ? 4 : 2}
                  hitStrokeWidth={18}
                  shadowColor="black" shadowBlur={4} shadowOpacity={0.9}
                  onMouseEnter={() => setHover({ type: "edge", id: i })}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}

            {/* Kenar etiketleri */}
            {roof?.edges.map((e, i) => {
              const hovered = hover?.type === "edge" && hover.id === i;
              const mx = (e.from[0] + e.to[0]) / 2;
              const my = (e.from[1] + e.to[1]) / 2;
              let lx = mx, ly = my;
              if (e.kind !== "ridge") {
                const dx = e.to[0] - e.from[0], dy = e.to[1] - e.from[1];
                const len = Math.hypot(dx, dy) || 1;
                let nx = -dy / len, ny = dx / len;
                if (nx * (mx - center[0]) + ny * (my - center[1]) < 0) {
                  nx = -nx; ny = -ny;
                }
                const push = hovered ? 34 : 22;
                lx = mx + nx * push; ly = my + ny * push;
              }
              return (
                <Label key={`l${i}`} x={lx} y={ly}
                  offsetX={hovered ? 40 : 16} offsetY={hovered ? 13 : 8}
                  listening={false} opacity={hovered ? 1 : 0.8}>
                  <Tag
                    fill={hovered ? "rgba(202,138,4,0.95)" : "rgba(0,0,0,0.55)"}
                    cornerRadius={3}
                  />
                  <Text
                    text={hovered ? `${KIND_TR[e.kind]} · ${e.lengthM} m` : `${e.lengthM}`}
                    fontSize={hovered ? 16 : 10}
                    fill="white" padding={hovered ? 5 : 2}
                  />
                </Label>
              );
            })}

            {/* Facet etiketleri */}
            {roof?.facets.map((f, i) => {
              const hovered = hover?.type === "facet" && hover.id === i;
              const [cx, cy] = centroid(f.polygonPx);
              return (
                <Label key={f.id} x={cx} y={cy}
                  offsetX={hovered ? 62 : 9} offsetY={hovered ? 26 : 9}
                  listening={false}>
                  <Tag
                    fill={hovered ? "rgba(202,138,4,0.95)" : "rgba(0,0,0,0.55)"}
                    cornerRadius={3}
                  />
                  <Text
                    text={
                      hovered
                        ? `${f.compass} · ${f.azimuthDeg}°\nGerçek: ${f.trueAreaM2} m²\nİzdüşüm: ${f.projectedAreaM2} m²`
                        : f.compass
                    }
                    fontSize={hovered ? 14 : 11}
                    fill="white" padding={hovered ? 6 : 2}
                  />
                </Label>
              );
            })}
          </Layer>
        </Stage>

        {!MARKING_MODE && showControls && (
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-2">
              {[3.6, 6.0, 9.6].map((k) => (
                <button key={k} onClick={() => setKwp(k)}
                  className={`px-3 py-1 rounded text-sm ${
                    kwp === k
                      ? "bg-amber-500 text-white"
                      : "bg-gray-200 hover:bg-gray-300"
                  }`}>
                  {k} kWp
                </button>
              ))}
              <button onClick={() => setFocus(!focus)}
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm">
                {focus ? "Tüm görüntü" : "Çatıya odaklan"}
              </button>
            </div>
            {pl && (
              <p className="text-sm text-gray-600">
                {pl.placedPanels}/{pl.requestedPanels} panel yerleşti (
                {pl.perFacet.filter((f) => f.placed > 0)
                  .map((f) => `${f.compass}: ${f.placed} ${f.orientation}`)
                  .join(", ")}
                ){pl.yieldSource === "fallback" && " — çevrimdışı sıralama"}
              </p>
            )}
            {pl?.warning && (
              <p className="text-sm text-amber-700">{pl.warning}</p>
            )}
          </div>
        )}

        {MARKING_MODE && (
          <div className="w-[640px] text-sm space-y-2">
            <p className="text-gray-600">
              {points.length < 4
                ? `Dış köşe ${points.length + 1}/4 — merkezdeki evin çatı köşelerine SIRAYLA tıkla`
                : points.length < 6
                ? `Sırt ucu ${points.length - 3}/2 — mahya çizgisinin iki ucuna tıkla`
                : "Bitti! JSON'u backend/data/roof.json olarak kaydet."}
            </p>
            <button onClick={() => setPoints(points.slice(0, -1))}
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">
              Son noktayı geri al
            </button>
            {json && (
              <pre className="bg-gray-900 text-green-300 p-3 rounded overflow-x-auto">
                {json}
              </pre>
            )}
          </div>
        )}

        {err && <p className="text-red-600 text-sm">{err}</p>}
      </div>

      {/* ---------------- ÖLÇÜ TABLOSU ---------------- */}
      {roof && !MARKING_MODE && showTable && (
        <div className="w-80 bg-white rounded-lg shadow p-4 text-sm space-y-4">
          <div>
            <h3 className="font-semibold mb-1">Kenarlar</h3>
            <table className="w-full">
              <tbody>
                {roof.edges.map((e, i) => (
                  <tr
                    key={i}
                    onMouseEnter={() => setHover({ type: "edge", id: i })}
                    onMouseLeave={() => setHover(null)}
                    className={
                      hover?.type === "edge" && hover.id === i
                        ? "bg-amber-100"
                        : "hover:bg-gray-50"
                    }
                  >
                    <td className="py-0.5 pr-2 text-gray-500">
                      {KIND_TR[e.kind]}
                    </td>
                    <td className="py-0.5 text-right font-mono">
                      {e.lengthM.toFixed(2)} m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="font-semibold mb-1">Facetler (25° eğim)</h3>
            <table className="w-full">
              <thead>
                <tr className="text-gray-500 text-xs">
                  <th className="text-left font-normal">Yön</th>
                  <th className="text-right font-normal">Azimut</th>
                  <th className="text-right font-normal">İzdüşüm</th>
                  <th className="text-right font-normal">Gerçek</th>
                  <th className="text-right font-normal">Panel</th>
                </tr>
              </thead>
              <tbody>
                {roof.facets.map((f, i) => {
                  const pf = pl?.perFacet.find((p) => p.facetId === f.id);
                  return (
                    <tr
                      key={f.id}
                      onMouseEnter={() => setHover({ type: "facet", id: i })}
                      onMouseLeave={() => setHover(null)}
                      className={
                        hover?.type === "facet" && hover.id === i
                          ? "bg-amber-100"
                          : "hover:bg-gray-50"
                      }
                    >
                      <td className="py-0.5">{f.compass}</td>
                      <td className="py-0.5 text-right font-mono">
                        {f.azimuthDeg}°
                      </td>
                      <td className="py-0.5 text-right font-mono">
                        {f.projectedAreaM2}
                      </td>
                      <td className="py-0.5 text-right font-mono">
                        {f.trueAreaM2}
                      </td>
                      <td className="py-0.5 text-right font-mono">
                        {pf ? `${pf.placed}/${pf.capacity}` : "–"}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t font-medium">
                  <td className="py-0.5" colSpan={4}>Toplam gerçek alan</td>
                  <td className="py-0.5 text-right font-mono">
                    {totalTrue.toFixed(1)} m²
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-1">
              Alanlar m² · Panel = yerleşen/kapasite
            </p>
          </div>
        </div>
      )}
    </div>
  );
}