import Link from 'next/link';
import { eur } from '@/lib/money';
import { supabaseServer } from '@/lib/supabase/server';
import type { DossierLigne, Kpis, Membre } from '@/lib/types';
import { Card, Controle, Kpi, PageHeader, StatutBadge } from '@/components/ui';

const PAR_PAGE = 15;
// Next 16 (cacheComponents) : lecture en base à chaque requête.
export const instant = false;
const FILTRES = [
  { v: 'tous', l: 'Tous' },
  { v: 'impaye', l: 'Impayés' },
  { v: 'acompte', l: 'Acomptes' },
  { v: 'solde', l: 'Soldés' },
];

export default async function DossiersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const statut = sp.statut ?? 'tous';
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const supabase = await supabaseServer();

  const [{ data: kpiRows }, { data: membresMatch }] = await Promise.all([
    supabase.from('v_kpis').select('*').limit(1),
    q
      ? supabase.from('v_membres').select('id').or(`nom.ilike.%${q}%,prenom.ilike.%${q}%`).limit(300)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);

  const kpi = (kpiRows?.[0] as Kpis) ?? null;
  const ids = ((membresMatch ?? []) as { id: string }[]).map((m) => m.id);

  let requete = supabase.from('v_dossiers').select('*', { count: 'exact' });
  if (statut !== 'tous') requete = requete.eq('statut', statut);
  if (q) {
    requete = ids.length
      ? requete.or(`numero.ilike.%${q}%,beneficiaire.in.(${ids.join(',')})`)
      : requete.ilike('numero', `%${q}%`);
  }

  const { data: lignes, count } = await requete
    .order('cree_le', { ascending: false })
    .range((page - 1) * PAR_PAGE, page * PAR_PAGE - 1);

  const dossiers = (lignes ?? []) as DossierLigne[];
  const total = count ?? dossiers.length;
  const nbPages = Math.max(1, Math.ceil(total / PAR_PAGE));

  const { data: membresPage } = await supabase
    .from('v_membres')
    .select('id, nom, prenom')
    .in('id', dossiers.map((d) => d.beneficiaire).filter((x): x is string => Boolean(x)));

  const noms = new Map(
    ((membresPage ?? []) as Pick<Membre, 'id' | 'nom' | 'prenom'>[]).map((m) => [m.id, `${m.prenom} ${m.nom}`]),
  );

  const lien = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (statut !== 'tous') params.set('statut', statut);
    if (p > 1) params.set('page', String(p));
    const s = params.toString();
    return `/dossiers${s ? `?${s}` : ''}`;
  };

  const lienFiltre = (s: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (s !== 'tous') params.set('statut', s);
    const str = params.toString();
    return `/dossiers${str ? `?${str}` : ''}`;
  };

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        titre="Dossiers & paiements"
        sousTitre={`${total} dossiers — montants calculés par la vue v_dossiers`}
        right={
          <span className="rounded-full border border-[#E8E7F0] bg-white px-3 py-1.5 text-[12.5px] text-[#3D3A4D] shadow-sm">
            lecture seule
          </span>
        }
      />

      {kpi && (
        <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Total facturé" value={eur(kpi.facture)} foot={`${kpi.dossiers} dossiers`} accent />
          <Kpi label="Total encaissé" value={eur(kpi.encaisse)} foot={`${kpi.dossiers_soldes} dossiers soldés`} />
          <Kpi label="Reste à encaisser" value={eur(kpi.reste)} foot={`${kpi.dossiers_ouverts} dossiers ouverts`} />
          <Kpi label="Dossiers impayés" value={String(kpi.dossiers_impayes)} foot="aucun paiement reçu" />
        </section>
      )}

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <form action="/dossiers" className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Numéro de dossier, nom d’adhérent…"
              className="min-w-[240px] flex-1 rounded-lg border border-[#E8E7F0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#6D28D9] focus:ring-4 focus:ring-[#EDE9FE]"
            />
            {statut !== 'tous' && <input type="hidden" name="statut" value={statut} />}
            <button
              type="submit"
              className="rounded-lg bg-[#6D28D9] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#7C3AED]"
            >
              Rechercher
            </button>
          </form>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {FILTRES.map((f) => (
              <Link
                key={f.v}
                href={lienFiltre(f.v)}
                className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-medium ${
                  statut === f.v
                    ? 'border-[#6D28D9] bg-[#F5F3FF] text-[#5B21B6]'
                    : 'border-[#E8E7F0] bg-white text-[#3D3A4D] hover:border-[#D8D6E6]'
                }`}
              >
                {f.l}
              </Link>
            ))}
          </div>

          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#FBFBFE] text-[11px] uppercase tracking-wider text-[#6B6880]">
                    <th className="px-4 py-2.5 text-left font-semibold">Dossier</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Adhérent</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Statut</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Facturé</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Encaissé</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Reste</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {dossiers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-[#6B6880]">
                        Aucun dossier ne correspond à cette recherche.
                      </td>
                    </tr>
                  )}
                  {dossiers.map((d) => (
                    <tr key={d.id} className="border-t border-[#F1F0F7] hover:bg-[#FCFCFE]">
                      <td className="px-4 py-2.5 font-mono text-[12.5px] font-semibold text-[#17151F]">
                        {d.numero}
                      </td>
                      <td className="px-4 py-2.5 text-[#3D3A4D]">
                        {d.beneficiaire ? noms.get(d.beneficiaire) ?? '—' : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatutBadge statut={d.statut} />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{eur(d.facture)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{eur(d.encaisse)}</td>
                      <td
                        className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                          d.reste > 0 ? 'text-[#B91C1C]' : 'text-[#6B6880]'
                        }`}
                      >
                        {eur(d.reste)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/dossiers/${d.id}`}
                          className="rounded-lg border border-[#E8E7F0] px-2.5 py-1 text-[12px] font-medium text-[#3D3A4D] hover:border-[#6D28D9] hover:text-[#5B21B6]"
                        >
                          Ouvrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-2 border-t border-[#F1F0F7] px-4 py-3 text-[12.5px] text-[#6B6880]">
              <span>
                Page {page} sur {nbPages}
              </span>
              <div className="ml-auto flex gap-1.5">
                {page > 1 && (
                  <Link href={lien(page - 1)} className="rounded-lg border border-[#E8E7F0] px-2.5 py-1 hover:border-[#6D28D9]">
                    Précédent
                  </Link>
                )}
                {page < nbPages && (
                  <Link href={lien(page + 1)} className="rounded-lg border border-[#E8E7F0] px-2.5 py-1 hover:border-[#6D28D9]">
                    Suivant
                  </Link>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-3.5">
          <Card titre="Contrôle de cohérence">
            {kpi ? (
              <>
                <Controle facture={kpi.facture} encaisse={kpi.encaisse} reste={kpi.reste} />
                <p className="mt-3 text-[11.5px] leading-relaxed text-[#918EA6]">
                  Ces trois montants sont identiques sur tous les écrans : ils viennent de{' '}
                  <code className="rounded bg-[#F4F3FA] px-1">v_kpis</code>, jamais d’un calcul local.
                </p>
              </>
            ) : (
              <p className="text-[12.5px] text-[#6B6880]">Indicateurs indisponibles.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
