import { gradientFor } from "../art";

/**
 * Visuel d'une boîte de jeu. Une boîte n'est pas forcément carrée : l'image
 * est contenue, pas rognée. Sans image, une boîte dessinée au nom du jeu.
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
    return <img src={url} alt="" className={className} loading="lazy" referrerPolicy="no-referrer" />;
  }
  return (
    <div className={`${className} game-cover-empty`} style={{ background: gradientFor(title) }} aria-hidden="true">
      <span>{title}</span>
    </div>
  );
}
