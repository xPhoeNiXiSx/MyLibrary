/**
 * La marque : un livre menthe et un dé lilas, posés l'un contre l'autre comme
 * sur une étagère — une forme par collection. Couleurs pleines plutôt que
 * dégradés : plusieurs marques sur une page ne se disputent pas d'identifiants.
 */
export function Mark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
    >
      <rect x="6" y="15" width="32" height="40" rx="11" fill="#5eead4" />
      <rect x="9" y="47" width="20" height="3.5" rx="1.75" fill="#062a26" opacity="0.45" />
      <rect x="25" y="8" width="33" height="33" rx="11" fill="#c4b5fd" />
      <circle cx="35.5" cy="18.5" r="3" fill="#0b1013" />
      <circle cx="47.5" cy="30.5" r="3" fill="#0b1013" />
    </svg>
  );
}
