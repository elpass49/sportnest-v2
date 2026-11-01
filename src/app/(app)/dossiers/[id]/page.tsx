import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eur } from '@/lib/money';
import { supabaseServer } from '@/lib/supabase/server';
import type { DossierLigne, LigneDossier, Membre, Paiement } from '@/lib/types';
import { Card, Controle, Kpi, PageHeader, StatutBadge } from '@/components/ui';

// Next 16 (cacheComponents) : lecture en base à chaque requête.
export const instant = false;

const TYPE_LABEL: Record<string, string> = {
  adhesion: 'Adhésion',
  cours: 'Cours',
  remise: 'Remise',
  frais: 'Frais',
};

const MOYEN_LABEL: Record<string, string> = {
  cb: 'Carte bancaire',
  sepa: 'Prélèvement SEPA',
  especes: 'Espèces',
  cheque: 'Chèque',
  helloasso: 'HelloAsso',
  virement: 'Virement',
};

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: dossierRows } = await supabase.from('v_dossiers').select('*').eq('id', id).limit(1);
  const dossier = (dossierRows?.[0] as DossierLigne | undefined) ?? null;
  if (!dossier) notFound();

  const [{ data: lignesRows }, { data: paiementsRows }, { data: membreRows }] = await Promise.all([
    supabase.from('lignes_dossier').select('*').eq('dossier_id', id).order('libelle'),
    supabase.from('paiements').select('*').eq('dossier_id', id).order('encaisse_le', { ascending: false }),
    dossier.beneficiaire
      ? supabase.from('v_membres').select('id, nom, prenom, email').eq('id', dossier.beneficiaire).limit(1)
      : Promise.resolve({ data: [] as Pick<Membre, 'id' | 'nom' | 'prenom' | 'email'>[] }),
  ]);

  const lignes = (lignesRows ?? []) as LigneDossier[];
  const paiements = (paiementsRows ?? []) as Paiement[];
  const membre = ((membreRows ?? []) as Pick<Membre, 'id' | 'nom' | 'prenom' | 'email'>[])[0] ?? null;

  return (
    <div className="px-6 py-6 lg:px-8">
      <Link href="/dossiers" className="mb-3 inline-block text-[12.5px] text-[#6B6880] hover:text-[#5B21B6]">
        ← Retour aux dossiers
      </Link>

      <PageHeader
        titre={dossier.numero}
        sousTitre={membre ? `${membre.prenom} ${membre.nom}` : 'Adhérent non rattaché'}
        right={<StatutBadge statut={dossier.statut} />}
      />

      <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Montant facturé" value={eur(dossier.facture)} accent />
        <Kpi label="Encaissé" value={eur(dossier.encaisse)} foot={`${paiements.length} paiement(s)`} />
        <Kpi label="Reste" value={eur(dossier.reste)} foot={dossier.reste > 0 ? 'à relancer' : 'soldé'} />
        <div className="rounded-2xl border border-[#E8E7F0] bg-white p-4 shadow-sm">
          <div className="mb-2 text-[12px] font-medium text-[#6B6880]">Contrôle</div>
          <Controle facture={dossier.facture} encaisse={dossier.encaisse} reste={dossier.reste} />
        </div>
      </section>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
        <Card titre="Détail des lignes" sousTitre={`${lignes.length} ligne(s)`} padded={false}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#FBFBFE] text-[11px] uppercase tracking-wider text-[#6B6880]">
                <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                <th className="px-4 py-2.5 text-left font-semibold">Libellé</th>
                <th className="px-4 py-2.5 text-right font-semibold">Montant</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id} className="border-t border-[#F1F0F7]">
                  <td className="px-4 py-2.5">
                    <span className="rounded-full border border-[#E8E7F0] bg-[#F8F8FC] px-2 py-0.5 text-[11px] font-medium text-[#3D3A4D]">
                      {TYPE_LABEL[l.type] ?? l.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[#3D3A4D]">{l.libelle}</td>
                  <td
                    className={`px-4 py-2.5 text-right tabular-nums ${
                      l.montant < 0 ? 'text-[#15803D]' : 'text-[#17151F]'
                    }`}
                  >
                    {eur(l.montant)}
                  </td>
                </tr>
              ))}
              {lignes.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-[12.5px] text-[#6B6880]">
                    Aucune ligne sur ce dossier.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#E8E7F0] bg-[#FBFBFE]">
                <td colSpan={2} className="px-4 py-2.5 text-[12.5px] font-semibold text-[#3D3A4D]">
                  Total facturé
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{eur(dossier.facture)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>

        <Card titre="Paiements" sousTitre="Journal des encaissements" padded={false}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#FBFBFE] text-[11px] uppercase tracking-wider text-[#6B6880]">
                <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                <th className="px-4 py-2.5 text-left font-semibold">Moyen</th>
                <th className="px-4 py-2.5 text-left font-semibold">Opérateur</th>
                <th className="px-4 py-2.5 text-right font-semibold">Montant</th>
              </tr>
            </thead>
            <tbody>
              {paiements.map((p) => (
                <tr key={p.id} className="border-t border-[#F1F0F7]">
                  <td className="px-4 py-2.5 tabular-nums text-[#3D3A4D]">{p.encaisse_le}</td>
                  <td className="px-4 py-2.5 text-[#3D3A4D]">{MOYEN_LABEL[p.moyen] ?? p.moyen}</td>
                  <td className="px-4 py-2.5 text-[#6B6880]">{p.operateur}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#17151F]">{eur(p.montant)}</td>
                </tr>
              ))}
              {paiements.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[12.5px] text-[#6B6880]">
                    Aucun paiement encaissé.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#E8E7F0] bg-[#FBFBFE]">
                <td colSpan={3} className="px-4 py-2.5 text-[12.5px] font-semibold text-[#3D3A4D]">
                  Total encaissé
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{eur(dossier.encaisse)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      </div>
    </div>
  );
}
