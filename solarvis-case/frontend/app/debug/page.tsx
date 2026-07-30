"use client";

import dynamic from "next/dynamic";

const RoofScene = dynamic(() => import("@/components/RoofScene"), {
  ssr: false,
});

export default function Debug() {
  return (
    <main className="min-h-screen flex flex-col items-center gap-4 py-6">
      <h1 className="text-xl font-semibold text-slate-100">
        Engineering View
      </h1>
      <RoofScene />
    </main>
  );
}