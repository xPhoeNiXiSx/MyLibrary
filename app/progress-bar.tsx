/**
 * Barre d'avancement d'une série. Les trous y sont marqués d'une encoche :
 * on voit d'un coup d'œil qu'il manque quelque chose avant la fin.
 */
export function ProgressBar({
  owned,
  total,
  gaps = [],
}: {
  owned: number;
  total: number | null;
  gaps?: number[];
}) {
  if (!total) return null;
  const pct = Math.min(100, Math.round((owned / total) * 100));
  return (
    <div className="bar" aria-hidden="true">
      <div className="bar-fill" style={{ width: `${pct}%` }} />
      {gaps.map((gap) => (
        <span key={gap} className="bar-gap" style={{ left: `${Math.min(100, (gap / total) * 100)}%` }} />
      ))}
    </div>
  );
}
