/**
 * Vérification du cookie de session, sans dépendance à `next/headers`.
 *
 * Isolé pour cette raison précise : le middleware tourne en amont du rendu et
 * ne peut pas utiliser l'API `cookies()`. Les deux côtés partagent donc cette
 * logique plutôt que d'en maintenir deux copies qui finiraient par diverger.
 */

export const SESSION_COOKIE = "mylibrary_session";

/** 30 jours : on n'est pas sur des données bancaires. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/** `true` si les variables d'environnement d'authentification sont en place. */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD && process.env.AUTH_SECRET);
}

export async function signPayload(payload: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET n'est pas définie. Ajoute-la dans les variables d'environnement Vercel.",
    );
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Comparaison à temps constant, pour ne pas fuiter le secret octet par octet. */
export function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function newToken(): Promise<string> {
  const issued = String(Date.now());
  return signPayload(issued).then((signature) => `${issued}.${signature}`);
}

/** Vérifie signature et fraîcheur. Ne lève jamais : renvoie `false`. */
export async function verifyToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;

  const [issued, signature] = token.split(".");
  if (!issued || !signature) return false;

  try {
    if (!safeEquals(signature, await signPayload(issued))) return false;
  } catch {
    return false;
  }

  const age = Date.now() - Number(issued);
  return Number.isFinite(age) && age >= 0 && age < SESSION_MAX_AGE * 1000;
}
