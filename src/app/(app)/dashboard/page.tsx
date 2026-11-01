import { eur, isBalanced, pct } from '@/lib/money';
import { supabaseServer } from '@/lib/supabase/server';

// Next 16 (cacheComponents) : la page lit la base à chaque requête, pas de prérendu.
export const instant = false;

type Kpis = {
  dossiers: number;
  dossiers_soldes: number;
  dossiers_ouverts: number;
  dossiers_impayes: number;
  facture: number;
  encaisse: number;
  reste: number;
  taux_recouvrement: number;
};

type Dossier = {
  id: string;
  numero: string;
  beneficiaire: string | null;
  facture: number;
  encaisse: number;
  reste: number;
  statut: 'solde' | 'acompte' | 'impaye' | 'vide';
};

type Cours = {
  id: string;
  nom: string;
  style: string;
  inscrits: number;
  capacite: number;
  complet: boolean;
};

const BADGE: Record<string, { label: string; cls: string }> = {
  solde: { label: 'Soldé', cls: 'bg-[#ECFDF5] text-[#15803D] border-[#BBF7D0]' },
  acompte: { label: 'Acompte', cls: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]' },
  impaye: { label: 'Impayé', cls: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]' },
  vide: { label: 'Vide', cls: 'bg-[#F4F4F8] text-[#6B6880] border-[#E8E7F0]' },
};

