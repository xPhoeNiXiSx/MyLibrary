"use client";

import { useOptimistic, useTransition } from "react";

import { Cover } from "../../cover";
import { ProgressBar } from "../../progress-bar";
import { toggleVolumeAction } from "../actions";

/**
 * L'avancement d'une série et la grille de ses tomes : possédé, manquant (un
 * trou sous le plus haut possédé) ou pas encore acheté. Un toucher coche ou
 * décoche.
 *
 * Tout ce qui se déduit des tomes cochés — repères, « À acheter », barre —
 * vit ici, côté navigateur : la case change tout de suite, sans attendre la
 * base, et l'état optimiste est remplacé par la vraie liste dès que l'action
 * serveur a répondu.
 */
export function VolumeGrid({
  seriesId,
  title,
  owned,
  size,
  total,
  covers,
}: {
  seriesId: string;
  title: string;
  owned: number[];
  size: number;
  total: number | null;
  covers: Record<number, string>;
}) {
  const [, startTransition] = useTransition();
  const [current, toggle] = useOptimistic(
    owned,
    (state: number[], number: number) =>
      state.includes(number)
        ? state.filter((n) => n !== number)
        : [...state, number].sort((a, b) => a - b),
  );

  const set = new Set(current);
  const highest = current.length > 0 ? Math.max(...current) : 0;
  const gaps: number[] = [];
  for (let n = 1; n < highest; n += 1) if (!set.has(n)) gaps.push(n);
  const upToDate = total !== null && highest >= total;
  const next = upToDate ? null : highest + 1;
  const cells = Math.max(size, highest);

  // Le suivant d'abord, puis les trous, trois au plus.
  const toBuy = [
    ...(next !== null ? [{ n: next, why: "Le suivant", kind: "next" }] : []),
    ...gaps.map((n) => ({ n, why: "Trou", kind: "gap" })),
  ].slice(0, 3);

  function onToggle(number: number) {
    const willOwn = !set.has(number);
    startTransition(async () => {
      toggle(number);
      await toggleVolumeAction(seriesId, number, willOwn);
    });
  }

  return (
    <>
      <div className="stat-tiles three">
        <div className="stat-tile">
          <strong>{current.length}</strong>
          <span>Possédés</span>
        </div>
        <div className="stat-tile">
          <strong className="lilac-text">{gaps.length}</strong>
          <span>Manquants</span>
        </div>
        <div className="stat-tile">
          <strong className="accent-text">{next === null ? "—" : `T${next}`}</strong>
          <span>{next === null ? "À jour" : "Prochain"}</span>
        </div>
      </div>

      <ProgressBar owned={current.length} total={total} gaps={gaps} />

      {toBuy.length > 0 ? (
        <section>
          <div className="section-head">
            <h2>À acheter</h2>
          </div>
          <ul className="to-buy">
            {toBuy.map(({ n, why, kind }) => (
              <li key={n} className={kind}>
                <Cover url={covers[n]} number={n} title={title} className="cover to-buy-cover" />
                <strong>Tome {n}</strong>
                <span>{why}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="section-head">
          <h2>Tous les tomes</h2>
          <span>Toucher pour cocher</span>
        </div>
        <div className="volume-grid">
          {Array.from({ length: cells }, (_, index) => {
            const number = index + 1;
            const has = set.has(number);
            const state = has ? "owned" : number < highest ? "gap" : number === next ? "next" : "later";
            const label = has ? "possédé" : state === "gap" ? "manquant" : state === "next" ? "le prochain à acheter" : "pas encore acheté";
            return (
              <button
                key={number}
                type="button"
                className={`volume ${state}`}
                aria-pressed={has}
                aria-label={`Tome ${number}, ${label}`}
                onClick={() => onToggle(number)}
              >
                {number}
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
