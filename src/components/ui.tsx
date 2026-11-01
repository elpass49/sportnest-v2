import type { ReactNode } from 'react';
import type { StatutDossier } from '@/lib/types';

const BADGE: Record<string, { label: string; cls: string }> = {
  solde: { label: 'Soldé', cls: 'bg-[#ECFDF5] text-[#15803D] border-[#BBF7D0]' },
  acompte: { label: 'Acompte', cls: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]' },
  impaye: { label: 'Impayé', cls: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]' },
  vide: { label: 'Vide', cls: 'bg-[#F4F4F8] text-[#6B6880] border-[#E8E7F0]' },
};

export function StatutBadge({ statut }: { statut: StatutDossier | string }) {
  const b = BADGE[statut] ?? BADGE.vide;
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11.5px] font-semibold ${b.cls}`}>
      {b.label}
    </span>
  );
}

export function Kpi({
  label,
  value,
  foot,
  accent = false,
}: {
  label: string;
  value: string;
  foot?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        accent ? 'border-[#DDD6FE] bg-gradient-to-b from-[#FAF8FF] to-white' : 'border-[#E8E7F0] bg-white'
      }`}
    >
      <div className="text-[12px] font-medium text-[#6B6880]">{label}</div>
      <div
        className={`mt-1.5 text-[24px] font-semibold tabular-nums tracking-tight ${
          accent ? 'text-[#5B21B6]' : 'text-[#17151F]'
        }`}
      >
        {value}
      </div>
      {foot && <div className="mt-1.5 text-[12px] text-[#918EA6]">{foot}</div>}
    </div>
  );
}

export function PageHeader({
  titre,
  sousTitre,
  right,
}: {
  titre: string;
  sousTitre?: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight text-[#17151F]">{titre}</h1>
        {sousTitre && <p className="mt-0.5 text-[12.5px] text-[#6B6880]">{sousTitre}</p>}
      </div>
      {right}
    </header>
  );
}

export function Card({
  titre,
  sousTitre,
  right,
  children,
  padded = true,
}: {
  titre?: string;
  sousTitre?: string;
  right?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8E7F0] bg-white shadow-sm">
      {(titre || right) && (
        <div className="flex items-center gap-3 border-b border-[#F1F0F7] px-4 py-3">
          <div>
            {titre && <h2 className="text-[14.5px] font-semibold text-[#17151F]">{titre}</h2>}
            {sousTitre && <p className="text-[12px] text-[#6B6880]">{sousTitre}</p>}
          </div>
          {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
        </div>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </div>
  );
}

export function Controle({ facture, encaisse, reste }: { facture: number; encaisse: number; reste: number }) {
  const ok = Math.abs(facture - (encaisse + reste)) <= 0.005;
  const eur = (n: number) =>
    n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

  return (
    <div
      className={`rounded-xl border px-3 py-2 text-[12.5px] ${
        ok ? 'border-[#BBF7D0] bg-[#ECFDF5] text-[#14532D]' : 'border-[#FECACA] bg-[#FEF2F2] text-[#7F1D1D]'
      }`}
    >
      {ok ? '✓ ' : '✕ '}
      {eur(encaisse)} + {eur(reste)} = <strong>{eur(facture)}</strong>
    </div>
  );
}
