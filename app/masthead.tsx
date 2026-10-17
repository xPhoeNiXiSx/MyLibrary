import Link from "next/link";

/**
 * En-tête commun : la marque, qui ramène à l'accueil. Le compte et les
 * collections sont dans la barre d'onglets du bas.
 */
export function Masthead() {
  return (
    <header className="masthead">
      <div className="wordmark">
        <Link href="/">MyLibrary</Link>
      </div>
    </header>
  );
}
