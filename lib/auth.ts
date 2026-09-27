import { cookies } from "next/headers";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  newToken,
  safeEquals,
  verifyToken,
} from "@/lib/session";

export { isAuthConfigured } from "@/lib/session";

/**
 * Authentification volontairement minimale : un mot de passe unique, pas de
 * comptes. Il n'y a qu'un utilisateur, et l'application entière lui est
 * réservée — c'est le middleware qui ferme la porte, ces fonctions ne servent
 * qu'à ouvrir et fermer la session.
 */

export function checkPassword(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    throw new Error(
      "APP_PASSWORD n'est pas définie. Ajoute-la dans les variables d'environnement Vercel.",
    );
  }
  return safeEquals(candidate, expected);
}

export async function openSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, await newToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function closeSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function isAuthenticated(): Promise<boolean> {
  return verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
}
