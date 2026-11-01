import { describe, expect, it } from 'vitest';
import { decimalsOf, eur, isBalanced, pct } from './money';

/** Intl fr-FR utilise des espaces insécables : on les normalise pour tester. */
const norm = (s: string) => s.replace(/\u202f|\u00a0/g, ' ');

describe('eur', () => {
  it('formate à deux décimales, jamais trois', () => {
    expect(norm(eur(58804.108))).toBe('58 804,11 €');
    expect(decimalsOf(norm(eur(58804.108)))).toBe(2);
  });

  it('gère zéro, null et undefined sans NaN', () => {
    expect(norm(eur(0))).toBe('0,00 €');
    expect(norm(eur(null))).toBe('0,00 €');
    expect(norm(eur(undefined))).toBe('0,00 €');
  });
});

describe('pct', () => {
  it('affiche le pourcentage à la française', () => {
    expect(norm(pct(0.9797, 2))).toBe('97,97 %');
  });
});

describe('isBalanced', () => {
  it('accepte un écart d’arrondi sous le demi-centime', () => {
    expect(isBalanced(63486, 62196, 1290)).toBe(true);
    expect(isBalanced(63486, 62196.01, 1289.99)).toBe(true);
  });

  it('refuse un écart réel', () => {
    expect(isBalanced(63486, 62196, 2520)).toBe(false);
  });
});
