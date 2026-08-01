"use client";

import {
  createContext, useContext, useEffect, useState, ReactNode,
} from "react";
import { STRINGS, Lang } from "@/lib/i18n";

const Ctx = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (typeof STRINGS)["en"];
}>({ lang: "en", setLang: () => {}, t: STRINGS.en });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const s = localStorage.getItem("sv-lang");
    if (s === "tr" || s === "en") setLangState(s);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("sv-lang", l);
  };

  return (
    <Ctx.Provider value={{ lang, setLang, t: STRINGS[lang] }}>
      {children}
    </Ctx.Provider>
  );
}

export const useLang = () => useContext(Ctx);

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex rounded-full border border-slate-700 overflow-hidden
                    text-xs">
      {(["en", "tr"] as Lang[]).map((l) => (
        <button key={l} onClick={() => setLang(l)}
          className={`px-2.5 py-1 uppercase transition ${
            lang === l
              ? "bg-amber-400 text-[#0b1220] font-semibold"
              : "text-slate-400 hover:text-slate-200"
          }`}>
          {l}
        </button>
      ))}
    </div>
  );
}