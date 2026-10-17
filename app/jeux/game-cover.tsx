/**
 * Visuel d'une boîte de jeu, ou une vignette à l'initiale quand il n'y en a
 * pas. Une boîte n'est pas forcément carrée : l'image est contenue, pas
 * rognée, sur le fond de la vignette.
 */
export function GameCover({
  url,
  title,
  className = "game-cover",
}: {
  url: string | null;
  title: string;
  className?: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={className}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className={`${className} game-cover-empty`} aria-hidden="true">
      <span>{title.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}
