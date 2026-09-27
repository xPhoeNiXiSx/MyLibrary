"use client";

import { useFormStatus } from "react-dom";

/**
 * Bouton d'envoi qui se bloque pendant l'envoi. Certaines actions attendent
 * les sources en ligne plusieurs secondes : sans retour visible, on touche à
 * nouveau, et le formulaire part deux fois.
 */
export function SubmitButton({
  children,
  pending,
  className,
}: {
  children: React.ReactNode;
  /** Libellé pendant l'envoi. */
  pending: string;
  className?: string;
}) {
  const status = useFormStatus();
  return (
    <button type="submit" className={className} disabled={status.pending} aria-busy={status.pending}>
      {status.pending ? pending : children}
    </button>
  );
}
