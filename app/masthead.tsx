import Link from "next/link";

import { Mark } from "./brand";

/**
 * En-tête commun : la marque, qui ramène à l'accueil, et l'accès au compte.
 * Les collections sont dans la barre d'onglets du bas.
 */
export function Masthead() {
  return (
    <header className="masthead">
      <Link href="/" className="wordmark">
        <Mark size={26} />
        <span>MyLibrary</span>
      </Link>
      <Link href="/compte" className="avatar" aria-label="Mon compte">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="8.5" r="3.5" />
            <path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" />
          </g>
        </svg>
      </Link>
    </header>
  );
}
