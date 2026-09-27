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

export function expirationDate(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

function expiresAtOf(metadata: Record<string, unknown> | undefined) {
  const value = metadata?.expires_at;
  return typeof value === "string" ? value : null;
}

function assertActive(metadata: Record<string, unknown> | undefined) {
  const expiresAt = expiresAtOf(metadata);
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
    throw new AccountError("Compte expiré", 403);
  }
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

const PROFILE_SEATS = 2;

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

function holdsSeat(metadata: Record<string, unknown> | undefined, profileId: string, deviceId: string) {
  return (seatsOf(metadata)[profileId] || []).some((seat) => seat.deviceId === deviceId);
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

  const supabase = client();
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { expires_at: expirationDate(months) },
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
      throw new AccountError("Un compte existe déjà avec cet email", 409);
    }
    throw new AccountError(error.message, error.status || 400);
  }
  return { email, months };
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
      const expiresAt = expiresAtOf(user.app_metadata);
      const expired = Boolean(expiresAt && Date.parse(expiresAt) <= Date.now());
      return {
        id: user.id,
        email: user.email as string,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
        expiresAt,
        expired,
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
  const current = expiresAtOf(data.user.app_metadata);
  const base = current && Date.parse(current) > Date.now() ? new Date(current) : new Date();
  base.setMonth(base.getMonth() + months);
  const expiresAt = base.toISOString();
  const { error: updateError } = await supabase.auth.admin.updateUserById(id, {
    app_metadata: keptMetadata(data.user.app_metadata, { expires_at: expiresAt }),
  });
  if (updateError) throw new AccountError(updateError.message, 400);
  return { email: data.user.email, expiresAt, months };
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
  assertActive(data.session.user.app_metadata);
  return tokens(data.session);
}

export async function refreshWeb(refreshToken: string) {
  if (!refreshToken) throw new AccountError("Session expirée", 401);
  const { data, error } = await client().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) throw new AccountError("Session expirée", 401);
  assertActive(data.session.user.app_metadata);
  return tokens(data.session);
}

export async function accountFromAccessToken(token: string): Promise<Account> {
  if (!token) throw new AccountError("Connexion requise", 401);
  const { data, error } = await client().auth.getUser(token);
  if (error || !data.user?.email) throw new AccountError("Session expirée", 401);
  assertActive(data.user.app_metadata);
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
  assertActive(data.session.user.app_metadata);
  return tokens(data.session);
}

export async function refresh(refreshToken: string, deviceId: string) {
  if (!deviceId.trim()) throw new AccountError("Appareil inconnu", 400);
  if (!refreshToken) throw new AccountError("Session expirée", 401);
  const { data, error } = await client().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) throw new AccountError("Session expirée", 401);
  assertActive(data.session.user.app_metadata);
  return tokens(data.session);
}

export async function presence(accessToken: string, deviceId: string, profileId = "") {
  if (!deviceId.trim()) throw new AccountError("Appareil inconnu", 400);
  const { data, error } = await client().auth.getUser(accessToken);
  if (error || !data.user?.email) throw new AccountError("Session expirée", 401);
  assertActive(data.user.app_metadata);
  const watching = /^[a-zA-Z0-9]{4,40}$/.test(profileId);
  return {
    ok: true,
    profile: !watching || holdsSeat(data.user.app_metadata, profileId, deviceId),
  };
}

export async function accountFromRequest(request: Request): Promise<Account> {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return accountFromAccessToken(token);
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
};

function profilesOf(metadata: Record<string, unknown> | undefined): StoredProfile[] {
  const value = metadata?.profiles;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const profile = item as Record<string, unknown>;
    const id = String(profile.id || "");
    const name = String(profile.name || "").trim();
    const pin = String(profile.pin || "");
    const color = Number(profile.color);
    if (!/^[a-zA-Z0-9]{4,40}$/.test(id) || !name || !validPin(pin)) return [];
    return [{ id, name: name.slice(0, 18), pin, color: Number.isFinite(color) ? color : PROFILE_COLORS[0] }];
  }).slice(0, 5);
}

export async function userFromToken(accessToken: string, deviceId: string) {
  if (!deviceId.trim()) throw new AccountError("Appareil inconnu", 400);
  const { data, error } = await client().auth.getUser(accessToken);
  if (error || !data.user) throw new AccountError("Session expirée", 401);
  assertActive(data.user.app_metadata);
  return data.user;
}

