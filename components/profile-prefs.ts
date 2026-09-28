"use client";

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64ToBuffer(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

function bioKey(profileId: string) {
  return `minuit_bio:${profileId}`;
}

export async function biometricAvailable() {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function enrollBiometric(profileId: string) {
  if (!(await biometricAvailable())) return false;
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Minuit", id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(profileId),
        name: profileId,
        displayName: profileId,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) return false;
  localStorage.setItem(bioKey(profileId), bufferToBase64(cred.rawId));
  return true;
}

export async function verifyBiometric(profileId: string) {
  if (!(await biometricAvailable())) return false;
  const stored = localStorage.getItem(bioKey(profileId));
  if (!stored) return false;
  try {
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: window.location.hostname,
        allowCredentials: [{ id: base64ToBuffer(stored), type: "public-key" }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    return Boolean(cred);
  } catch {
    return false;
  }
}

export function hasBiometric(profileId: string) {
  try {
    return Boolean(localStorage.getItem(bioKey(profileId)));
  } catch {
    return false;
  }
}

export function lastProfileId() {
  try {
    return localStorage.getItem("minuit_last_profile") || "";
  } catch {
    return "";
  }
}

export function saveLastProfileId(profileId: string) {
  try {
    localStorage.setItem("minuit_last_profile", profileId);
  } catch {
    /* ignore */
  }
}
