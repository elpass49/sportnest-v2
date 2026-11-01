export type StatutDossier = 'solde' | 'acompte' | 'impaye' | 'vide';

export type Kpis = {
  dossiers: number;
  dossiers_soldes: number;
  dossiers_ouverts: number;
  dossiers_impayes: number;
  facture: number;
  encaisse: number;
  reste: number;
  taux_recouvrement: number;
};

export type DossierLigne = {
  id: string;
  numero: string;
  beneficiaire: string | null;
  cree_le: string;
  facture: number;
  encaisse: number;
  reste: number;
  statut: StatutDossier;
};

export type Membre = {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  date_naissance: string;
  cree_le: string;
  age: number;
  categorie: 'mineur' | 'adulte';
  nb_cours: number;
};

export type CoursOccupation = {
  id: string;
  nom: string;
  style: string;
  jour: number;
  heure_debut: string;
  capacite: number;
  tarif_cours: number;
  inscrits: number;
  places_restantes: number;
  complet: boolean;
};

export type LigneDossier = {
  id: string;
  dossier_id: string;
  membre_id: string | null;
  cours_id: string | null;
  type: 'adhesion' | 'cours' | 'remise' | 'frais';
  libelle: string;
  montant: number;
};

export type Paiement = {
  id: string;
  dossier_id: string;
  montant: number;
  moyen: string;
  encaisse_le: string;
  operateur: string;
  annule_le: string | null;
};

export const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
