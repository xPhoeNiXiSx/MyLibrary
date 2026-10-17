import type { MetadataRoute } from "next";

/**
 * Manifeste d'application.
 *
 * Sans lui, un raccourci posé sur l'écran d'accueil iOS rouvre le site dans
 * une vue Safari, barre d'adresse comprise. `display: standalone` est ce qui
 * fait disparaître cette barre et garde la navigation dans l'application.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyLibrary",
    short_name: "MyLibrary",
    description: "Mes mangas et mes jeux de société, rangés.",
    lang: "fr",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1013",
    theme_color: "#0b1013",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
