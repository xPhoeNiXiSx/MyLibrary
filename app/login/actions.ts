"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { checkPassword, closeSession, openSession } from "@/lib/auth";
import { clearFailures, lockedMinutes, recordFailure } from "@/lib/throttle";

export type LoginState = { error?: string };

/**
 * Adresse du client. Sur Vercel, `x-forwarded-for` est réécrit par la
 * plateforme : sa première valeur est fiable, pas fournie par le client.
 */
async function clientIp(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip") || "inconnue";
}

function waitMessage(minutes: number): string {
  return `Trop d'essais. Réessaie dans ${minutes} minute${minutes > 1 ? "s" : ""}.`;
}

export async function loginAction(
  _state: LoginState,
  form: FormData,
): Promise<LoginState> {
  const password = form.get("password");
  if (typeof password !== "string" || password === "") {
    return { error: "Saisis le mot de passe." };
  }

  const ip = await clientIp();

  // Vérifié avant le mot de passe : bloqué, même le bon est refusé, sinon le
  // blocage ne ralentirait rien.
  const locked = await lockedMinutes(ip);
  if (locked > 0) return { error: waitMessage(locked) };

  if (!checkPassword(password)) {
    await recordFailure(ip);
    const now = await lockedMinutes(ip);
    return { error: now > 0 ? waitMessage(now) : "Mot de passe incorrect." };
  }

  await clearFailures(ip);
  await openSession();

  const next = form.get("next");
  // On ne redirige que vers un chemin interne : un `next` absolu permettrait
  // de transformer la page de connexion en tremplin vers un autre site.
  const target =
    typeof next === "string" && /^\/[^/\\]/.test(next) ? next : "/";

  redirect(target);
}

export async function logoutAction(): Promise<void> {
  await closeSession();
  redirect("/");
}
