export const LANG_COOKIE = "minuit_lang";
export type SiteLang = "fr" | "en";

export function parseSiteLang(value: string | null | undefined): SiteLang {
  return value === "en" ? "en" : "fr";
}
