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
  };
}

export function registrationOpen() {
  return process.env.ALLOW_REGISTRATION !== "false";
}

export function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function register(emailRaw: string, password: string) {
  if (!registrationOpen()) {
    throw new AccountError("Les inscriptions sont fermées", 403);
  }
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AccountError("Email invalide", 400);
  }
  if (password.length < 8) {
    throw new AccountError("Le mot de passe doit faire au moins 8 caractères", 400);
  }

  const supabase = client();
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
      throw new AccountError("Un compte existe déjà avec cet email", 409);
    }
    throw new AccountError(error.message, error.status || 400);
  }
  return login(email, password);
}

export async function login(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase();
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new AccountError("Email ou mot de passe incorrect", 401);
  }
  return tokens(data.session);
}

export async function refresh(refreshToken: string) {
  if (!refreshToken) throw new AccountError("Session expirée", 401);
  const { data, error } = await client().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) throw new AccountError("Session expirée", 401);
  return tokens(data.session);
}

export async function accountFromRequest(request: Request): Promise<Account> {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new AccountError("Connexion requise", 401);
  const { data, error } = await client().auth.getUser(token);
  if (error || !data.user?.email) throw new AccountError("Session expirée", 401);
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
