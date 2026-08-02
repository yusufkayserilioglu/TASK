"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls, Line as DreiLine, Edges, Html,
} from "@react-three/drei";
import { useLang } from "./LanguageProvider";

const API = "http://localhost:8000";
const TAN_P = Math.tan((25 * Math.PI) / 180);
const EAVE_H = 2.8; // duvar yüksekliği (m) — saçak kotu

type Roof = {
  cornersPx: number[][];
  ridgePx: number[][];
  edges: { from: number[]; to: number[]; kind: string; lengthM: number }[];
  facets: {
    id: string; polygonPx: number[][]; eave: number[][];
    projectedAreaM2: number; trueAreaM2: number;
    azimuthDeg: number; compass: string;
  }[];
};
type Panels = {
  panels: { facetId: string; polygonPx: number[][] }[];
  perFacet: {
    facetId: string; compass: string; capacity: number; placed: number;
  }[];
};

function distToLine(p: number[], a: number[], b: number[]) {
  const abx = b[0] - a[0], aby = b[1] - a[1];
  const len = Math.hypot(abx, aby) || 1;
  return Math.abs(abx * (p[1] - a[1]) - aby * (p[0] - a[0])) / len;
}
const key = (p: number[]) => `${p[0]},${p[1]}`;

function fanGeom(verts: number[][]) {
  const tris: number[] = [];
  for (let i = 1; i < verts.length - 1; i++)
    tris.push(...verts[0], ...verts[i], ...verts[i + 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(tris, 3));
  g.computeVertexNormals();
  return g;
}

function AnimatedPanel({
  geom, delay,
}: { geom: THREE.BufferGeometry; delay: number }) {
  const grp = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (start.current === null) start.current = clock.getElapsedTime();
    const t = clock.getElapsedTime() - start.current - delay;
    if (!grp.current) return;
    if (t <= 0) { grp.current.visible = false; return; }
    grp.current.visible = true;
    const k = Math.min(t / 0.45, 1);          // 450 ms
    const e = 1 - Math.pow(1 - k, 3);         // easeOutCubic
    grp.current.position.y = (1 - e) * 3;     // 3 m yukarıdan süzülür
    if (mat.current) mat.current.opacity = e;
  });
  return (
    <group ref={grp} visible={false}>
      <mesh geometry={geom}>
        <meshStandardMaterial ref={mat} color="#16283f" metalness={0.35}
          roughness={0.35} side={THREE.DoubleSide} transparent opacity={0} />
        <Edges color="#7ba7dd" threshold={15} />
      </mesh>
    </group>
  );
}

