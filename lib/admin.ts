import { createHmac, timingSafeEqual } from "node:crypto";
import { AccountError } from "./accounts";

export const ADMIN_COOKIE = "zedflix_admin";

export function adminConfigured() {
  return (process.env.ADMIN_PASSWORD || "").length >= 8;
}

export function adminToken() {
  const password = process.env.ADMIN_PASSWORD || "";
  return createHmac("sha256", password).update("zedflix-admin").digest("hex");
}

export function isAdmin(request: Request) {
  if (!adminConfigured()) return false;
  const header = request.headers.get("cookie") || "";
  const raw = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1);
  if (!raw) return false;
  const value = decodeURIComponent(raw);
  const expected = adminToken();
  const actual = Buffer.from(value);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}

export function requireAdmin(request: Request) {
  if (!adminConfigured()) {
    throw new AccountError("Le mot de passe admin n'est pas configuré", 500);
  }
  if (!isAdmin(request)) throw new AccountError("Accès admin refusé", 401);
}

export function passwordsMatch(input: string) {
  const password = process.env.ADMIN_PASSWORD || "";
  const actual = Buffer.from(input);
  const wanted = Buffer.from(password);
  if (!password || actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}
