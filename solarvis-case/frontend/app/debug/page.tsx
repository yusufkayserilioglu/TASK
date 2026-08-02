"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const RoofScene = dynamic(() => import("@/components/RoofScene"), {
  ssr: false,
});
const Scene3D = dynamic(() => import("@/components/Scene3D"), {
  ssr: false,
});

export default function Debug() {
  const [view3d, setView3d] = useState(false);
  return (
    <main className="min-h-screen flex flex-col items-center gap-4 py-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-slate-100">
          Engineering View
        </h1>
        <div className="flex rounded-full border border-slate-700
                        overflow-hidden text-xs">
          {(["2D", "3D"] as const).map((v) => (
            <button key={v}
              onClick={() => setView3d(v === "3D")}
              className={`px-3 py-1 transition ${
                (v === "3D") === view3d
                  ? "bg-amber-400 text-[#0b1220] font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}>
              {v}
            </button>
          ))}
        </div>
      </div>
      {view3d ? <Scene3D kwp={6} /> : <RoofScene />}
    </main>
  );
}