export default function Scene3D({ kwp = 6 }: { kwp?: number }) {
  const { t } = useLang();
  const [mpp, setMpp] = useState(0);
  const [imgPx, setImgPx] = useState(1280);
  const [roof, setRoof] = useState<Roof | null>(null);
  const [pl, setPl] = useState<Panels | null>(null);
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);

  const activeId = hoverId ?? pinnedId; // hover öncelikli, yoksa sabitlenen

  useEffect(() => {
    fetch(`${API}/api/map-meta`)
      .then((r) => r.json())
      .then((d) => {
        setMpp(d.metersPerPixel);
        setImgPx(d.imageSizePx);
      });
    fetch(`${API}/api/roof`)
      .then((r) => r.json())
      .then(setRoof);
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(`${API}/api/satellite-image`, (tx) => {
      tx.colorSpace = THREE.SRGBColorSpace;
      setTex(tx);
    });
  }, []);

  useEffect(() => {
    setPl(null);
    fetch(`${API}/api/panels?kwp=${kwp}`)
      .then((r) => r.json())
      .then(setPl);
  }, [kwp]);

  const world = useMemo(() => {
    if (!roof || !pl || !mpp) return null;
    const C = imgPx / 2;
    const toXZ = (p: number[]) =>
      [(p[0] - C) * mpp, (p[1] - C) * mpp] as [number, number];

    // Mahya yüksekliği: noktayı içeren her facet'in saçağına dik uzaklık
    // × tan25 — ortalama (elle işaretleme toleransını yutar).
    const H = new Map<string, number>();
    roof.cornersPx.forEach((p) => H.set(key(p), 0));
    roof.ridgePx.forEach((r) => {
      const ds: number[] = [];
      roof.facets.forEach((f) => {
        if (f.polygonPx.some((p) => key(p) === key(r)))
          ds.push(distToLine(r, f.eave[0], f.eave[1]) * mpp * TAN_P);
      });
      H.set(key(r), ds.reduce((a, b) => a + b, 0) / (ds.length || 1));
    });

    const lift = (p: number[]) => {
      const [x, z] = toXZ(p);
      return [x, EAVE_H + (H.get(key(p)) ?? 0), z] as
        [number, number, number];
    };

    const facetGeoms = roof.facets.map((f) => ({
      id: f.id,
      geom: fanGeom(f.polygonPx.map(lift)),
    }));
    const edges3 = roof.edges.map((e) => [lift(e.from), lift(e.to)]);

    // Çatı merkezi (etiketleri dışa itmek için)
    const cs = roof.cornersPx.map(toXZ);
    const cx = cs.reduce((s, p) => s + p[0], 0) / cs.length;
    const cz = cs.reduce((s, p) => s + p[1], 0) / cs.length;

    // Kenar ölçü etiketleri
    const labels3 = roof.edges.map((e) => {
      const a = lift(e.from), b = lift(e.to);
      const mid = [
        (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2,
      ];
      if (e.kind === "ridge") {
        return {
          pos: [mid[0], mid[1] + 0.9, mid[2]] as [number, number, number],
          text: `${e.lengthM} m`,
        };
      }
      const dx = mid[0] - cx, dz = mid[2] - cz;
      const dl = Math.hypot(dx, dz) || 1;
      const push = e.kind === "eave" ? 1.4 : 1.0;
      return {
        pos: [
          mid[0] + (dx / dl) * push,
          mid[1] + (e.kind === "eave" ? 0.3 : 0.55),
          mid[2] + (dz / dl) * push,
        ] as [number, number, number],
        text: `${e.lengthM} m`,
      };
    });

    // Facet rozetleri: facet yüzeyinin ortası, yüzey üstüne hafif kaldırılmış
    const badges = roof.facets.map((f) => {
      const v3 = f.polygonPx.map(lift);
      const mid = v3
        .reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]],
                [0, 0, 0])
        .map((x) => x / v3.length);
      return {
        id: f.id,
        pos: [mid[0], mid[1] + 0.45, mid[2]] as [number, number, number],
        compass: f.compass,
        azimuthDeg: f.azimuthDeg,
        trueAreaM2: f.trueAreaM2,
        projectedAreaM2: f.projectedAreaM2,
      };
    });

    // Duvarlar
    const wallVerts: number[] = [];
    const c = roof.cornersPx;
    for (let i = 0; i < c.length; i++) {
      const a = c[i], b = c[(i + 1) % c.length];
      const [ax, az] = toXZ(a), [bx, bz] = toXZ(b);
      const q = [
        [ax, 0, az], [bx, 0, bz], [bx, EAVE_H, bz], [ax, EAVE_H, az],
      ];
      wallVerts.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
    }
    const wallGeom = new THREE.BufferGeometry();
    wallGeom.setAttribute(
      "position", new THREE.Float32BufferAttribute(wallVerts, 3)
    );
    wallGeom.computeVertexNormals();

    // Paneller
    const byId = Object.fromEntries(roof.facets.map((f) => [f.id, f]));
    const panelGeoms = pl.panels.map((pn) => {
      const f = byId[pn.facetId];
      const hOf = (p: number[]) =>
        distToLine(p, f.eave[0], f.eave[1]) * mpp * TAN_P;
      const v3 = pn.polygonPx.map((p) => {
        const [x, z] = toXZ(p);
        return [x, EAVE_H + hOf(p), z] as [number, number, number];
      });
      const A = new THREE.Vector3(...v3[0]);
      const B = new THREE.Vector3(...v3[1]);
      const Cv = new THREE.Vector3(...v3[2]);
      const n = new THREE.Vector3()
        .subVectors(B, A)
        .cross(new THREE.Vector3().subVectors(Cv, A))
        .normalize();
      if (n.y < 0) n.negate();
      const off = v3.map((v) =>
        [v[0] + n.x * 0.07, v[1] + n.y * 0.07, v[2] + n.z * 0.07]
      );
      return fanGeom(off);
    });

    return { facetGeoms, edges3, labels3, badges, wallGeom, panelGeoms };
  }, [roof, pl, mpp, imgPx]);

  const groundSize = imgPx * mpp || 79.2;

  if (!world || !roof || !pl)
    return (
      <div className="w-full max-w-[640px] h-[520px] flex items-center
                      justify-center rounded-xl ring-1 ring-slate-800
                      bg-[#0a1120] text-slate-500 text-sm">
        {t.scene3d.loading}
      </div>
    );

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="w-full max-w-[640px] h-[520px] rounded-xl
                      overflow-hidden ring-1 ring-slate-800 bg-[#0a1120]">
        <Canvas camera={{ position: [20, 18, 24], fov: 45 }}>
          <ambientLight intensity={0.55} />
          {/* Güneş kuzeyden — güney yarımküre */}
          <directionalLight position={[0, 32, -28]} intensity={1.15} />

          <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
            <planeGeometry args={[groundSize, groundSize]} />
            {tex ? (
              <meshStandardMaterial map={tex} roughness={1} />
            ) : (
              <meshStandardMaterial color="#101a2c" />
            )}
          </mesh>

          <mesh geometry={world.wallGeom}>
            <meshStandardMaterial color="#1c2740" roughness={0.9}
              side={THREE.DoubleSide} />
          </mesh>

          {world.facetGeoms.map((f) => (
            <mesh key={f.id} geometry={f.geom}>
              <meshStandardMaterial
                color={activeId === f.id ? "#816607" : "#39445a"}
                emissive={activeId === f.id ? "#392c00" : "#000000"}
                roughness={0.95}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}

          <group key={animKey}>
            {world.panelGeoms.map((g, i) => (
              <AnimatedPanel key={i} geom={g}
                delay={0.35 + i * 0.13} />
            ))}
          </group>

          {world.edges3.map((e, i) => (
            <DreiLine key={`e${i}`} points={e as any} color="white"
              lineWidth={1.2} transparent opacity={0.9} />
          ))}

          {/* Kenar ölçüleri */}
          {world.labels3.map((l, i) => (
            <Html key={`lb${i}`} position={l.pos} center
              distanceFactor={11}
              style={{ pointerEvents: "none" }}
              zIndexRange={[10, 0]}>
              <div
                style={{
                  background: "rgba(9,16,30,0.9)",
                  border: "1px solid rgba(234,179,8,0.55)",
                  borderRadius: 6,
                  padding: "2px 7px",
                  color: "#e7edf7",
                  fontSize: 12,
                  fontFamily: "var(--font-mono), monospace",
                  whiteSpace: "nowrap",
                }}
              >
                {l.text}
              </div>
            </Html>
          ))}

          {/* Facet rozetleri: hover'da detay kartı, tıkla = sabitle */}
          {world.badges.map((b) => {
            const open = activeId === b.id;
            const pf = pl.perFacet.find((x) => x.facetId === b.id);
            return (
              <Html key={`bg${b.id}`} position={b.pos} center
                distanceFactor={11} zIndexRange={[30, 20]}>
                <div
                  onMouseEnter={() => setHoverId(b.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onClick={() =>
                    setPinnedId(pinnedId === b.id ? null : b.id)}
                  style={{ cursor: "pointer", position: "relative" }}
                >
                  <div
                    style={{
                      width: 26, height: 26, borderRadius: 13,
                      display: "flex", alignItems: "center",
                      justifyContent: "center",
                      background: open ? "#eab308" : "rgba(9,16,30,0.92)",
                      border: "1.5px solid rgba(234,179,8,0.8)",
                      color: open ? "#0b1220" : "#fef08a",
                      fontSize: 12, fontWeight: 700,
                      fontFamily: "var(--font-sans), sans-serif",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                      userSelect: "none",
                    }}
                  >
                    {b.compass}
                  </div>

                  {open && (
                    <div
                      style={{
                        position: "absolute",
                        left: 32, top: -8,
                        width: 168,
                        background: "rgba(13,24,48,0.96)",
                        border: "1px solid rgba(234,179,8,0.5)",
                        borderRadius: 8,
                        padding: "8px 10px",
                        boxShadow: "0 6px 18px rgba(0,0,0,0.55)",
                        pointerEvents: "none",
                      }}
                    >
                      <div style={{ color: "#facc15", fontSize: 13,
                                    fontWeight: 600, marginBottom: 4 }}>
                        {t.scene.facet} {b.compass}
                      </div>
                      {[
                        [t.scene.azimuth, `${b.azimuthDeg}°`],
                        [t.scene.trueArea, `${b.trueAreaM2} m²`],
                        [t.scene.projectedShort, `${b.projectedAreaM2} m²`],
                        [t.scene.panels,
                         pf ? `${pf.placed}/${pf.capacity}` : "–"],
                      ].map(([k, v]) => (
                        <div key={k}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8, fontSize: 11.5, lineHeight: "18px",
                          }}>
                          <span style={{ color: "#8fa0bf" }}>{k}</span>
                          <span style={{
                            color: "#eef2fa",
                            fontFamily: "var(--font-mono), monospace",
                          }}>
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Html>
            );
          })}

          <OrbitControls target={[0, EAVE_H, 0]} enableDamping
            maxPolarAngle={Math.PI / 2 - 0.03}
            minDistance={8} maxDistance={70} />
        </Canvas>
      </div>
      <div className="flex items-center gap-3">
        <p className="text-xs text-slate-500">{t.scene3d.hint}</p>
        <button onClick={() => setAnimKey((k) => k + 1)}
          className="text-xs px-3 py-1 rounded-full border border-slate-700
                     text-amber-300 hover:bg-amber-400/10 transition">
          ▶ {t.scene3d.replay}
        </button>
      </div>
    </div>
  );
}