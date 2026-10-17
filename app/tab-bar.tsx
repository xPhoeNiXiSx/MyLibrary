"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Barre d'onglets fixée en bas : mangas, jeux, compte. Icône et libellé, un
 * seul toucher pour passer d'une collection à l'autre où qu'on soit.
 * Absente de la page de connexion, où elle ne mènerait nulle part.
 */

const TABS = [
  {
    href: "/",
    label: "Mangas",
    matches: (p: string) => p === "/" || p.startsWith("/series"),
    icon: (
      <>
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
        <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
      </>
    ),
  },
  {
    href: "/jeux",
    label: "Jeux",
    matches: (p: string) => p.startsWith("/jeux"),
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <circle cx="9" cy="9" r="0.9" />
        <circle cx="15" cy="9" r="0.9" />
        <circle cx="9" cy="15" r="0.9" />
        <circle cx="15" cy="15" r="0.9" />
      </>
    ),
  },
  {
    href: "/compte",
    label: "Compte",
    matches: (p: string) => p.startsWith("/compte"),
    icon: (
      <>
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" />
      </>
    ),
  },
];

export function TabBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/login")) return null;

  return (
    <nav className="tab-bar" aria-label="Collections">
      {TABS.map((tab) => {
        const active = tab.matches(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? "tab active" : "tab"}
            aria-current={active ? "page" : undefined}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {tab.icon}
              </g>
            </svg>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
