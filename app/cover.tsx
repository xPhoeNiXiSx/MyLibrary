/**
 * Couverture d'un tome, ou une vignette numérotée quand aucune source n'en a.
 *
 * `no-referrer` : certains hébergeurs d'images refusent l'affichage depuis un
 * autre site quand ils reçoivent son adresse en provenance.
 */
export function Cover({
  url,
  number,
  className = "cover",
}: {
  url: string | null | undefined;
  number: number;
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
    <div className={`${className} cover-empty`} aria-hidden="true">
      <span>T{number}</span>
    </div>
  );
}
