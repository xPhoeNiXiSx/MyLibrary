import { gradientFor } from "./art";

/**
 * Couverture d'un tome. Sans image trouvée, une couverture dessinée : le
 * dégradé de la série, le numéro en italique et le titre en bas.
 *
 * `no-referrer` : certains hébergeurs d'images refusent l'affichage depuis un
 * autre site quand ils reçoivent son adresse en provenance.
 */
export function Cover({
  url,
  number,
  title,
  className = "cover",
}: {
  url: string | null | undefined;
  number: number;
  title: string;
  className?: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={`Couverture du tome ${number}`}
        className={className}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className={`${className} cover-art`} style={{ background: gradientFor(title) }} aria-hidden="true">
      <span className="cover-num">{number}</span>
      <span className="cover-title">{title}</span>
    </div>
  );
}