export default async function DashboardPage() {
  const supabase = await supabaseServer();

  const [{ data: kpiRows }, { data: dossierRows }, { data: coursRows }, { data: membreRows }] =
    await Promise.all([
      supabase.from('v_kpis').select('*').limit(1),
      supabase.from('v_dossiers').select('*').order('cree_le', { ascending: false }).limit(8),
      supabase.from('v_cours_occupation').select('*').order('inscrits', { ascending: false }).limit(6),
      supabase.from('v_membres').select('id, nom, prenom').limit(500),
    ]);

  const kpi: Kpis = (kpiRows?.[0] as Kpis) ?? {
    dossiers: 0, dossiers_soldes: 0, dossiers_ouverts: 0, dossiers_impayes: 0,
    facture: 0, encaisse: 0, reste: 0, taux_recouvrement: 0,
  };

  const dossiers = (dossierRows ?? []) as Dossier[];
  const cours = (coursRows ?? []) as Cours[];
  const noms = new Map(
    ((membreRows ?? []) as { id: string; nom: string; prenom: string }[]).map((m) => [
      m.id,
      `${m.prenom} ${m.nom}`,
    ]),
  );

  const equilibre = isBalanced(kpi.facture, kpi.encaisse, kpi.reste);

  return (
    <div className="px-6 py-6 lg:px-8">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-[#17151F]">Tableau de bord</h1>
          <p className="mt-0.5 text-[12.5px] text-[#6B6880]">
            Vue d’ensemble de la saison 2025 · 2026 — données lues en direct depuis la base
          </p>
        </div>
        <span className="rounded-full border border-[#E8E7F0] bg-white px-3 py-1.5 text-[12.5px] text-[#3D3A4D] shadow-sm">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#15803D] align-middle" />
          Base opérationnelle
        </span>
      </header>

      <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total facturé" value={eur(kpi.facture)} foot={`${kpi.dossiers} dossiers`} accent />
        <Kpi label="Total encaissé" value={eur(kpi.encaisse)} foot={`${pct(kpi.taux_recouvrement, 2)} du facturé`} />
        <Kpi label="Reste à encaisser" value={eur(kpi.reste)} foot={`${kpi.dossiers_ouverts} dossiers ouverts`} />
        <Kpi label="Dossiers impayés" value={String(kpi.dossiers_impayes)} foot={`${kpi.dossiers_soldes} dossiers soldés`} />
      </section>

      <section className="mt-3.5 grid gap-3.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-[#E8E7F0] bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-[#F1F0F7] px-4 py-3">
            <div>
              <h2 className="text-[14.5px] font-semibold text-[#17151F]">Derniers dossiers</h2>
              <p className="text-[12px] text-[#6B6880]">Les huit dossiers créés en dernier</p>
            </div>
            <span className="ml-auto rounded-full border border-[#E8E7F0] px-2.5 py-1 text-[11.5px] text-[#6B6880]">
              lecture seule
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#FBFBFE] text-[11px] uppercase tracking-wider text-[#6B6880]">
                  <th className="px-4 py-2.5 text-left font-semibold">Dossier</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Adhérent</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Statut</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Facturé</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Reste</th>
                </tr>
              </thead>
              <tbody>
                {dossiers.map((d) => {
                  const b = BADGE[d.statut] ?? BADGE.vide;
                  return (
                    <tr key={d.id} className="border-t border-[#F1F0F7] hover:bg-[#FCFCFE]">
                      <td className="px-4 py-2.5 font-mono text-[12.5px] font-semibold text-[#17151F]">
                        {d.numero}
                      </td>
                      <td className="px-4 py-2.5 text-[#3D3A4D]">
                        {d.beneficiaire ? noms.get(d.beneficiaire) ?? '—' : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11.5px] font-semibold ${b.cls}`}>
                          {b.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[#17151F]">{eur(d.facture)}</td>
                      <td
                        className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                          d.reste > 0 ? 'text-[#B91C1C]' : 'text-[#6B6880]'
                        }`}
                      >
                        {eur(d.reste)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3.5">
          <div className="rounded-2xl border border-[#E8E7F0] bg-white p-4 shadow-sm">
            <h2 className="text-[14.5px] font-semibold text-[#17151F]">Contrôle de cohérence</h2>
            <dl className="mt-3 space-y-2 text-[12.5px]">
              <div className="flex justify-between">
                <dt className="text-[#6B6880]">Facturé</dt>
                <dd className="font-semibold tabular-nums text-[#17151F]">{eur(kpi.facture)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#6B6880]">Encaissé</dt>
                <dd className="font-semibold tabular-nums text-[#17151F]">{eur(kpi.encaisse)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#6B6880]">Reste</dt>
                <dd className="font-semibold tabular-nums text-[#17151F]">{eur(kpi.reste)}</dd>
              </div>
            </dl>
            <div
              className={`mt-3 rounded-xl border px-3 py-2 text-[12.5px] ${
                equilibre
                  ? 'border-[#BBF7D0] bg-[#ECFDF5] text-[#14532D]'
                  : 'border-[#FECACA] bg-[#FEF2F2] text-[#7F1D1D]'
              }`}
            >
              {equilibre ? '✓ ' : '✕ '}
              {eur(kpi.encaisse)} + {eur(kpi.reste)} = <strong>{eur(kpi.facture)}</strong>
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-[#918EA6]">
              Calculé par la vue <code className="rounded bg-[#F4F3FA] px-1">v_kpis</code> : aucun total
              n’est stocké, donc rien ne peut se désynchroniser.
            </p>
          </div>

          <div className="rounded-2xl border border-[#E8E7F0] bg-white p-4 shadow-sm">
            <h2 className="text-[14.5px] font-semibold text-[#17151F]">Occupation des cours</h2>
            <div className="mt-3 space-y-2.5">
              {cours.map((c) => {
                const ratio = c.capacite ? Math.min(100, (c.inscrits / c.capacite) * 100) : 0;
                return (
                  <div key={c.id}>
                    <div className="mb-1 flex justify-between text-[12px]">
                      <span className="font-medium text-[#3D3A4D]">{c.nom}</span>
                      <span className="tabular-nums text-[#6B6880]">
                        {c.inscrits}/{c.capacite}
                        {c.complet && <span className="ml-1 text-[#B45309]">complet</span>}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#EFEEF6]">
                      <div
                        className={`h-full rounded-full ${c.complet ? 'bg-[#D97706]' : 'bg-[#6D28D9]'}`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  foot,
  accent = false,
}: {
  label: string;
  value: string;
  foot: string;
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
        className={`mt-1.5 text-[24px] font-semibold tracking-tight tabular-nums ${
          accent ? 'text-[#5B21B6]' : 'text-[#17151F]'
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[12px] text-[#918EA6]">{foot}</div>
    </div>
  );
}
