import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import type { Membre } from '@/lib/types';
import { Card, Kpi, PageHeader } from '@/components/ui';

const PAR_PAGE = 20;
// Next 16 (cacheComponents) : lecture en base à chaque requête.
export const instant = false;

export default async function AdherentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const supabase = await supabaseServer();

  let requete = supabase.from('v_membres').select('*', { count: 'exact' });
  if (q) requete = requete.or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,email.ilike.%${q}%`);

  const { data, count } = await requete
    .order('cree_le', { ascending: false })
    .range((page - 1) * PAR_PAGE, page * PAR_PAGE - 1);

  const membres = (data ?? []) as Membre[];
  const total = count ?? membres.length;
  const nbPages = Math.max(1, Math.ceil(total / PAR_PAGE));

  const { data: kpiRows } = await supabase.from('v_kpis').select('dossiers, facture').limit(1);
  const kpi = kpiRows?.[0] as { dossiers: number; facture: number } | undefined;

  const lien = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (p > 1) params.set('page', String(p));
    const s = params.toString();
    return `/adherents${s ? `?${s}` : ''}`;
  };

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        titre="Adhérents"
        sousTitre={`${total} adhérents — contacts masqués, les plus récents d’abord`}
        right={
          <span className="rounded-full border border-[#E8E7F0] bg-white px-3 py-1.5 text-[12.5px] text-[#3D3A4D] shadow-sm">
            lecture seule
          </span>
        }
      />

      <section className="grid gap-3.5 sm:grid-cols-3">
        <Kpi label="Adhérents" value={String(total)} foot={q ? `filtre « ${q} »` : 'saison 2025 · 2026'} accent />
        <Kpi label="Dossiers" value={String(kpi?.dossiers ?? '—')} foot="un dossier par adhérent" />
        <Kpi label="Facturé" value={
          (kpi?.facture ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
        } foot="toutes inscriptions confondues" />
      </section>

      <form action="/adherents" className="my-3.5 flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Nom, prénom ou e-mail…"
          className="min-w-[240px] flex-1 rounded-lg border border-[#E8E7F0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#6D28D9] focus:ring-4 focus:ring-[#EDE9FE]"
        />
        <button
          type="submit"
          className="rounded-lg bg-[#6D28D9] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#7C3AED]"
        >
          Rechercher
        </button>
      </form>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#FBFBFE] text-[11px] uppercase tracking-wider text-[#6B6880]">
                <th className="px-4 py-2.5 text-left font-semibold">Adhérent</th>
                <th className="px-4 py-2.5 text-left font-semibold">Contact</th>
                <th className="px-4 py-2.5 text-left font-semibold">Catégorie</th>
                <th className="px-4 py-2.5 text-right font-semibold">Âge</th>
                <th className="px-4 py-2.5 text-right font-semibold">Cours</th>
              </tr>
            </thead>
            <tbody>
              {membres.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-[#6B6880]">
                    Aucun adhérent ne correspond à cette recherche.
                  </td>
                </tr>
              )}
              {membres.map((m) => (
                <tr key={m.id} className="border-t border-[#F1F0F7] hover:bg-[#FCFCFE]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-[#EDE9FE] text-[11px] font-bold text-[#5B21B6]">
                        {(m.prenom[0] ?? '') + (m.nom[0] ?? '')}
                      </span>
                      <div>
                        <div className="font-semibold text-[#17151F]">
                          {m.prenom} {m.nom}
                        </div>
                        <div className="text-[11.5px] text-[#918EA6]">
                          inscrit le {new Date(m.cree_le).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-[#3D3A4D]">•••••••@•••</div>
                    <div className="text-[11.5px] text-[#918EA6]">{m.telephone ?? '—'}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full border border-[#E8E7F0] bg-[#F8F8FC] px-2 py-0.5 text-[11px] font-medium capitalize text-[#3D3A4D]">
                      {m.categorie}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#3D3A4D]">{m.age}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#17151F]">{m.nb_cours}</td>
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

      <p className="mt-3 text-[11.5px] text-[#918EA6]">
        Les e-mails et téléphones sont masqués dans la liste. La RLS garantit qu’un compte sans rôle actif ne voit
        aucune de ces lignes.
      </p>
    </div>
  );
}
