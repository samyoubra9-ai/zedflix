import { createClient, type Session, type User } from "@supabase/supabase-js";

export class AccountError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type Account = {
  id: string;
  email: string;
};

export function admin() {
  return client();
}

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new AccountError("Supabase n'est pas configuré", 500);
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function tokens(session: Session) {
  const email = session.user.email;
  if (!session.access_token || !session.refresh_token || !email) {
    throw new AccountError("Session expirée", 401);
  }
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    email,
  };
}

export function registrationOpen() {
  return false;
}

export function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const DURATIONS = [1, 3, 6, 12] as const;
const MAX_PROFILES = 5;
const PROFILE_SEATS = 2;
const TRIAL_MS = 3 * 24 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
/** Drop a seat when the app stops sending presence (process killed). */
const SEAT_TTL_MS = 3 * 60 * 1000;
const SEAT_TOUCH_MS = 45_000;

export type CatalogAccess = "full" | "vod" | "live";

export function parseCatalogAccess(raw: unknown, fallback: CatalogAccess = "full"): CatalogAccess {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (value === "vod" || value === "films" || value === "series" || value === "standard") return "vod";
  if (value === "live" || value === "tv") return "live";
  if (value === "full" || value === "all") return "full";
  return fallback;
}

export function expirationDate(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

function expiresAtOf(metadata: Record<string, unknown> | undefined) {
  const value = metadata?.expires_at;
  return typeof value === "string" ? value : null;
}

function deviceIdOf(metadata: Record<string, unknown> | undefined) {
  const value = metadata?.device_id;
  return typeof value === "string" ? value : null;
}

function keptMetadata(metadata: Record<string, unknown> | undefined, patch: Record<string, unknown>) {
  const next = { ...(metadata || {}), ...patch };
  delete next.adult;
  return next;
}

type ProfileSeat = { deviceId: string; at: number };

function seatsOf(metadata: Record<string, unknown> | undefined): Record<string, ProfileSeat[]> {
  const value = metadata?.profile_seats;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const seats: Record<string, ProfileSeat[]> = {};
  for (const [profileId, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[a-zA-Z0-9]{4,40}$/.test(profileId) || !Array.isArray(raw)) continue;
    const list = raw
      .flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const seat = item as Record<string, unknown>;
        const deviceId = String(seat.deviceId || "").trim();
        const at = Number(seat.at);
        if (!deviceId || deviceId.length > 80 || !Number.isFinite(at)) return [];
        return [{ deviceId, at }];
      })
      .sort((a, b) => a.at - b.at)
      .slice(-PROFILE_SEATS);
    if (list.length) seats[profileId] = list;
  }
  return seats;
}

function seatCount(metadata: Record<string, unknown> | undefined) {
  return Object.values(seatsOf(metadata)).reduce((total, list) => total + list.length, 0);
}

function seatFresh(seat: ProfileSeat, now = Date.now()) {
  return now - seat.at < SEAT_TTL_MS;
}

function pruneStaleSeats(seats: Record<string, ProfileSeat[]>, now = Date.now()) {
  let changed = false;
  const next: Record<string, ProfileSeat[]> = {};
  for (const [profileId, list] of Object.entries(seats)) {
    const kept = list.filter((seat) => seatFresh(seat, now));
    if (kept.length !== list.length) changed = true;
    if (kept.length) next[profileId] = kept;
  }
  return { seats: next, changed };
}

function holdsSeat(metadata: Record<string, unknown> | undefined, profileId: string, deviceId: string) {
  return (seatsOf(metadata)[profileId] || []).some(
    (seat) => seat.deviceId === deviceId && seatFresh(seat),
  );
}

function trialsOf(metadata: Record<string, unknown> | undefined): Record<string, number> {
  const value = metadata?.device_trials;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const trials: Record<string, number> = {};
  for (const [deviceId, raw] of Object.entries(value as Record<string, unknown>)) {
    const at = Number(raw);
    if (!deviceId || deviceId.length > 80 || !Number.isFinite(at)) continue;
    trials[deviceId] = at;
  }
  return trials;
}

const PROFILE_COLORS = [-1767148, -4711132, -14725511, -13669553, -10732178];

function validPin(pin: string) {
  return pin === "" || /^\d{4}$/.test(pin);
}

export type StoredProfile = {
  id: string;
  name: string;
  pin: string;
  color: number;
  expiresAt: string | null;
  trialUsed: boolean;
  /** full = Standard + TV, vod = Standard, live = TV seulement. Missing on old profiles = full. */
  catalogAccess: CatalogAccess;
};

export type PublicProfile = {
  id: string;
  name: string;
  color: number;
  locked: boolean;
  expiresAt: string | null;
  expired: boolean;
  trialPending: boolean;
  daysLeft: number | null;
  warning: "soon" | "urgent" | "expired" | null;
  warningMessage: string | null;
  catalogAccess: CatalogAccess;
};

