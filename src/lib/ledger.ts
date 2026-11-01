/**
 * Contrat du grand livre V2.
 *
 * RÈGLE : la V2 ne lit jamais `public.payments` directement. Elle lit la vue
 * `public.v2_ledger` (voir `supabase/v2-contract.sql`) et agrège ici, en pur.
 *
 * Aucun composant ne fait de `reduce` sur des montants : tout passe par
 * `computeKpis()`, ce qui garantit un chiffre unique pour chaque indicateur.
 */

export type LedgerStatut = 'solde' | 'acompte' | 'impaye';

export type LedgerRow = {
  payment_id: string;
  member_id: string | null;
  titulaire: string | null;
  date_reglement: string | null;
  facture: number;
  encaisse: number;
  reste: number;
  statut: LedgerStatut;
};

export type Kpis = {
  dossiers: number;
  soldes: number;
  ouverts: number;
  facture: number;
  encaisse: number;
  reste: number;
  tauxRecouvrement: number;
};

const EMPTY: Kpis = {
  dossiers: 0,
  soldes: 0,
  ouverts: 0,
  facture: 0,
  encaisse: 0,
  reste: 0,
  tauxRecouvrement: 0,
};

/** Agrège des lignes déjà lues. Aucune estimation, aucun montant inventé. */
export function computeKpis(rows: readonly LedgerRow[]): Kpis {
  if (rows.length === 0) return { ...EMPTY };

  const acc = rows.reduce(
    (k, r) => {
      k.dossiers += 1;
      if (r.statut === 'solde') k.soldes += 1;
      else k.ouverts += 1;
      k.facture += r.facture;
      k.encaisse += r.encaisse;
      k.reste += r.reste;
      return k;
    },
    { dossiers: 0, soldes: 0, ouverts: 0, facture: 0, encaisse: 0, reste: 0 },
  );

  return {
    ...acc,
    tauxRecouvrement: acc.facture === 0 ? 0 : acc.encaisse / acc.facture,
  };
}

/**
 * Statut calculé à partir des montants — utilisé pour la vue de contrôle.
 * Impayé : rien reçu. Acompte : reçu partiel. Soldé : reste nul ou négatif.
 */
export function statutDe(facture: number, encaisse: number): LedgerStatut {
  const reste = facture - encaisse;
  if (reste <= 0) return 'solde';
  if (encaisse === 0) return 'impaye';
  return 'acompte';
}
