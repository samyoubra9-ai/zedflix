"use client";

import { createContext, useContext, type ReactNode } from "react";
import { copyFor, type Copy } from "@/lib/copy";
import { LANG_COOKIE, type SiteLang } from "@/lib/locale";

const LocaleContext = createContext<SiteLang>("fr");

export function LocaleProvider({ lang, children }: { lang: SiteLang; children: ReactNode }) {
  return <LocaleContext.Provider value={lang}>{children}</LocaleContext.Provider>;
}

export function useSiteLang() {
  return useContext(LocaleContext);
}

export function useCopy(): Copy {
  return copyFor(useSiteLang());
}

export function setSiteLang(lang: SiteLang) {
  document.cookie = `${LANG_COOKIE}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.location.reload();
}

export function LanguageSwitch({ className = "" }: { className?: string }) {
  const lang = useSiteLang();
  return (
    <div className={`flex items-center rounded-md bg-white/10 p-0.5 text-[11px] font-semibold ${className}`}>
      <button
        type="button"
        onClick={() => setSiteLang("fr")}
        className={`rounded px-2 py-1 ${lang === "fr" ? "bg-white text-black" : "text-zinc-300"}`}
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => setSiteLang("en")}
        className={`rounded px-2 py-1 ${lang === "en" ? "bg-white text-black" : "text-zinc-300"}`}
      >
        EN
      </button>
    </div>
  );
}