function daysLeftOf(expiresAt: string | null) {
  if (!expiresAt) return null;
  return Math.ceil((Date.parse(expiresAt) - Date.now()) / DAY_MS);
}

function isExpired(profile: StoredProfile) {
  if (!profile.expiresAt) return profile.trialUsed;
  return Date.parse(profile.expiresAt) <= Date.now();
}

function profileWarning(profile: StoredProfile): Pick<
  PublicProfile,
  "expired" | "trialPending" | "daysLeft" | "warning" | "warningMessage"
> {
  const trialPending = !profile.expiresAt && !profile.trialUsed;
  if (trialPending) {
    return {
      expired: false,
      trialPending: true,
      daysLeft: 3,
      warning: null,
      warningMessage: "Essai de 3 jours au premier appareil",
    };
  }
  const expired = isExpired(profile);
  const daysLeft = daysLeftOf(profile.expiresAt);
  if (expired) {
    return {
      expired: true,
      trialPending: false,
      daysLeft: daysLeft ?? 0,
      warning: "expired",
      warningMessage: "Ce profil a expiré. Contacte l’admin pour le prolonger.",
    };
  }
  if (daysLeft !== null && daysLeft <= 1) {
    return {
      expired: false,
      trialPending: false,
      daysLeft,
      warning: "urgent",
      warningMessage:
        daysLeft <= 0
          ? "Ce profil expire aujourd’hui."
          : "Ce profil expire demain.",
    };
  }
  if (daysLeft !== null && daysLeft <= 3) {
    return {
      expired: false,
      trialPending: false,
      daysLeft,
      warning: "soon",
      warningMessage: `Ce profil expire dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}.`,
    };
  }
  return {
    expired: false,
    trialPending: false,
    daysLeft,
    warning: null,
    warningMessage: null,
  };
}

function publicProfile(profile: StoredProfile): PublicProfile {
  return {
    id: profile.id,
    name: profile.name,
    color: profile.color,
    locked: profile.pin.length === 4,
    expiresAt: profile.expiresAt,
    catalogAccess: profile.catalogAccess,
    ...profileWarning(profile),
  };
}

function assertProfileUsable(profile: StoredProfile) {
  if (isExpired(profile)) {
    throw new AccountError("Profil expiré", 403);
  }
}

function profilesOf(metadata: Record<string, unknown> | undefined): StoredProfile[] {
  const value = metadata?.profiles;
  if (!Array.isArray(value)) return [];
  const accountExp = expiresAtOf(metadata);
  return value
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const profile = item as Record<string, unknown>;
      const id = String(profile.id || "");
      const name = String(profile.name || "").trim();
      const pin = String(profile.pin || "");
      const color = Number(profile.color);
      if (!/^[a-zA-Z0-9]{4,40}$/.test(id) || !name || !validPin(pin)) return [];
      const rawExpires = profile.expiresAt;
      let expiresAt = typeof rawExpires === "string" ? rawExpires : null;
      let trialUsed = Boolean(profile.trialUsed);
      if (!expiresAt && accountExp) {
        expiresAt = accountExp;
        trialUsed = true;
      }
      return [
        {
          id,
          name: name.slice(0, 18),
          pin,
          color: Number.isFinite(color) ? color : PROFILE_COLORS[0],
          expiresAt,
          trialUsed,
          catalogAccess: parseCatalogAccess(profile.catalogAccess, "full"),
        },
      ];
    })
    .slice(0, MAX_PROFILES);
}

function accountSummary(profiles: StoredProfile[]) {
  if (!profiles.length) {
    return { expiresAt: null as string | null, expired: false, activeProfiles: 0 };
  }
  const active = profiles.filter((profile) => !isExpired(profile) || (!profile.expiresAt && !profile.trialUsed));
  const dated = profiles
    .map((profile) => profile.expiresAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  return {
    expiresAt: dated[0] || null,
    expired: active.length === 0,
    activeProfiles: active.length,
  };
}

function extendExpiresAt(current: string | null, months: number) {
  const base = current && Date.parse(current) > Date.now() ? new Date(current) : new Date();
  base.setMonth(base.getMonth() + months);
  return base.toISOString();
}

function clearProfileSeats(seats: Record<string, ProfileSeat[]>, profileId: string) {
  delete seats[profileId];
  return seats;
}

export async function createAccount(emailRaw: string, password: string, months = 1) {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AccountError("Email invalide", 400);
  }
  if (password.length < 8) {
    throw new AccountError("Le mot de passe doit faire au moins 8 caractères", 400);
  }
  if (!DURATIONS.includes(months as (typeof DURATIONS)[number])) {
    throw new AccountError("Durée invalide", 400);
  }

  const main: StoredProfile = {
    id: "main",
    name: "Principal",
    pin: "",
    color: PROFILE_COLORS[0],
    expiresAt: expirationDate(months),
    trialUsed: true,
    catalogAccess: "vod",
  };

  const supabase = client();
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      account: "lifetime",
      profiles: [main],
      profile_seats: {},
      device_trials: {},
      expires_at: null,
    },
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
      throw new AccountError("Un compte existe déjà avec cet email", 409);
    }
    throw new AccountError(error.message, error.status || 400);
  }
  return { email, months, lifetime: true };
}