async function saveProfiles(
  userId: string,
  metadata: Record<string, unknown> | undefined,
  profiles: StoredProfile[],
  extra: Record<string, unknown> = {},
) {
  const { error } = await client().auth.admin.updateUserById(userId, {
    app_metadata: keptMetadata(metadata, { profiles, ...extra }),
  });
  if (error) throw new AccountError(error.message, 400);
}

async function saveSeats(userId: string, metadata: Record<string, unknown> | undefined, seats: Record<string, ProfileSeat[]>) {
  const { error } = await client().auth.admin.updateUserById(userId, {
    app_metadata: keptMetadata(metadata, { profile_seats: seats }),
  });
  if (error) throw new AccountError(error.message, 400);
}

export async function claimProfile(accessToken: string, deviceId: string, profileId: string) {
  if (!/^[a-zA-Z0-9]{4,40}$/.test(profileId)) throw new AccountError("Profil introuvable", 400);
  const user = await userFromToken(accessToken, deviceId);
  if (!profilesOf(user.app_metadata).some((profile) => profile.id === profileId)) {
    throw new AccountError("Profil introuvable", 404);
  }
  const seats = seatsOf(user.app_metadata);
  for (const id of Object.keys(seats)) {
    seats[id] = seats[id].filter((seat) => seat.deviceId !== deviceId);
    if (!seats[id].length) delete seats[id];
  }
  const list = seats[profileId] || [];
  list.push({ deviceId, at: Date.now() });
  list.sort((a, b) => a.at - b.at);
  while (list.length > PROFILE_SEATS) list.shift();
  seats[profileId] = list;
  await saveSeats(user.id, user.app_metadata, seats);
  return { ok: true };
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
  return profilesOf(user.app_metadata);
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
  return profile;
}

export async function deleteProfile(_accessToken: string, _deviceId: string, _id: string) {
  throw new AccountError("Seul l'admin peut supprimer un profil", 403);
}

function publicProfile(profile: StoredProfile) {
  return {
    id: profile.id,
    name: profile.name,
    color: profile.color,
    locked: profile.pin.length === 4,
  };
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

export async function adminCreateProfile(userId: string, nameRaw: string, pin: string) {
  const name = nameRaw.trim();
  if (!name || !/^\d{4}$/.test(pin)) throw new AccountError("Nom et code à 4 chiffres requis", 400);
  const user = await accountUser(userId);
  const current = profilesOf(user.app_metadata);
  if (current.length >= 5) throw new AccountError("5 profils maximum", 400);
  const profile: StoredProfile = {
    id: current.length === 0 ? "main" : crypto.randomUUID().replace(/-/g, ""),
    name: name.slice(0, 18),
    pin,
    color: PROFILE_COLORS[current.length % PROFILE_COLORS.length],
  };
  await saveProfiles(user.id, user.app_metadata, [...current, profile]);
  return publicProfile(profile);
}

export async function adminUpdateProfile(userId: string, id: string, nameRaw: string, pinRaw = "") {
  const name = nameRaw.trim();
  const nextPin = pinRaw.trim();
  if (!/^[a-zA-Z0-9]{4,40}$/.test(id) || !name) throw new AccountError("Profil invalide", 400);
  if (nextPin && !/^\d{4}$/.test(nextPin)) throw new AccountError("Code à 4 chiffres requis", 400);
  const user = await accountUser(userId);
  const current = profilesOf(user.app_metadata);
  const existing = current.find((profile) => profile.id === id);
  if (!existing) throw new AccountError("Profil introuvable", 404);
  const profile = { ...existing, name: name.slice(0, 18), pin: nextPin || existing.pin };
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
  assertActive(data.user.app_metadata);
  return profilesOf(data.user.app_metadata).map(publicProfile);
}

export async function verifyProfilePin(accessToken: string, profileId: string, pin: string) {
  if (!/^[a-zA-Z0-9]{4,40}$/.test(profileId)) throw new AccountError("Profil introuvable", 400);
  const { data, error } = await client().auth.getUser(accessToken);
  if (error || !data.user) throw new AccountError("Session expirée", 401);
  assertActive(data.user.app_metadata);
  const profile = profilesOf(data.user.app_metadata).find((item) => item.id === profileId);
  if (!profile) throw new AccountError("Profil introuvable", 404);
  if (profile.pin.length === 4 && profile.pin !== pin) {
    throw new AccountError("Code incorrect", 403);
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
