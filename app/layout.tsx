import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";
import { TabBar } from "./tab-bar";

/** Titres et texte : une seule famille, ronde et généreuse. */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

/**
 * Italique éditorial, réservé aux chiffres et à quelques accents (« Tome 87 »,
 * « Julie ») : il donne du relief sans multiplier les tailles de titre.
 */
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MyLibrary",
  description: "Mes mangas et mes jeux de société, rangés.",
  // Ce que iOS lit quand l'application est posée sur l'écran d'accueil.
  appleWebApp: {
    capable: true,
    title: "MyLibrary",
    statusBarStyle: "black-translucent",
  },
  // Next émet la balise standardisée `mobile-web-app-capable`. Les versions
  // d'iOS antérieures à 16.4 ne lisent que la variante préfixée : sans elle,
  // le raccourci rouvre le site dans Safari, barre d'adresse comprise.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1013",
  // Laisse la page occuper toute la dalle ; les encoches sont absorbées par
  // les `env(safe-area-inset-*)` du CSS.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${jakarta.variable} ${serif.variable}`}>
      <body>
        {children}
        <TabBar />
      </body>
    </html>
  );
}
