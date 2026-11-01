import { describe, expect, it } from 'vitest';
import { computeKpis, statutDe, type LedgerRow } from './ledger';
import { isBalanced } from './money';

const row = (facture: number, encaisse: number): LedgerRow => ({
  payment_id: `p-${facture}-${encaisse}`,
  member_id: null,
  titulaire: null,
  date_reglement: null,
  facture,
  encaisse,
  reste: facture - encaisse,
  statut: statutDe(facture, encaisse),
});

describe('computeKpis', () => {
  it('somme et se réconcilie au centime', () => {
    const k = computeKpis([row(215, 130), row(145, 0), row(190, 190)]);

    expect(k.dossiers).toBe(3);
    expect(k.facture).toBe(550);
    expect(k.encaisse).toBe(320);
    expect(k.reste).toBe(230);
    expect(k.soldes).toBe(1);
    expect(k.ouverts).toBe(2);
    expect(isBalanced(k.facture, k.encaisse, k.reste)).toBe(true);
  });

  it('ne produit jamais de pourcentage absurde sur un jeu vide', () => {
    const k = computeKpis([]);
    expect(k.facture).toBe(0);
    expect(k.reste).toBe(0);
    expect(k.tauxRecouvrement).toBe(0);
    expect(isBalanced(k.facture, k.encaisse, k.reste)).toBe(true);
  });

  it('classe un reste négatif (trop-perçu) en soldé', () => {
    const k = computeKpis([row(200, 250)]);
    expect(k.soldes).toBe(1);
    expect(k.reste).toBe(-50);
    // le trop-perçu reste visible, il n'est pas silencieusement ignoré
    expect(k.encaisse).toBe(250);
  });
});

describe('statutDe', () => {
  it.each([
    [200, 200, 'solde'],
    [200, 250, 'solde'],
    [200, 0, 'impaye'],
    [200, 80, 'acompte'],
  ])('%i facturé / %i encaissé → %s', (facture, encaisse, attendu) => {
    expect(statutDe(facture, encaisse)).toBe(attendu);
  });
});
