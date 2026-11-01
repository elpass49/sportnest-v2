/**
 * Le seul endroit du projet où un montant devient une chaîne de caractères.
 * Toute l'application passe par `eur()` — aucune exception.
 */

const fmt = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 58804.108 → « 58 804,11 € » (jamais trois décimales). */
export function eur(n: number | null | undefined): string {
  return fmt.format(Number(n ?? 0));
}

/** Nombre de décimales réellement affichées — sert aux tests de régression. */
export function decimalsOf(value: string): number {
  const m = value.match(/[.,](\d+)/);
  return m ? m[1].length : 0;
}

export function pct(x: number, digits = 1): string {
  return `${(x * 100).toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} %`;
}

/**
 * Garantie affichée à l'écran : facturé = encaissé + reste, au centime.
 * Tolérance par défaut : un demi-centime (arrondis Postgres numeric → number).
 */
export function isBalanced(
  facture: number,
  encaisse: number,
  reste: number,
  tolerance = 0.005,
): boolean {
  return Math.abs(facture - (encaisse + reste)) <= tolerance;
}
