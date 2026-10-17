import type { Game } from "@/lib/games";

/**
 * Les champs d'un jeu, partagés par l'ajout à la main et la modification.
 * Tout est facultatif sauf le titre : un jeu sans durée connue reste un jeu.
 */
export function GameFields({ game }: { game?: Partial<Game> }) {
  const n = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));
  return (
    <>
      <label>
        Titre
        <input name="title" defaultValue={game?.title ?? ""} required />
      </label>
      <fieldset className="check-group">
        <legend>Statut</legend>
        <label className="check-row">
          <input type="radio" name="status" value="owned" defaultChecked={game?.status !== "wanted"} />
          <span>Je l&apos;ai</span>
        </label>
        <label className="check-row">
          <input type="radio" name="status" value="wanted" defaultChecked={game?.status === "wanted"} />
          <span>Je le veux</span>
        </label>
      </fieldset>
      <div className="row">
        <label className="grow">
          Joueurs min.
          <input name="minPlayers" inputMode="numeric" pattern="[0-9]*" defaultValue={n(game?.minPlayers)} />
        </label>
        <label className="grow">
          Joueurs max.
          <input name="maxPlayers" inputMode="numeric" pattern="[0-9]*" defaultValue={n(game?.maxPlayers)} />
        </label>
      </div>
      <div className="row">
        <label className="grow">
          Durée min. (min)
          <input name="minMinutes" inputMode="numeric" pattern="[0-9]*" defaultValue={n(game?.minMinutes)} />
        </label>
        <label className="grow">
          Durée max. (min)
          <input name="maxMinutes" inputMode="numeric" pattern="[0-9]*" defaultValue={n(game?.maxMinutes)} />
        </label>
      </div>
      <div className="row">
        <label className="grow">
          Âge min.
          <input name="minAge" inputMode="numeric" pattern="[0-9]*" defaultValue={n(game?.minAge)} />
        </label>
        <label className="grow">
          Année
          <input name="year" inputMode="numeric" pattern="[0-9]*" defaultValue={n(game?.year)} />
        </label>
      </div>
      <label>
        Auteur
        <input name="designer" defaultValue={game?.designer ?? ""} />
      </label>
      <label>
        Éditeur
        <input name="publisher" defaultValue={game?.publisher ?? ""} />
      </label>
      <label>
        Adresse de l&apos;image
        <input name="imageUrl" type="url" defaultValue={game?.imageUrl ?? ""} placeholder="https://…" />
        <small>Facultatif. Rempli tout seul quand le jeu vient de BoardGameGeek.</small>
      </label>
    </>
  );
}
