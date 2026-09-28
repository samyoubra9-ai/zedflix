import { NextRequest, NextResponse } from "next/server";
import {
  AccountError,
  accountFromAccessToken,
  claimProfile,
  deviceLabelFromUa,
  isProfileTrusted,
  listPublicProfiles,
  logout,
  presence,
  refreshWeb,
  releaseSeats,
  touchWebDevice,
  trustProfileOnDevice,
  verifyProfilePin,
} from "./accounts";

export const ACCESS_COOKIE = "minuit_access";
export const REFRESH_COOKIE = "minuit_refresh";
export const DEVICE_COOKIE = "minuit_web_device";
export const PROFILE_COOKIE = "minuit_profile";
export const REMEMBER_COOKIE = "minuit_remember";

type SessionTokens = { accessToken: string; refreshToken: string; email: string };

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function writeSession(
  response: NextResponse,
  session: SessionTokens,
  options?: { remember?: boolean },
) {
  const remember =
    options?.remember ??
    false;
  if (remember) {
    response.cookies.set(ACCESS_COOKIE, session.accessToken, {
      ...cookieBase(),
      maxAge: 60 * 60 * 24 * 7,
    });
    response.cookies.set(REFRESH_COOKIE, session.refreshToken, {
      ...cookieBase(),
      maxAge: 60 * 60 * 24 * 90,
    });
    response.cookies.set(REMEMBER_COOKIE, "1", {
      ...cookieBase(),
      maxAge: 60 * 60 * 24 * 90,
    });
  } else {
    response.cookies.set(ACCESS_COOKIE, session.accessToken, cookieBase());
    response.cookies.set(REFRESH_COOKIE, session.refreshToken, {
      ...cookieBase(),
      maxAge: 60 * 60 * 24,
    });
    response.cookies.set(REMEMBER_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  }
  return response;
}

export function clearSession(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  response.cookies.set(PROFILE_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  response.cookies.set(REMEMBER_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  return response;
}

export function writeProfile(response: NextResponse, profileId: string) {
  response.cookies.set(PROFILE_COOKIE, profileId, {
    ...cookieBase(),
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export function clearProfile(response: NextResponse) {
  response.cookies.set(PROFILE_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  return response;
}

export function ensureWebDevice(request: NextRequest, response?: NextResponse) {
  const existing = request.cookies.get(DEVICE_COOKIE)?.value || "";
  if (/^[a-zA-Z0-9-]{8,80}$/.test(existing)) return { deviceId: existing, created: false };
  const deviceId = `web-${crypto.randomUUID().replace(/-/g, "")}`;
  if (response) {
    response.cookies.set(DEVICE_COOKIE, deviceId, {
      ...cookieBase(),
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return { deviceId, created: true };
}

export async function webAccount(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value || "";
  const remember = request.cookies.get(REMEMBER_COOKIE)?.value === "1";
  try {
    const account = await accountFromAccessToken(access);
    return {
      email: account.email,
      accessToken: access,
      session: null as SessionTokens | null,
      remember,
    };
  } catch (error) {
    if (!(error instanceof AccountError)) throw error;
    const refresh = request.cookies.get(REFRESH_COOKIE)?.value || "";
    if (!refresh) throw error;
    const session = await refreshWeb(refresh);
    return {
      email: session.email,
      accessToken: session.accessToken,
      session,
      remember,
    };
  }
}

export async function requireWebAccount(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value || "";
  return accountFromAccessToken(access);
}

export function currentProfileId(request: NextRequest) {
  const id = request.cookies.get(PROFILE_COOKIE)?.value || "";
  return /^[a-zA-Z0-9]{4,40}$/.test(id) ? id : "";
}

export async function endWebSession(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value || "";
  const device = request.cookies.get(DEVICE_COOKIE)?.value || "";
  await logout(access, device).catch(() => undefined);
}

async function registerDevice(request: NextRequest, accessToken: string, deviceId: string) {
  const ua = request.headers.get("user-agent") || "";
  await touchWebDevice(accessToken, deviceId, deviceLabelFromUa(ua)).catch(() => undefined);
}

export async function selectWebProfile(
  request: NextRequest,
  profileId: string,
  pin: string,
  options?: { trust?: boolean },
) {
  const account = await webAccount(request);
  const shell = NextResponse.next();
  if (account.session) writeSession(shell, account.session, { remember: account.remember });
  const { deviceId } = ensureWebDevice(request, shell);

  const trusted =
    !pin &&
    (await isProfileTrusted(account.accessToken, deviceId, profileId).catch(() => false));

  let profile: { id: string; name: string; color: number; locked: boolean };
  if (trusted) {
    const profiles = await listPublicProfiles(account.accessToken);
    const found = profiles.find((item) => item.id === profileId);
    if (!found) throw new AccountError("Profil introuvable", 404);
    profile = found;
  } else {
    profile = await verifyProfilePin(account.accessToken, profileId, pin);
  }

  await claimProfile(account.accessToken, deviceId, profileId);
  await registerDevice(request, account.accessToken, deviceId);
  if (options?.trust) {
    await trustProfileOnDevice(account.accessToken, deviceId, profileId).catch(() => undefined);
  }

  const response = NextResponse.json({ profile });
  shell.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });
  writeProfile(response, profileId);
  return response;
}

export async function clearWebProfile(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value || "";
  const device = request.cookies.get(DEVICE_COOKIE)?.value || "";
  if (access && device) await releaseSeats(access, device).catch(() => undefined);
  return clearProfile(NextResponse.json({ ok: true }));
}

export async function listWebProfiles(request: NextRequest) {
  const account = await webAccount(request);
  const profiles = await listPublicProfiles(account.accessToken);
  const response = NextResponse.json({
    profiles,
    selected: currentProfileId(request),
  });
  if (account.session) writeSession(response, account.session, { remember: account.remember });
  const { deviceId } = ensureWebDevice(request, response);
  await registerDevice(request, account.accessToken, deviceId);
  return response;
}

export async function webPresence(request: NextRequest) {
  const account = await webAccount(request);
  const response = NextResponse.json({ ok: true, profile: true });
  if (account.session) writeSession(response, account.session, { remember: account.remember });
  const { deviceId } = ensureWebDevice(request, response);
  const profileId = currentProfileId(request);
  const result = await presence(account.accessToken, deviceId, profileId);
  await registerDevice(request, account.accessToken, deviceId);
  return NextResponse.json(result, { headers: response.headers });
}

export function withRefreshedSession(
  request: NextRequest,
  account: Awaited<ReturnType<typeof webAccount>>,
  body: unknown,
) {
  const response = NextResponse.json(body);
  if (account.session) writeSession(response, account.session, { remember: account.remember });
  ensureWebDevice(request, response);
  return response;
}