export async function listAccounts() {
  const supabase = client();
  const users: User[] = [];
  let page: number | null = 1;
  while (page) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new AccountError(error.message, error.status || 500);
    users.push(...data.users);
    page = data.nextPage;
  }
  return users
    .filter((user) => user.email)
    .map((user) => {
      const profiles = profilesOf(user.app_metadata);
      const summary = accountSummary(profiles);
      return {
        id: user.id,
        email: user.email as string,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
        expiresAt: summary.expiresAt,
        expired: summary.expired,
        activeProfiles: summary.activeProfiles,
        profileCount: profiles.length,
        lifetime: true,
        deviceBound: Boolean(deviceIdOf(user.app_metadata)) || seatCount(user.app_metadata) > 0,
      };
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function assertUserId(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new AccountError("Compte introuvable", 400);
  }
}

export async function deleteAccount(id: string) {
  assertUserId(id);
  const { error } = await client().auth.admin.deleteUser(id);
  if (error) throw new AccountError(error.message, error.status || 400);
}

export async function extendAccount(id: string, months: number) {
  assertUserId(id);
  if (!DURATIONS.includes(months as (typeof DURATIONS)[number])) {
    throw new AccountError("Durée invalide", 400);
  }
  const supabase = client();
  const { data, error } = await supabase.auth.admin.getUserById(id);
  if (error || !data.user) throw new AccountError("Compte introuvable", 404);
  const current = profilesOf(data.user.app_metadata);
  if (!current.length) {
    throw new AccountError("Aucun profil à prolonger — crée un profil d’abord", 400);
  }
  const profiles = current.map((profile) => ({
    ...profile,
    expiresAt: extendExpiresAt(profile.expiresAt, months),
    trialUsed: true,
  }));
  await saveProfiles(data.user.id, data.user.app_metadata, profiles, { expires_at: null });
  const summary = accountSummary(profiles);
  return { email: data.user.email, expiresAt: summary.expiresAt, months, profiles: profiles.map(publicProfile) };
}

export async function adminSetProfileExpiry(userId: string, profileId: string, months: number) {
  assertUserId(userId);
  if (!/^[a-zA-Z0-9]{4,40}$/.test(profileId)) throw new AccountError("Profil introuvable", 400);
  if (!DURATIONS.includes(months as (typeof DURATIONS)[number])) {
    throw new AccountError("Durée invalide", 400);
  }
  const user = await accountUser(userId);
  const current = profilesOf(user.app_metadata);
  const existing = current.find((profile) => profile.id === profileId);
  if (!existing) throw new AccountError("Profil introuvable", 404);
  const profile: StoredProfile = {
    ...existing,
    expiresAt: expirationDate(months),
    trialUsed: true,
  };
  await saveProfiles(
    user.id,
    user.app_metadata,
    current.map((item) => (item.id === profileId ? profile : item)),
    { expires_at: null },
  );
  return publicProfile(profile);
}

export async function adminExtendProfile(userId: string, profileId: string, months: number) {
  assertUserId(userId);
  if (!/^[a-zA-Z0-9]{4,40}$/.test(profileId)) throw new AccountError("Profil introuvable", 400);
  if (!DURATIONS.includes(months as (typeof DURATIONS)[number])) {
    throw new AccountError("Durée invalide", 400);
  }
  const user = await accountUser(userId);
  const current = profilesOf(user.app_metadata);
  const existing = current.find((profile) => profile.id === profileId);
  if (!existing) throw new AccountError("Profil introuvable", 404);
  const profile: StoredProfile = {
    ...existing,
    expiresAt: extendExpiresAt(existing.expiresAt, months),
    trialUsed: true,
  };
  await saveProfiles(
    user.id,
    user.app_metadata,
    current.map((item) => (item.id === profileId ? profile : item)),
    { expires_at: null },
  );
  return publicProfile(profile);
}

export async function releaseDevice(id: string) {
  assertUserId(id);
  const supabase = client();
  const { data, error } = await supabase.auth.admin.getUserById(id);
  if (error || !data.user) throw new AccountError("Compte introuvable", 404);
  const { error: updateError } = await supabase.auth.admin.updateUserById(id, {
    app_metadata: keptMetadata(data.user.app_metadata, { device_id: null, profile_seats: {} }),
  });
  if (updateError) throw new AccountError(updateError.message, 400);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    await fetch(`${url.replace(/\/$/, "")}/auth/v1/admin/users/${id}/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    }).catch(() => undefined);
  }
  return { email: data.user.email };
}

export async function loginWeb(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase();
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new AccountError("Email ou mot de passe incorrect", 401);
  }
  return tokens(data.session);
}

export async function refreshWeb(refreshToken: string) {
  if (!refreshToken) throw new AccountError("Session expirée", 401);
  const { data, error } = await client().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) throw new AccountError("Session expirée", 401);
  return tokens(data.session);
}

export async function accountFromAccessToken(token: string): Promise<Account> {
  if (!token) throw new AccountError("Connexion requise", 401);
  const { data, error } = await client().auth.getUser(token);
  if (error || !data.user?.email) throw new AccountError("Session expirée", 401);
  return { id: data.user.id, email: data.user.email };
}

export async function login(emailRaw: string, password: string, deviceId: string) {
  if (!deviceId.trim()) throw new AccountError("Appareil inconnu", 400);
  const email = emailRaw.trim().toLowerCase();
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new AccountError("Email ou mot de passe incorrect", 401);
  }
  return tokens(data.session);
}

export async function refresh(refreshToken: string, deviceId: string) {
  if (!deviceId.trim()) throw new AccountError("Appareil inconnu", 400);
  if (!refreshToken) throw new AccountError("Session expirée", 401);
  const { data, error } = await client().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) throw new AccountError("Session expirée", 401);
  return tokens(data.session);
}

export async function presence(accessToken: string, deviceId: string, profileId = "") {
  if (!deviceId.trim()) throw new AccountError("Appareil inconnu", 400);
  const { data, error } = await client().auth.getUser(accessToken);
  if (error || !data.user?.email) throw new AccountError("Session expirée", 401);
  const watching = /^[a-zA-Z0-9]{4,40}$/.test(profileId);
  if (!watching) {
    return { ok: true, profile: true, expired: false, warning: null, warningMessage: null, daysLeft: null };
  }

  const profiles = profilesOf(data.user.app_metadata);
  const profile = profiles.find((item) => item.id === profileId);
  if (!profile) {
    return {
      ok: true,
      profile: false,
      expired: false,
      released: true,
      warning: null,
      warningMessage: null,
      daysLeft: null,
    };
  }

  const status = profileWarning(profile);
  if (status.expired) {
    const seats = seatsOf(data.user.app_metadata);
    if (seats[profileId]?.length) {
      clearProfileSeats(seats, profileId);
      await saveSeats(data.user.id, data.user.app_metadata, seats);
    }
    return {
      ok: true,
      profile: false,
      expired: true,
      released: true,
      catalogAccess: profile.catalogAccess,
      warning: status.warning,
      warningMessage: status.warningMessage,
      daysLeft: status.daysLeft,
    };
  }

  const now = Date.now();
  const pruned = pruneStaleSeats(seatsOf(data.user.app_metadata), now);
  const list = pruned.seats[profileId] || [];
  const mine = list.find((seat) => seat.deviceId === deviceId);
  let changed = pruned.changed;
  if (mine && now - mine.at >= SEAT_TOUCH_MS) {
    mine.at = now;
    changed = true;
  }
  if (changed) await saveSeats(data.user.id, data.user.app_metadata, pruned.seats);
  const held = Boolean(mine);
  const someoneElse = list.some((seat) => seat.deviceId !== deviceId && seatFresh(seat, now));
  return {
    ok: true,
    profile: held,
    expired: false,
    released: !held && !someoneElse,
    catalogAccess: profile.catalogAccess,
    warning: held ? status.warning : null,
    warningMessage: held ? status.warningMessage : null,
    daysLeft: held ? status.daysLeft : null,
  };
}

export async function accountFromRequest(request: Request): Promise<Account> {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return accountFromAccessToken(token);
}

export async function userFromToken(accessToken: string, deviceId: string) {
  if (!deviceId.trim()) throw new AccountError("Appareil inconnu", 400);
  const { data, error } = await client().auth.getUser(accessToken);
  if (error || !data.user) throw new AccountError("Session expirée", 401);
  return data.user;
}

async function saveProfiles(
  userId: string,
  metadata: Record<string, unknown> | undefined,
  profiles: StoredProfile[],
  extra: Record<string, unknown> = {},
) {
  const { error } = await client().auth.admin.updateUserById(userId, {
    app_metadata: keptMetadata(metadata, { profiles, account: "lifetime", ...extra }),
  });
  if (error) throw new AccountError(error.message, 400);
}

async function saveSeats(userId: string, metadata: Record<string, unknown> | undefined, seats: Record<string, ProfileSeat[]>) {
  const { error } = await client().auth.admin.updateUserById(userId, {
    app_metadata: keptMetadata(metadata, { profile_seats: seats }),
  });
  if (error) throw new AccountError(error.message, 400);
}

async function startTrialIfNeeded(user: User, profile: StoredProfile, deviceId: string) {
  if (profile.expiresAt || profile.trialUsed) return { profile, changed: false as const };

  const trials = trialsOf(user.app_metadata);
  if (trials[deviceId]) {
    throw new AccountError("Essai déjà utilisé sur cet appareil", 403);
  }

  const next: StoredProfile = {
    ...profile,
    expiresAt: new Date(Date.now() + TRIAL_MS).toISOString(),
    trialUsed: true,
  };
  trials[deviceId] = Date.now();
  const current = profilesOf(user.app_metadata).map((item) => (item.id === profile.id ? next : item));
  await saveProfiles(user.id, user.app_metadata, current, {
    device_trials: trials,
    expires_at: null,
  });
  return { profile: next, changed: true as const };
}

export async function claimProfile(accessToken: string, deviceId: string, profileId: string) {
  if (!/^[a-zA-Z0-9]{4,40}$/.test(profileId)) throw new AccountError("Profil introuvable", 400);
  let user = await userFromToken(accessToken, deviceId);
  let profiles = profilesOf(user.app_metadata);
  let profile = profiles.find((item) => item.id === profileId);
  if (!profile) throw new AccountError("Profil introuvable", 404);

  if (!profile.expiresAt && !profile.trialUsed) {
    const started = await startTrialIfNeeded(user, profile, deviceId);
    profile = started.profile;
    if (started.changed) {
      const refreshed = await client().auth.admin.getUserById(user.id);
      if (refreshed.data.user) user = refreshed.data.user;
      profiles = profilesOf(user.app_metadata);
      profile = profiles.find((item) => item.id === profileId) || profile;
    }
  }

  assertProfileUsable(profile);

  const seats = seatsOf(user.app_metadata);
  for (const id of Object.keys(seats)) {
    seats[id] = seats[id].filter((seat) => seat.deviceId !== deviceId);
    if (!seats[id].length) delete seats[id];
  }
  const list = seats[profileId] || [];
  const existing = list.find((seat) => seat.deviceId === deviceId);
  if (!existing) {
    list.push({ deviceId, at: Date.now() });
  } else {
    existing.at = Date.now();
  }
  list.sort((a, b) => a.at - b.at);
  while (list.length > PROFILE_SEATS) list.shift();
  seats[profileId] = list;
  await saveSeats(user.id, user.app_metadata, seats);
  return { ok: true, profile: publicProfile(profile) };
}

export async function releaseSeats(accessToken: string, deviceId: string) {
  const user = await userFromToken(accessToken, deviceId);
  const seats = seatsOf(user.app_metadata);
  let changed = false;
  for (const id of Object.keys(seats)) {
    const next = seats[id].filter((seat) => seat.deviceId !== deviceId);
    if (next.length !== seats[id].length) changed = true;
    if (next.length) seats[id] = next;
    else delete seats[id];
  }
  if (changed) await saveSeats(user.id, user.app_metadata, seats);
  return { ok: true };
}

export async function listProfiles(accessToken: string, deviceId: string) {
  const user = await userFromToken(accessToken, deviceId);
  return profilesOf(user.app_metadata).map((profile) => ({
    ...publicProfile(profile),
    pin: profile.pin,
  }));
}

export async function createProfile(
  _accessToken: string,
  _deviceId: string,
  _nameRaw: string,
  _pin: string,
  _idRaw = "",
  _color?: number,
) {
  throw new AccountError("Seul l'admin peut créer un profil", 403);
}

export async function updateProfile(
  accessToken: string,
  deviceId: string,
  id: string,
  currentPin: string,
  newPin: string,
) {
  if (!/^[a-zA-Z0-9]{4,40}$/.test(id) || !/^\d{4}$/.test(newPin)) {
    throw new AccountError("Code à 4 chiffres requis", 400);
  }
  const user = await userFromToken(accessToken, deviceId);
  const current = profilesOf(user.app_metadata);
  const existing = current.find((profile) => profile.id === id);
  if (!existing) throw new AccountError("Profil introuvable", 404);
  if (existing.pin && existing.pin !== currentPin) throw new AccountError("Code incorrect", 403);
  const profile = { ...existing, pin: newPin };
  await saveProfiles(user.id, user.app_metadata, current.map((item) => (item.id === id ? profile : item)));
  return { ...publicProfile(profile), pin: profile.pin };
}

export type ProfilePatch = {
  currentPin?: string;
  pin?: string;
  clearPin?: boolean;
  name?: string;
  color?: number;
};

export async function updateOwnProfile(
  accessToken: string,
  deviceId: string,
  id: string,
  patch: ProfilePatch,
) {
  if (!/^[a-zA-Z0-9]{4,40}$/.test(id)) throw new AccountError("Profil introuvable", 400);
  const user = await userFromToken(accessToken, deviceId);
  const current = profilesOf(user.app_metadata);
  const existing = current.find((profile) => profile.id === id);
  if (!existing) throw new AccountError("Profil introuvable", 404);

  const holds = holdsSeat(user.app_metadata, id, deviceId);
  const changingPin = patch.clearPin === true || typeof patch.pin === "string";
  const changingMeta =
    (typeof patch.name === "string" && patch.name.trim() && patch.name.trim() !== existing.name) ||
    (typeof patch.color === "number" && patch.color !== existing.color);

  if (existing.pin && (changingPin || !holds)) {
    if (existing.pin !== String(patch.currentPin || "")) {
      throw new AccountError("Code incorrect", 403);
    }
  }

  let pin = existing.pin;
  if (patch.clearPin) {
    pin = "";
  } else if (typeof patch.pin === "string") {
    if (patch.pin !== "" && !/^\d{4}$/.test(patch.pin)) {
      throw new AccountError("Code à 4 chiffres requis", 400);
    }
    pin = patch.pin;
  }

  const name = typeof patch.name === "string" ? patch.name.trim().slice(0, 18) : existing.name;
  if (!name) throw new AccountError("Nom requis", 400);
  const color =
    typeof patch.color === "number" && Number.isFinite(patch.color) ? patch.color : existing.color;

  if (!changingPin && !changingMeta && pin === existing.pin && name === existing.name && color === existing.color) {
    return publicProfile(existing);
  }

  const profile: StoredProfile = { ...existing, pin, name, color };
  await saveProfiles(
    user.id,
    user.app_metadata,
    current.map((item) => (item.id === id ? profile : item)),
  );
  return publicProfile(profile);
}

export async function changePassword(
  accessToken: string,
  currentPassword: string,
  newPassword: string,
) {
  if (newPassword.length < 8) throw new AccountError("Mot de passe trop court (8 min.)", 400);
  if (currentPassword === newPassword) {
    throw new AccountError("Choisis un mot de passe différent", 400);
  }
  const account = await accountFromAccessToken(accessToken);
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: currentPassword,
  });
  if (error || !data.session) throw new AccountError("Mot de passe actuel incorrect", 403);
  const { error: updateError } = await supabase.auth.admin.updateUserById(account.id, {
    password: newPassword,
  });
  if (updateError) throw new AccountError(updateError.message, 400);
  return { ok: true };
}

type WebDevice = { id: string; name: string; at: number; lastSeen: number };

function devicesOf(metadata: Record<string, unknown> | undefined): Record<string, WebDevice> {
  const value = metadata?.web_devices;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const devices: Record<string, WebDevice> = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(id) || !raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const name = String(item.name || "Appareil").slice(0, 48);
    const at = Number(item.at);
    const lastSeen = Number(item.lastSeen || at);
    if (!Number.isFinite(at)) continue;
    devices[id] = {
      id,
      name,
      at,
      lastSeen: Number.isFinite(lastSeen) ? lastSeen : at,
    };
  }
  return devices;
}

function trustOf(metadata: Record<string, unknown> | undefined): Record<string, Record<string, number>> {
  const value = metadata?.web_trust;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const trust: Record<string, Record<string, number>> = {};
  for (const [deviceId, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(deviceId) || !raw || typeof raw !== "object") continue;
    const map: Record<string, number> = {};
    for (const [profileId, expiry] of Object.entries(raw as Record<string, unknown>)) {
      const until = Number(expiry);
      if (!/^[a-zA-Z0-9]{4,40}$/.test(profileId) || !Number.isFinite(until) || until <= Date.now()) {
        continue;
      }
      map[profileId] = until;
    }
    if (Object.keys(map).length) trust[deviceId] = map;
  }
  return trust;
}

export function deviceLabelFromUa(ua = "") {
  const value = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(value)) return "iPhone / iPad";
  if (/android/.test(value)) return "Android";
  if (/mac os|macintosh/.test(value)) return "Mac";
  if (/windows/.test(value)) return "Windows";
  if (/linux/.test(value)) return "Linux";
  return "Navigateur web";
}

export async function touchWebDevice(accessToken: string, deviceId: string, name: string) {
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(deviceId)) throw new AccountError("Appareil inconnu", 400);
  const { data, error } = await client().auth.getUser(accessToken);
  if (error || !data.user) throw new AccountError("Session expirée", 401);
  const devices = devicesOf(data.user.app_metadata);
  const now = Date.now();
  const previous = devices[deviceId];
  devices[deviceId] = {
    id: deviceId,
    name: (name || previous?.name || "Navigateur web").slice(0, 48),
    at: previous?.at || now,
    lastSeen: now,
  };
  const entries = Object.values(devices).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 12);
  const next: Record<string, WebDevice> = {};
  for (const item of entries) next[item.id] = item;
  const { error: updateError } = await client().auth.admin.updateUserById(data.user.id, {
    app_metadata: keptMetadata(data.user.app_metadata, { web_devices: next }),
  });
  if (updateError) throw new AccountError(updateError.message, 400);
  return next[deviceId];
}

export async function listConnectedDevices(accessToken: string, currentDeviceId: string) {
  const { data, error } = await client().auth.getUser(accessToken);
  if (error || !data.user) throw new AccountError("Session expirée", 401);
  const devices = devicesOf(data.user.app_metadata);
  const seats = seatsOf(data.user.app_metadata);
  const profiles = profilesOf(data.user.app_metadata);
  const profileName = Object.fromEntries(profiles.map((profile) => [profile.id, profile.name]));

  const active = new Map<string, { profileIds: string[]; at: number }>();
  for (const [profileId, list] of Object.entries(seats)) {
    for (const seat of list) {
      const row = active.get(seat.deviceId) || { profileIds: [], at: seat.at };
      if (!row.profileIds.includes(profileId)) row.profileIds.push(profileId);
      row.at = Math.max(row.at, seat.at);
      active.set(seat.deviceId, row);
    }
  }

  const ids = new Set([...Object.keys(devices), ...active.keys()]);
  return [...ids].map((id) => {
    const device = devices[id];
    const seat = active.get(id);
    return {
      id,
      name: device?.name || deviceLabelFromUa(),
      current: id === currentDeviceId,
      lastSeen: device?.lastSeen || seat?.at || 0,
      profiles: (seat?.profileIds || []).map((profileId) => ({
        id: profileId,
        name: profileName[profileId] || profileId,
      })),
    };
  }).sort((a, b) => Number(b.current) - Number(a.current) || b.lastSeen - a.lastSeen);
}

export async function revokeDevice(accessToken: string, currentDeviceId: string, targetDeviceId: string) {
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(targetDeviceId)) throw new AccountError("Appareil inconnu", 400);
  if (targetDeviceId === currentDeviceId) {
    throw new AccountError("Utilise la déconnexion pour cet appareil", 400);
  }
  const { data, error } = await client().auth.getUser(accessToken);
  if (error || !data.user) throw new AccountError("Session expirée", 401);

  const seats = seatsOf(data.user.app_metadata);
  for (const id of Object.keys(seats)) {
    seats[id] = seats[id].filter((seat) => seat.deviceId !== targetDeviceId);
    if (!seats[id].length) delete seats[id];
  }
  const devices = devicesOf(data.user.app_metadata);
  delete devices[targetDeviceId];
  const trust = trustOf(data.user.app_metadata);
  delete trust[targetDeviceId];

  const { error: updateError } = await client().auth.admin.updateUserById(data.user.id, {
    app_metadata: keptMetadata(data.user.app_metadata, {
      profile_seats: seats,
      web_devices: devices,
      web_trust: trust,
    }),
  });
  if (updateError) throw new AccountError(updateError.message, 400);
  return { ok: true };
}

export async function trustProfileOnDevice(
  accessToken: string,
  deviceId: string,
  profileId: string,
  days = 14,
) {
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(deviceId) || !/^[a-zA-Z0-9]{4,40}$/.test(profileId)) {
    throw new AccountError("Appareil ou profil invalide", 400);
  }
  const { data, error } = await client().auth.getUser(accessToken);
  if (error || !data.user) throw new AccountError("Session expirée", 401);
  const trust = trustOf(data.user.app_metadata);
  const map = trust[deviceId] || {};
  map[profileId] = Date.now() + days * 24 * 60 * 60 * 1000;
  trust[deviceId] = map;
  const { error: updateError } = await client().auth.admin.updateUserById(data.user.id, {
    app_metadata: keptMetadata(data.user.app_metadata, { web_trust: trust }),
  });
  if (updateError) throw new AccountError(updateError.message, 400);
  return { ok: true, until: map[profileId] };
}

export async function isProfileTrusted(accessToken: string, deviceId: string, profileId: string) {
  const { data, error } = await client().auth.getUser(accessToken);
  if (error || !data.user) throw new AccountError("Session expirée", 401);
  const until = trustOf(data.user.app_metadata)[deviceId]?.[profileId] || 0;
  return until > Date.now();
}

export const PROFILE_COLOR_OPTIONS = PROFILE_COLORS;

export async function deleteProfile(_accessToken: string, _deviceId: string, _id: string) {
  throw new AccountError("Seul l'admin peut supprimer un profil", 403);
}

async function accountUser(id: string) {
  assertUserId(id);
  const { data, error } = await client().auth.admin.getUserById(id);
  if (error || !data.user) throw new AccountError("Compte introuvable", 404);
  return data.user;
}

export async function adminListProfiles(userId: string) {
  const user = await accountUser(userId);
  return profilesOf(user.app_metadata).map(publicProfile);
}

export async function adminCreateProfile(
  userId: string,
  nameRaw: string,
  pin: string,
  months: number | null = null,
  catalogRaw: unknown = "vod",
) {
  const name = nameRaw.trim();
  if (!name || !/^\d{4}$/.test(pin)) throw new AccountError("Nom et code à 4 chiffres requis", 400);
  const user = await accountUser(userId);
  const current = profilesOf(user.app_metadata);
  if (current.length >= MAX_PROFILES) throw new AccountError("5 profils maximum", 400);

  let expiresAt: string | null = null;
  let trialUsed = false;
  if (months !== null && months !== undefined) {
    if (!DURATIONS.includes(months as (typeof DURATIONS)[number])) {
      throw new AccountError("Durée invalide", 400);
    }
    expiresAt = expirationDate(months);
    trialUsed = true;
  }

  const profile: StoredProfile = {
    id: current.length === 0 ? "main" : crypto.randomUUID().replace(/-/g, ""),
    name: name.slice(0, 18),
    pin,
    color: PROFILE_COLORS[current.length % PROFILE_COLORS.length],
    expiresAt,
    trialUsed,
    catalogAccess: parseCatalogAccess(catalogRaw, "vod"),
  };
  await saveProfiles(user.id, user.app_metadata, [...current, profile], { expires_at: null });
  return publicProfile(profile);
}

export async function adminUpdateProfile(
  userId: string,
  id: string,
  nameRaw: string,
  pinRaw = "",
  catalogRaw?: unknown,
) {
  const name = nameRaw.trim();
  const nextPin = pinRaw.trim();
  if (!/^[a-zA-Z0-9]{4,40}$/.test(id) || !name) throw new AccountError("Profil invalide", 400);
  if (nextPin && !/^\d{4}$/.test(nextPin)) throw new AccountError("Code à 4 chiffres requis", 400);
  const user = await accountUser(userId);
  const current = profilesOf(user.app_metadata);
  const existing = current.find((profile) => profile.id === id);
  if (!existing) throw new AccountError("Profil introuvable", 404);
  const catalogAccess =
    catalogRaw === undefined || catalogRaw === null || String(catalogRaw).trim() === ""
      ? existing.catalogAccess
      : parseCatalogAccess(catalogRaw, existing.catalogAccess);
  const profile = {
    ...existing,
    name: name.slice(0, 18),
    pin: nextPin || existing.pin,
    catalogAccess,
  };
  await saveProfiles(user.id, user.app_metadata, current.map((item) => (item.id === id ? profile : item)));
  return publicProfile(profile);
}

export async function adminDeleteProfile(userId: string, id: string) {
  if (!/^[a-zA-Z0-9]{4,40}$/.test(id)) throw new AccountError("Profil introuvable", 400);
  const user = await accountUser(userId);
  const current = profilesOf(user.app_metadata);
  if (!current.some((profile) => profile.id === id)) throw new AccountError("Profil introuvable", 404);
  const seats = seatsOf(user.app_metadata);
  delete seats[id];
  await saveProfiles(user.id, user.app_metadata, current.filter((profile) => profile.id !== id), {
    profile_seats: seats,
  });
}

export async function listPublicProfiles(accessToken: string) {
  const { data, error } = await client().auth.getUser(accessToken);
  if (error || !data.user) throw new AccountError("Session expirée", 401);
  return profilesOf(data.user.app_metadata).map(publicProfile);
}

export async function verifyProfilePin(accessToken: string, profileId: string, pin: string) {
  if (!/^[a-zA-Z0-9]{4,40}$/.test(profileId)) throw new AccountError("Profil introuvable", 400);
  const { data, error } = await client().auth.getUser(accessToken);
  if (error || !data.user) throw new AccountError("Session expirée", 401);
  const profile = profilesOf(data.user.app_metadata).find((item) => item.id === profileId);
  if (!profile) throw new AccountError("Profil introuvable", 404);
  if (profile.pin.length === 4 && profile.pin !== pin) {
    throw new AccountError("Code incorrect", 403);
  }
  if (isExpired(profile)) {
    throw new AccountError("Profil expiré", 403);
  }
  return publicProfile(profile);
}

export function profileColorCss(color: number) {
  const hex = (color >>> 0).toString(16).padStart(8, "0").slice(-6);
  return `#${hex}`;
}

export async function logout(accessToken: string, deviceId = "") {
  if (!accessToken) return;
  if (deviceId.trim()) await releaseSeats(accessToken, deviceId).catch(() => undefined);
  const { error } = await client().auth.admin.signOut(accessToken);
  if (error) throw new AccountError("Session expirée", 401);
}

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}
