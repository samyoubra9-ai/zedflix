"use client";

import { useEffect, useState } from "react";

const TV_UA =
  /Android TV|SMART-TV|SmartTV|AppleTV|Apple TV|BRAVIA|Web0S|WebOS|Tizen|CrKey|GoogleTV|AFT[A-Z0-9]|FireTV|Fire TV|MIBOX|MiBOX|POV_TV|HbbTV|TV Safari|SmartTv|Viera|NetCast|PhilipsTV|Hisense|Xbox/i;

/** True only on living-room TVs — never on normal PC / phone layouts. */
export function detectTvMode() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("tv") === "0") return false;
  // Explicit override for QA on a PC browser.
  if (params.get("tv") === "1") return true;

  const ua = navigator.userAgent || "";
  if (TV_UA.test(ua)) return true;

  // Some TV browsers hide their brand in the UA but expose a remote (no hover, coarse pointer).
  // Require a large viewport so phones/tablets stay on the mobile/desktop site.
  const wide = window.matchMedia("(min-width: 1100px) and (min-height: 620px)").matches;
  const remote = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  return wide && remote;
}

export function useTvMode() {
  const [tv, setTv] = useState(false);

  useEffect(() => {
    function sync() {
      const next = detectTvMode();
      setTv(next);
      document.documentElement.dataset.tv = next ? "1" : "0";
      document.documentElement.classList.toggle("tv-mode", next);
      document.documentElement.classList.toggle("tv-remote", next);
    }
    sync();
    const wide = window.matchMedia("(min-width: 1100px) and (min-height: 620px)");
    const hover = window.matchMedia("(hover: none)");
    const pointer = window.matchMedia("(pointer: coarse)");
    wide.addEventListener?.("change", sync);
    hover.addEventListener?.("change", sync);
    pointer.addEventListener?.("change", sync);
    return () => {
      wide.removeEventListener?.("change", sync);
      hover.removeEventListener?.("change", sync);
      pointer.removeEventListener?.("change", sync);
    };
  }, []);

  return tv;
}
