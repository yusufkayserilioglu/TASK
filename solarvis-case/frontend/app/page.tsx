"use client";

import dynamic from "next/dynamic";

// Konva sunucuda çalışamadığı için ssr: false şart.
const RoofScene = dynamic(() => import("@/components/RoofScene"), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
      <h1 className="text-2xl font-semibold">solarVis Case — Adım A</h1>
      <RoofScene />
    </main>
  );
}