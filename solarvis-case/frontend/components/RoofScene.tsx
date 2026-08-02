"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Stage, Layer, Image as KonvaImage, Circle, Line, Arrow, Text, Label, Tag,
} from "react-konva";
import { useLang } from "./LanguageProvider";

const IMG_PX = 1280;
const DISPLAY_PX = 640;
const FULL_SCALE = DISPLAY_PX / IMG_PX;
const MARKING_MODE = false;

const NAVY_CHIP = "rgba(9,16,30,0.88)";
const AMBER = "#eab308"; // yellow-500 (hardal/altın sarısı)
const INK = "#0b1220";

type Edge = { from: number[]; to: number[]; kind: string; lengthM: number };
type Facet = {
  id: string; polygonPx: number[][]; eave: number[][];
  projectedAreaM2: number; trueAreaM2: number;
  azimuthDeg: number; compass: string;
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
  tableLayout = "side",
  onSnapshot,
}: {
  kwp?: number;
  showControls?: boolean;
  showTable?: boolean;
  tableLayout?: "side" | "below";
  onSnapshot?: (dataUrl: string) => void;
}) {
  const { t } = useLang();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [points, setPoints] = useState<number[][]>([]);
  const [roof, setRoof] = useState<Roof | null>(null);
  const [focus, setFocus] = useState(true);
  const [hover, setHover] = useState<Hover>(null);
  const [kwp, setKwp] = useState(kwpProp ?? 6.0);
  const [pl, setPl] = useState<PanelsResp | null>(null);
  const [shooting, setShooting] = useState(false);
  const [err, setErr] = useState("");
  const stageRef = useRef<any>(null);
  const lastShot = useRef("");

  // Çekim modunda hover görselleri tamamen bastırılır (PDF temizliği):
  const hv: Hover = shooting ? null : hover;

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

  // Sahne hazır -> çekim moduna geç (bir kez)
  useEffect(() => {
    if (!onSnapshot || !img || !roof || !pl) return;
    const sig = `${kwp}-${pl.placedPanels}`;
    if (lastShot.current === sig) return;
    const timer = setTimeout(() => setShooting(true), 400);
    return () => clearTimeout(timer);
  }, [img, roof, pl, kwp, onSnapshot]);

  // Çekim modu: hover'sız render'ı yakala
  useEffect(() => {
    if (!shooting || !pl) return;
    const timer = setTimeout(() => {
      const url = stageRef.current?.toDataURL({ pixelRatio: 2 });
      if (url) {
        lastShot.current = `${kwp}-${pl.placedPanels}`;
        onSnapshot?.(url);
      }
      setShooting(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [shooting, pl, kwp, onSnapshot]);

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

  const centroid = (poly: number[][]) => [
    poly.reduce((s, p) => s + p[0], 0) / poly.length,
    poly.reduce((s, p) => s + p[1], 0) / poly.length,
  ];

  // --- ETİKET YERLEŞİMİ ------------------------------------------------
  const edgeLabels = useMemo(() => {
    if (!roof) return [];
    const D_EAVE = 48, D_HIP = 46;
    const isRidgePt = (p: number[]) =>
      roof.ridgePx.some((r) => r[0] === p[0] && r[1] === p[1]);
    return roof.edges.map((e) => {
      const mx = (e.from[0] + e.to[0]) / 2;
      const my = (e.from[1] + e.to[1]) / 2;
      if (e.kind === "eave") {
        const dx = e.to[0] - e.from[0], dy = e.to[1] - e.from[1];
        const len = Math.hypot(dx, dy) || 1;
        let nx = -dy / len, ny = dx / len;
        if (nx * (mx - center[0]) + ny * (my - center[1]) < 0) {
          nx = -nx; ny = -ny;
        }
        return {
          x: mx + nx * D_EAVE, y: my + ny * D_EAVE,
          leader: [mx + nx * (D_EAVE - 14), my + ny * (D_EAVE - 14),
                   mx + nx * 6, my + ny * 6],
        };
      }
      if (e.kind === "hip") {
        const fromIsRidge = isRidgePt(e.from);
        const corner = fromIsRidge ? e.to : e.from;
        const ridgeEnd = fromIsRidge ? e.from : e.to;
        const dx = corner[0] - ridgeEnd[0], dy = corner[1] - ridgeEnd[1];
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        return {
          x: corner[0] + ux * D_HIP, y: corner[1] + uy * D_HIP,
          leader: [corner[0] + ux * (D_HIP - 14),
                   corner[1] + uy * (D_HIP - 14),
                   corner[0] + ux * 6, corner[1] + uy * 6],
        };
      }
      return { x: mx, y: my, leader: null }; // ridge
    });
  }, [roof, center]);

  const facetAnchors = useMemo(() => {
    if (!roof) return [];
    return roof.facets.map((f) => {
      const c = centroid(f.polygonPx);
      const em = [
        (f.eave[0][0] + f.eave[1][0]) / 2,
        (f.eave[0][1] + f.eave[1][1]) / 2,
      ];
      return [c[0] + (em[0] - c[0]) * 0.42, c[1] + (em[1] - c[1]) * 0.42];
    });
  }, [roof]);

  const toScreen = (p: number[]) => [
    p[0] * view.scale + view.x,
    p[1] * view.scale + view.y,
  ];
  const infoPanel = useMemo(() => {
    if (!hv || !roof) return null;
    if (hv.type === "edge") {
      const e = roof.edges[hv.id];
      const [sx, sy] = toScreen([
        (e.from[0] + e.to[0]) / 2, (e.from[1] + e.to[1]) / 2,
      ]);
      return {
        sx, sy, title: t.scene.kind[e.kind],
        rows: [[t.scene.length, `${e.lengthM.toFixed(2)} m`]] as
          [string, string][],
      };
    }
    const f = roof.facets[hv.id];
    const pf = pl?.perFacet.find((p) => p.facetId === f.id);
    const [sx, sy] = toScreen(centroid(f.polygonPx));
    return {
      sx, sy, title: `${t.scene.facet} ${f.compass}`,
      rows: [
        [t.scene.azimuth, `${f.azimuthDeg}°`],
        [t.scene.trueArea, `${f.trueAreaM2} m²`],
        [t.scene.projectedShort, `${f.projectedAreaM2} m²`],
        ...(pf ? [[t.scene.panels, `${pf.placed}/${pf.capacity}`]] : []),
      ] as [string, string][],
    };
  }, [hv, roof, pl, view, t]);

  function handleClick(e: any) {
    if (!MARKING_MODE || points.length >= 6) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const tr = stage.getAbsoluteTransform().copy().invert();
    const p = tr.point(pos);
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

  const totalTrue = roof
    ? roof.facets.reduce((s, f) => s + f.trueAreaM2, 0)
    : 0;

  return (
    <div className={`flex gap-4 ${
      tableLayout === "below"
        ? "flex-col items-center"
        : "flex-col lg:flex-row items-start"
    }`}>
      {/* ---------------- SAHNE ---------------- */}
      <div
        className="flex flex-col items-center gap-2"
        style={{ cursor: hv ? "pointer" : "default" }}
      >
        <div className="relative">
          <Stage
            ref={stageRef}
            width={DISPLAY_PX} height={DISPLAY_PX}
            scaleX={view.scale} scaleY={view.scale}
            x={view.x} y={view.y}
            onClick={handleClick}
            className="rounded-xl overflow-hidden shadow-lg shadow-black/40 ring-1 ring-slate-800"
          >
            <Layer>
              {img && (
                <KonvaImage image={img} width={IMG_PX} height={IMG_PX} />
              )}

              {MARKING_MODE &&
                points.map((p, i) => (
                  <Circle key={i} x={p[0]} y={p[1]} radius={7}
                    fill={i < 4 ? "#ef4444" : "#3b82f6"}
                    stroke="white" strokeWidth={2} />
                ))}

              {roof?.facets.map((f, i) => (
                <Line
                  key={`fill-${f.id}`}
                  points={f.polygonPx.flat()}
                  closed
                  fill={
                    hv?.type === "facet" && hv.id === i
                      ? "rgba(234,179,8,0.22)"
                      : "rgba(0,0,0,0.01)"
                  }
                  onMouseEnter={() => setHover({ type: "facet", id: i })}
                  onMouseLeave={() => setHover(null)}
                />
              ))}

              {pl?.panels.map((p, i) => (
                <Line key={`panel-${i}`}
                  points={p.polygonPx.flat()}
                  closed
                  fill="#101c33"
                  stroke="rgba(147,197,253,0.55)"
                  strokeWidth={0.8}
                  listening={false}
                />
              ))}

              {roof?.edges.map((e, i) => {
                const hovered = hv?.type === "edge" && hv.id === i;
                return (
                  <Line key={i}
                    points={[e.from[0], e.from[1], e.to[0], e.to[1]]}
                    stroke={hovered ? AMBER : "rgba(255,255,255,0.95)"}
                    strokeWidth={hovered ? 3.5 : 2}
                    hitStrokeWidth={18}
                    shadowColor="black" shadowBlur={4} shadowOpacity={0.9}
                    onMouseEnter={() => setHover({ type: "edge", id: i })}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}

              {roof?.edges.map((e, i) => {
                const L = edgeLabels[i];
                if (!L?.leader) return null;
                const hovered = hv?.type === "edge" && hv.id === i;
                return (
                  <Arrow key={`ld${i}`}
                    points={L.leader}
                    stroke={hovered ? AMBER : "rgba(255,255,255,0.9)"}
                    fill={hovered ? AMBER : "rgba(255,255,255,0.9)"}
                    strokeWidth={hovered ? 2 : 1.4}
                    pointerLength={7}
                    pointerWidth={6}
                    shadowColor="black" shadowBlur={3} shadowOpacity={0.8}
                    listening={false}
                  />
                );
              })}

              {roof?.edges.map((e, i) => {
                const L = edgeLabels[i];
                if (!L) return null;
                const hovered = hv?.type === "edge" && hv.id === i;
                return (
                  <Label key={`l${i}`} x={L.x} y={L.y}
                    offsetX={26} offsetY={10} listening={false}>
                    <Tag
                      fill={hovered ? AMBER : NAVY_CHIP}
                      cornerRadius={4}
                      stroke={hovered ? undefined : "rgba(234,179,8,0.35)"}
                      strokeWidth={hovered ? 0 : 0.75}
                    />
                    <Text
                      text={`${e.lengthM} m`}
                      fontSize={14}
                      fontFamily="Inter, system-ui, sans-serif"
                      fontStyle={hovered ? "bold" : "normal"}
                      fill={hovered ? INK : "#e7edf7"}
                      padding={4}
                    />
                  </Label>
                );
              })}

              {roof?.facets.map((f, i) => {
                const hovered = hv?.type === "facet" && hv.id === i;
                const a = facetAnchors[i];
                if (!a) return null;
                return (
                  <Label key={f.id} x={a[0]} y={a[1]}
                    offsetX={11} offsetY={11} listening={false}>
                    <Tag
                      fill={hovered ? AMBER : NAVY_CHIP}
                      cornerRadius={11}
                      stroke={hovered ? undefined : "rgba(234,179,8,0.5)"}
                      strokeWidth={hovered ? 0 : 1}
                    />
                    <Text
                      text={f.compass}
                      fontSize={14}
                      fontFamily="Inter, system-ui, sans-serif"
                      fontStyle="bold"
                      fill={hovered ? INK : "#fef08a"}
                      padding={5}
                    />
                  </Label>
                );
              })}
            </Layer>
          </Stage>

          {infoPanel && (
            <div
              className="absolute z-10 pointer-events-none w-40 rounded-lg border border-yellow-500/50 bg-[#0d1830]/95 px-3 py-2 shadow-xl backdrop-blur-sm"
              style={{
                top: Math.min(Math.max(infoPanel.sy - 44, 10),
                              DISPLAY_PX - 120),
                ...(infoPanel.sx < DISPLAY_PX / 2
                  ? { left: 10 }
                  : { right: 10 }),
              }}
            >
              <div className="text-yellow-400 text-sm font-semibold mb-1">
                {infoPanel.title}
              </div>
              {infoPanel.rows.map(([k, v]) => (
                <div key={k}
                  className="flex justify-between gap-2 text-xs leading-5">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-mono text-slate-100">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {!MARKING_MODE && showControls && (
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex gap-2">
              {[3.6, 6.0, 9.6].map((k) => (
                <button key={k} onClick={() => setKwp(k)}
                  className={`px-3 py-1 rounded-md text-sm transition ${
                    kwp === k
                      ? "bg-yellow-500 text-[#0b1220] font-medium"
                      : "bg-[#16233c] text-slate-300 hover:bg-[#1c2c4a]"
                  }`}>
                  {k} kWp
                </button>
              ))}
              <button onClick={() => setFocus(!focus)}
                className="px-3 py-1 rounded-md bg-[#16233c] text-slate-300 hover:bg-[#1c2c4a] text-sm transition">
                {focus ? t.scene.fullImage : t.scene.focusRoof}
              </button>
            </div>
            {pl && (
              <p className="text-sm text-slate-400">
                {t.scene.placed(pl.placedPanels, pl.requestedPanels)} (
                {pl.perFacet.filter((f) => f.placed > 0)
                  .map((f) =>
                    `${f.compass}: ${f.placed} ${
                      t.scene.orientation[f.orientation] ?? f.orientation
                    }`)
                  .join(", ")}
                ){pl.yieldSource === "fallback" && t.scene.offline}
              </p>
            )}
            {pl && pl.placedPanels < pl.requestedPanels && (
              <p className="text-sm text-yellow-500">
                {t.scene.capacity(pl.placedPanels, pl.requestedPanels)}
              </p>
            )}
          </div>
        )}

        {MARKING_MODE && (
          <div className="w-[640px] text-sm space-y-2 text-slate-300">
            <p>
              {points.length < 4
                ? `Outer corner ${points.length + 1}/4 — click the roof corners of the CENTER house IN ORDER`
                : points.length < 6
                ? `Ridge end ${points.length - 3}/2 — click both ends of the ridge line`
                : "Done! Save the JSON below as backend/data/roof.json."}
            </p>
            <button onClick={() => setPoints(points.slice(0, -1))}
              className="px-3 py-1 rounded bg-[#16233c] hover:bg-[#1c2c4a]">
              Undo last point
            </button>
            {json && (
              <pre className="bg-black/50 text-emerald-300 p-3 rounded overflow-x-auto">
                {json}
              </pre>
            )}
          </div>
        )}

        {err && <p className="text-red-400 text-sm">{err}</p>}
      </div>

      {/* ---------------- ÖLÇÜ TABLOSU ---------------- */}
      {roof && !MARKING_MODE && showTable && (
        <div className={
          tableLayout === "below"
            ? "w-full grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm pt-1"
            : "w-80 bg-[#0f1a2e] border border-slate-800 rounded-xl p-4 text-sm space-y-4"
        }>
          <div>
            <h3 className="font-semibold mb-1 text-slate-200">
              {t.scene.edges}
            </h3>
            <table className="w-full">
              <tbody>
                {roof.edges.map((e, i) => (
                  <tr
                    key={i}
                    onMouseEnter={() => setHover({ type: "edge", id: i })}
                    onMouseLeave={() => setHover(null)}
                    className={
                      hv?.type === "edge" && hv.id === i
                        ? "bg-yellow-500/10"
                        : "hover:bg-white/5"
                    }
                  >
                    <td className="py-0.5 pr-2 text-slate-400">
                      {t.scene.kind[e.kind]}
                    </td>
                    <td className="py-0.5 text-right font-mono text-slate-100">
                      {e.lengthM.toFixed(2)} m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="font-semibold mb-1 text-slate-200">
              {t.scene.facetsTitle}
            </h3>
            <table className="w-full">
              <thead>
                <tr className="text-slate-500 text-xs">
                  <th className="text-left font-normal">{t.scene.dir}</th>
                  <th className="text-right font-normal">
                    {t.scene.azimuth}
                  </th>
                  <th className="text-right font-normal">
                    {t.scene.projected}
                  </th>
                  <th className="text-right font-normal">
                    {t.scene.trueCol}
                  </th>
                  <th className="text-right font-normal">
                    {t.scene.panels}
                  </th>
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
                        hv?.type === "facet" && hv.id === i
                          ? "bg-yellow-500/10"
                          : "hover:bg-white/5"
                      }
                    >
                      <td className="py-0.5 text-slate-300">{f.compass}</td>
                      <td className="py-0.5 text-right font-mono text-slate-100">
                        {f.azimuthDeg}°
                      </td>
                      <td className="py-0.5 text-right font-mono text-slate-100">
                        {f.projectedAreaM2}
                      </td>
                      <td className="py-0.5 text-right font-mono text-slate-100">
                        {f.trueAreaM2}
                      </td>
                      <td className="py-0.5 text-right font-mono text-slate-100">
                        {pf ? `${pf.placed}/${pf.capacity}` : "–"}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-slate-700 font-medium">
                  <td className="py-0.5 text-slate-300" colSpan={4}>
                    {t.scene.totalTrue}
                  </td>
                  <td className="py-0.5 text-right font-mono text-yellow-400">
                    {totalTrue.toFixed(1)} m²
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-slate-500 mt-1">{t.scene.tableNote}</p>
          </div>
        </div>
      )}
    </div>
  );
}