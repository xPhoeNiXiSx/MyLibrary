"use client";

import { useOptimistic, useTransition } from "react";

import { formatGaps } from "@/lib/format";

import { toggleVolumeAction } from "../actions";

/**
 * Tous les tomes en cases numérotées : possédé, manquant (un trou sous le plus
 * haut possédé) ou pas encore acheté. Un toucher coche ou décoche.
 *
 * La case change tout de suite, sans attendre la base : l'état optimiste est
 * remplacé par la vraie liste dès que l'action serveur a répondu.
 */
export function VolumeGrid({
  seriesId,
  owned,
  size,
  total,
}: {
  seriesId: string;
  owned: number[];
  size: number;
  total: number | null;
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
  const cells = Math.max(size, highest);

  function onToggle(number: number) {
    const willOwn = !set.has(number);
    startTransition(async () => {
      toggle(number);
      await toggleVolumeAction(seriesId, number, willOwn);
    });
  }

  return (
    <>
      <p className="owned-count">
        {current.length}
        {total !== null ? ` / ${total}` : ""} possédé{current.length > 1 ? "s" : ""}
      </p>

      <div className="stat-tiles">
        <div className="stat-tile accent">
          <span>Prochain achat</span>
          <strong>{upToDate ? "À jour" : `Tome ${highest + 1}`}</strong>
        </div>
        <div className="stat-tile">
          <span>Tomes manquants</span>
          <strong>{gaps.length === 0 ? "Aucun" : formatGaps(gaps, 4)}</strong>
        </div>
      </div>

      <div className="legend" aria-hidden="true">
        <span><i className="swatch owned" />Possédé</span>
        <span><i className="swatch gap" />Manquant</span>
        <span><i className="swatch later" />Pas encore</span>
      </div>
      <p className="hint">Touche un numéro pour le cocher ou le décocher.</p>

      <div className="volume-grid">
        {Array.from({ length: cells }, (_, index) => {
          const number = index + 1;
          const has = set.has(number);
          const state = has ? "owned" : number < highest ? "gap" : "later";
          const label = has ? "possédé" : state === "gap" ? "manquant" : "pas encore acheté";
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
    </>
  );
}
