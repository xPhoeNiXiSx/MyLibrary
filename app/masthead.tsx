import Link from "next/link";

/**
 * En-tête commun. Le nom s'écrit en texte en attendant un logotype : la
 * marque de MyCards n'a pas vocation à être reprise ici.
 */
export function Masthead({ account = true }: { account?: boolean }) {
  return (
    <header className="masthead">
      <div className="wordmark">
        <Link href="/">MyLibrary</Link>
      </div>
      {account ? (
        <nav>
          <Link href="/compte">Mon compte</Link>
        </nav>
      ) : null}
    </header>
  );
}
