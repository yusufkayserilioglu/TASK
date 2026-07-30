"use client";

import dynamic from "next/dynamic";

const RoofScene = dynamic(() => import("@/components/RoofScene"), {
  ssr: false,
});

export default function Debug() {
  return (
    <main className="min-h-screen flex flex-col items-center gap-4 bg-gray-50 py-6">
      <h1 className="text-xl font-semibold">Engineering View</h1>
      <RoofScene />
    </main>
  );
}