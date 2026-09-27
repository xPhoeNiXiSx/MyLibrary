import { Masthead } from "./masthead";

/**
 * Les écrans d'attente de la base, partagés par les pages qui la lisent :
 * elles doivent expliquer la même chose de la même façon.
 */

export function SetupScreen({
  title,
  missing,
}: {
  title: string;
  missing: string[];
}) {
  return (
    <main className="page narrow">
      <Masthead />
      <h1 className="page-title">{title}</h1>
      <div className="panel">
        <h2>Configuration incomplète</h2>
        <p className="hint">
          Il manque {missing.length > 1 ? "ces variables" : "cette variable"}{" "}
          d&apos;environnement côté Vercel :
        </p>
        <ul className="hint">
          {missing.map((name) => (
            <li key={name}>
              <code>{name}</code>
            </li>
          ))}
        </ul>
        <p className="hint">
          Settings → Environment Variables, puis redéploie. Le détail est dans
          le README.
        </p>
      </div>
    </main>
  );
}

export function DatabaseErrorScreen({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="page narrow">
      <Masthead />
      <h1 className="page-title">{title}</h1>
      <div className="panel">
        <h2>Base injoignable</h2>
        <p className="hint">{message}</p>
        <p className="hint">
          Si le message parle d&apos;une table ou d&apos;une colonne inconnue,
          une migration reste à appliquer : ouvre <strong>Mon compte</strong> et
          lance <strong>Appliquer les migrations</strong>. Sinon, vérifie{" "}
          <code>DATABASE_URL</code> dans les variables d&apos;environnement
          Vercel, puis redéploie.
        </p>
      </div>
    </main>
  );
}
