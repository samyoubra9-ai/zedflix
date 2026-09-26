import { createClient, type Session } from "@supabase/supabase-js";

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
    adult: adultOf(session.user.app_metadata),
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

export function adultOf(metadata: Record<string, unknown> | undefined) {
  return metadata?.adult === true;
}

function keptMetadata(metadata: Record<string, unknown> | undefined, patch: Record<string, unknown>) {
  return { ...(metadata || {}), ...patch };
}

function assertDevice(metadata: Record<string, unknown> | undefined, deviceId: string) {
  const current = deviceIdOf(metadata);
  if (current && current !== deviceId) {
    throw new AccountError("Ce compte est utilisé sur un autre appareil", 401);
  }
}

export async function createAccount(emailRaw: string, password: string, months = 1, adult = false) {
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
    app_metadata: { expires_at: expirationDate(months), adult: adult === true },
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
      throw new AccountError("Un compte existe déjà avec cet email", 409);
    }
    throw new AccountError(error.message, error.status || 400);
  }
  return { email, months, adult: adult === true };
}

export async function listAccounts() {
  const { data, error } = await client().auth.admin.listUsers({ perPage: 200 });
  if (error) throw new AccountError(error.message, error.status || 500);
  return data.users
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
        adult: adultOf(user.app_metadata),
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
    app_metadata: { ...data.session.user.app_metadata, device_id: deviceId },
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
  return { ok: true, adult: adultOf(data.user.app_metadata) };
}

export async function setAdult(id: string, adult: boolean) {
  assertUserId(id);
  const supabase = client();
  const { data, error } = await supabase.auth.admin.getUserById(id);
  if (error || !data.user) throw new AccountError("Compte introuvable", 404);
  const enabled = adult === true;
  const { error: updateError } = await supabase.auth.admin.updateUserById(id, {
    app_metadata: keptMetadata(data.user.app_metadata, { adult: enabled }),
  });
  if (updateError) throw new AccountError(updateError.message, 400);
  return { email: data.user.email, adult: enabled };
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

export async function logout(accessToken: string) {
  if (!accessToken) return;
  const { error } = await client().auth.admin.signOut(accessToken);
  if (error) throw new AccountError("Session expirée", 401);
}

export function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}
