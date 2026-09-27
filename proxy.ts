import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, isAuthConfigured, verifyToken } from "@/lib/session";

/**
 * L'application entière est privée : pages et routes API.
 * Fermer au niveau du proxy plutôt que page par page évite qu'une route
 * ajoutée plus tard soit publique par oubli — le défaut devient « fermé ».
 *
 * Seule exception : la page de connexion elle-même, sans quoi il n'y aurait
 * aucun moyen d'entrer.
 */
const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path)) {
    return NextResponse.next();
  }

  // Sans mot de passe configuré, personne ne pourrait se connecter : verrouiller
  // enfermerait dehors sans moyen de diagnostic. Les pages concernées affichent
  // déjà un écran expliquant ce qui manque.
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }

  if (await verifyToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  /**
   * Tout sauf les fichiers servis par Next et le manifeste, qu'iOS récupère
   * sans session au moment de l'ajout à l'écran d'accueil.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)",
  ],
};
