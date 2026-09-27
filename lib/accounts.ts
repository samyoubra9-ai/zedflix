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

function assertDevice(metadata: Record<string, unknown> | undefined, deviceId: string) {
  const current = deviceIdOf(metadata);
  if (current && current !== deviceId) {
    throw new AccountError("Ce compte est utilisé sur un autre appareil", 401);
  }
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
        deviceBound: Boolean(deviceIdOf(user.app_metadata)),
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
    app_metadata: keptMetadata(data.user.app_metadata, { device_id: null }),
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

export async function login(emailRaw: string, password: string, deviceId: string) {
  if (!deviceId.trim()) throw new AccountError("Appareil inconnu", 400);
  const email = emailRaw.trim().toLowerCase();
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new AccountError("Email ou mot de passe incorrect", 401);
  }
  assertActive(data.session.user.app_metadata);
  const { error: updateError } = await supabase.auth.admin.updateUserById(data.session.user.id, {
    app_metadata: keptMetadata(data.session.user.app_metadata, { device_id: deviceId }),
  });
  if (updateError) throw new AccountError(updateError.message, 500);
  await supabase.auth.admin.signOut(data.session.access_token, "others");
  return tokens(data.session);
}

export async function refresh(refreshToken: string, deviceId: string) {
  if (!refreshToken) throw new AccountError("Session expirée", 401);
  const { data, error } = await client().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) throw new AccountError("Session expirée", 401);
  assertActive(data.session.user.app_metadata);
  assertDevice(data.session.user.app_metadata, deviceId);
  return tokens(data.session);
}

export async function presence(accessToken: string, deviceId: string) {
  if (!deviceId.trim()) throw new AccountError("Appareil inconnu", 400);
  const { data, error } = await client().auth.getUser(accessToken);
  if (error || !data.user?.email) throw new AccountError("Session expirée", 401);
  assertActive(data.user.app_metadata);
  assertDevice(data.user.app_metadata, deviceId);
  return { ok: true };
}

export async function accountFromRequest(request: Request): Promise<Account> {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new AccountError("Connexion requise", 401);
  const { data, error } = await client().auth.getUser(token);
  if (error || !data.user?.email) throw new AccountError("Session expirée", 401);
  assertActive(data.user.app_metadata);
  return { id: data.user.id, email: data.user.email };
}

const PROFILE_COLORS = [-1767148, -4711132, -14725511, -13669553, -10732178];

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
    if (!/^[a-zA-Z0-9]{4,40}$/.test(id) || !name || !/^\d{4}$/.test(pin)) return [];
    return [{ id, name: name.slice(0, 18), pin, color: Number.isFinite(color) ? color : PROFILE_COLORS[0] }];
  }).slice(0, 5);
}

async function userFromToken(accessToken: string, deviceId: string) {
  if (!deviceId.trim()) throw new AccountError("Appareil inconnu", 400);
  const { data, error } = await client().auth.getUser(accessToken);
  if (error || !data.user) throw new AccountError("Session expirée", 401);
  assertActive(data.user.app_metadata);
  assertDevice(data.user.app_metadata, deviceId);
  return data.user;
}

async function saveProfiles(userId: string, metadata: Record<string, unknown> | undefined, profiles: StoredProfile[]) {
  const { error } = await client().auth.admin.updateUserById(userId, {
    app_metadata: keptMetadata(metadata, { profiles }),
  });
  if (error) throw new AccountError(error.message, 400);
}

export async function listProfiles(accessToken: string, deviceId: string) {
  const user = await userFromToken(accessToken, deviceId);
  return profilesOf(user.app_metadata);
}

export async function createProfile(
  accessToken: string,
  deviceId: string,
  nameRaw: string,
  pin: string,
  idRaw = "",
  color?: number,
) {
  const name = nameRaw.trim();
  if (!name || !/^\d{4}$/.test(pin)) throw new AccountError("Profil invalide", 400);
  const user = await userFromToken(accessToken, deviceId);
  const current = profilesOf(user.app_metadata);
  if (current.length >= 5) throw new AccountError("5 profils maximum", 400);
  const requested = idRaw.trim();
  const id = /^[a-zA-Z0-9]{4,40}$/.test(requested) && !current.some((profile) => profile.id === requested)
    ? requested
    : crypto.randomUUID().replace(/-/g, "");
  const profile: StoredProfile = {
    id,
    name: name.slice(0, 18),
    pin,
    color: Number.isFinite(color) ? Number(color) : PROFILE_COLORS[current.length % PROFILE_COLORS.length],
  };
  await saveProfiles(user.id, user.app_metadata, [...current, profile]);
  return profile;
}

export async function updateProfile(
  accessToken: string,
  deviceId: string,
  id: string,
  nameRaw: string,
  pin: string,
) {
  const name = nameRaw.trim();
  if (!/^[a-zA-Z0-9]{4,40}$/.test(id) || !name || !/^\d{4}$/.test(pin)) {
    throw new AccountError("Profil invalide", 400);
  }
  const user = await userFromToken(accessToken, deviceId);
  const current = profilesOf(user.app_metadata);
  const existing = current.find((profile) => profile.id === id);
  if (!existing) throw new AccountError("Profil introuvable", 404);
  const profile = { ...existing, name: name.slice(0, 18), pin };
  await saveProfiles(user.id, user.app_metadata, current.map((item) => (item.id === id ? profile : item)));
  return profile;
}

export async function deleteProfile(accessToken: string, deviceId: string, id: string) {
  if (!/^[a-zA-Z0-9]{4,40}$/.test(id)) throw new AccountError("Profil introuvable", 400);
  const user = await userFromToken(accessToken, deviceId);
  const current = profilesOf(user.app_metadata);
  if (!current.some((profile) => profile.id === id)) throw new AccountError("Profil introuvable", 404);
  await saveProfiles(user.id, user.app_metadata, current.filter((profile) => profile.id !== id));
}

export async function logout(accessToken: string) {
  if (!accessToken) return;
  const { error } = await client().auth.admin.signOut(accessToken);
  if (error) throw new AccountError("Session expirée", 401);
}

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}
