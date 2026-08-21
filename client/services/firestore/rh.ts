import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Employe,
  PlanningShift,
  PointagePresence,
  AvanceSalaire,
  BulletinPaie,
  PrimeItem,
  CotisationItem,
} from "@shared/api";
import { useTenant } from "@/contexts/TenantContext";
import {
  fetchCollection,
  createDoc,
  updateTenantDoc,
  deleteTenantDoc,
  setDocWithId,
} from "./utils";
import { where, QueryConstraint } from "firebase/firestore";
import { addDays, format, parseISO, startOfWeek } from "date-fns";

export const rhKeys = {
  employes: ["rh", "employes"] as const,
  shifts: (filters?: any) => ["rh", "shifts", filters] as const,
  pointages: (mois?: string) => ["rh", "pointages", mois] as const,
  avances: (mois?: string) => ["rh", "avances", mois] as const,
  bulletins: (mois?: string) => ["rh", "bulletins", mois] as const,
};

// ==========================================
// 1. GESTION DES EMPLOYÉS
// ==========================================

export function useEmployes() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: rhKeys.employes,
    queryFn: async () => {
      if (!tenantId) return [];
      const list = await fetchCollection<Employe>(tenantId, "employes");
      return (list || []).sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));
    },
    enabled: !!tenantId,
  });
}

export function useCreateEmploye() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Omit<Employe, "id">) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      return await createDoc<Employe>(tenantId, "employes", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rhKeys.employes });
    },
  });
}

export function useUpdateEmploye() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Employe> & { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      await updateTenantDoc(tenantId, "employes", id, data);
      return { id, ...data };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rhKeys.employes });
    },
  });
}

export function useDeleteEmploye() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      await deleteTenantDoc(tenantId, "employes", id);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rhKeys.employes });
    },
  });
}

// ==========================================
// 2. PLANNING & SHIFTS DES ÉQUIPES
// ==========================================

export function usePlanningShifts(filters?: {
  dateDebut?: string;
  dateFin?: string;
  departement?: string;
  employeId?: string;
}) {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: rhKeys.shifts(filters),
    queryFn: async () => {
      if (!tenantId) return [];
      const constraints: QueryConstraint[] = [];
      if (filters?.dateDebut) {
        constraints.push(where("date", ">=", filters.dateDebut));
      }
      if (filters?.dateFin) {
        constraints.push(where("date", "<=", filters.dateFin));
      }
      const list = await fetchCollection<PlanningShift>(
        tenantId,
        "planning_shifts",
        ...constraints
      );

      let filtered = list || [];
      if (filters?.departement && filters.departement !== "tous" && filters.departement !== "all") {
        filtered = filtered.filter((s) => s.departement === filters.departement);
      }
      if (filters?.employeId && filters.employeId !== "tous" && filters.employeId !== "all") {
        filtered = filtered.filter((s) => s.employeId === filters.employeId);
      }

      return filtered;
    },
    enabled: !!tenantId,
  });
}

export function useCreatePlanningShift() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Omit<PlanningShift, "id">) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      return await createDoc<PlanningShift>(tenantId, "planning_shifts", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh", "shifts"] });
    },
  });
}

export function useBatchCreatePlanningShifts() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (shifts: Omit<PlanningShift, "id">[]) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const createdList: PlanningShift[] = [];
      for (const s of shifts) {
        const created = await createDoc<PlanningShift>(tenantId, "planning_shifts", s);
        createdList.push(created);
      }
      return createdList;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh", "shifts"] });
    },
  });
}

export function useUpdatePlanningShift() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<PlanningShift> & { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      await updateTenantDoc(tenantId, "planning_shifts", id, data);
      return { id, ...data };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh", "shifts"] });
    },
  });
}

export function useDeletePlanningShift() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      await deleteTenantDoc(tenantId, "planning_shifts", id);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh", "shifts"] });
    },
  });
}

export function useCopyWeekPlanning() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({
      sourceStart,
      targetStart,
    }: {
      sourceStart: string; // YYYY-MM-DD (lundi source)
      targetStart: string; // YYYY-MM-DD (lundi cible)
    }) => {
      if (!tenantId) throw new Error("Tenant ID is required");

      const sourceStartDate = parseISO(sourceStart);
      const sourceEndDate = addDays(sourceStartDate, 6);
      const targetStartDate = parseISO(targetStart);

      const sourceShifts = await fetchCollection<PlanningShift>(
        tenantId,
        "planning_shifts",
        where("date", ">=", format(sourceStartDate, "yyyy-MM-dd")),
        where("date", "<=", format(sourceEndDate, "yyyy-MM-dd"))
      );

      if (!sourceShifts || sourceShifts.length === 0) {
        throw new Error("Aucun shift trouvé sur la semaine source sélectionnée.");
      }

      const newShifts: Omit<PlanningShift, "id">[] = sourceShifts.map((s) => {
        const shiftDate = parseISO(s.date);
        const dayOffset = Math.round(
          (shiftDate.getTime() - sourceStartDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const newDate = addDays(targetStartDate, dayOffset);
        const { id, createdAt, updatedAt, ...rest } = s;
        return {
          ...rest,
          date: format(newDate, "yyyy-MM-dd"),
          statut: "planifie",
        };
      });

      for (const shift of newShifts) {
        await createDoc<PlanningShift>(tenantId, "planning_shifts", shift);
      }

      return newShifts.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh", "shifts"] });
    },
  });
}

// ==========================================
// 3. POINTAGES & PRÉSENCES
// ==========================================

export function usePointages(mois?: string) {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: rhKeys.pointages(mois),
    queryFn: async () => {
      if (!tenantId) return [];
      const constraints: QueryConstraint[] = [];
      if (mois) {
        constraints.push(where("date", ">=", `${mois}-01`));
        constraints.push(where("date", "<=", `${mois}-31`));
      }
      const list = await fetchCollection<PointagePresence>(
        tenantId,
        "pointages",
        ...constraints
      );
      return list || [];
    },
    enabled: !!tenantId,
  });
}

export function useSavePointage() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (pointage: Partial<PointagePresence> & { employeId: string; date: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      const docId = `${pointage.employeId}_${pointage.date}`;
      const saved = await setDocWithId<PointagePresence>(
        tenantId,
        "pointages",
        docId,
        pointage
      );
      return saved;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh", "pointages"] });
    },
  });
}

// ==========================================
// 4. AVANCES & ACOMPTES SUR SALAIRE
// ==========================================

export function useAvancesSalaire(mois?: string) {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: rhKeys.avances(mois),
    queryFn: async () => {
      if (!tenantId) return [];
      const constraints: QueryConstraint[] = [];
      if (mois) {
        constraints.push(where("moisConcerne", "==", mois));
      }
      const list = await fetchCollection<AvanceSalaire>(
        tenantId,
        "avances_salaire",
        ...constraints
      );
      return (list || []).sort((a, b) => (b.dateDemande || "").localeCompare(a.dateDemande || ""));
    },
    enabled: !!tenantId,
  });
}

export function useCreateAvanceSalaire() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Omit<AvanceSalaire, "id">) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      return await createDoc<AvanceSalaire>(tenantId, "avances_salaire", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh", "avances"] });
    },
  });
}

export function useUpdateAvanceSalaire() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<AvanceSalaire> & { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      await updateTenantDoc(tenantId, "avances_salaire", id, data);
      return { id, ...data };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh", "avances"] });
    },
  });
}

export function useDeleteAvanceSalaire() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      await deleteTenantDoc(tenantId, "avances_salaire", id);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh", "avances"] });
    },
  });
}

// ==========================================
// 5. GESTION DE LA PAIE & BULLETINS
// ==========================================

export function useBulletinsPaie(mois?: string) {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: rhKeys.bulletins(mois),
    queryFn: async () => {
      if (!tenantId) return [];
      const constraints: QueryConstraint[] = [];
      if (mois) {
        constraints.push(where("periode", "==", mois));
      }
      const list = await fetchCollection<BulletinPaie>(
        tenantId,
        "bulletins_paie",
        ...constraints
      );
      return (list || []).sort((a, b) => (a.employeNom || "").localeCompare(b.employeNom || ""));
    },
    enabled: !!tenantId,
  });
}

export function useCreateBulletinPaie() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (payload: Omit<BulletinPaie, "id">) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      return await createDoc<BulletinPaie>(tenantId, "bulletins_paie", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh", "bulletins"] });
    },
  });
}

export function useUpdateBulletinPaie() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<BulletinPaie> & { id: string }) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      await updateTenantDoc(tenantId, "bulletins_paie", id, data);
      return { id, ...data };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh", "bulletins"] });
    },
  });
}

export function useDeleteBulletinPaie() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error("Tenant ID is required");
      await deleteTenantDoc(tenantId, "bulletins_paie", id);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh", "bulletins"] });
    },
  });
}

/**
 * Générateur en lot (Batch) des bulletins de paie pour un mois donné
 */
export function useGenerateBulletinsBatch() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async ({
      periode, // YYYY-MM
      employes,
      avances,
      pointages,
    }: {
      periode: string;
      employes: Employe[];
      avances: AvanceSalaire[];
      pointages: PointagePresence[];
    }) => {
      if (!tenantId) throw new Error("Tenant ID is required");

      const existingBulletins = await fetchCollection<BulletinPaie>(
        tenantId,
        "bulletins_paie",
        where("periode", "==", periode)
      );

      const existingMap = new Map<string, BulletinPaie>();
      existingBulletins.forEach((b) => existingMap.set(b.employeId, b));

      const activeEmployes = employes.filter((e) => e.statut === "actif");
      const generatedList: BulletinPaie[] = [];

      let seq = existingBulletins.length + 1;

      for (const emp of activeEmployes) {
        if (existingMap.has(emp.id)) {
          // Déjà généré pour cet employé
          continue;
        }

        // 1. Calcul des heures à partir des pointages du mois si existants
        const empPointages = pointages.filter(
          (p) => p.employeId === emp.id && p.date.startsWith(periode)
        );
        const heuresNormales = empPointages.reduce(
          (acc, p) => acc + (p.heuresNormales || 0),
          0
        ) || 173.33; // 173.33h par défaut si mois complet temps plein
        const heuresSupTotales = empPointages.reduce(
          (acc, p) => acc + (p.heuresSup || 0),
          0
        );

        // Taux horaire de base
        const tauxH = emp.tauxHoraire || Math.round(emp.salaireBase / 173.33);

        // Majoration HS (barème : 25% les premières 8h, 50% au-delà)
        const hs25 = Math.min(heuresSupTotales, 8);
        const hs50 = Math.max(0, heuresSupTotales - 8);
        const montantHs = Math.round(hs25 * tauxH * 1.25 + hs50 * tauxH * 1.5);

        // 2. Avances / acomptes approuvés pour ce mois
        const empAvances = avances.filter(
          (a) =>
            a.employeId === emp.id &&
            a.moisConcerne === periode &&
            (a.statut === "approuve" || a.statut === "en_attente")
        );
        const totalAvances = empAvances.reduce((acc, a) => acc + a.montant, 0);

        // 3. Primes par défaut (Prime d'ancienneté ou assiduité de base si applicable)
        const primes: PrimeItem[] = [];
        const totalPrimes = primes.reduce((acc, p) => acc + p.montant, 0);

        // 4. Salaire Brut
        const salaireBrut = emp.salaireBase + montantHs + totalPrimes;

        // 5. Cotisations salariales selon paramétrage de l'employé
        const cotisations: CotisationItem[] = [];
        let totalCotisations = 0;

        if (emp.assujettiCnaps) {
          const tauxCnaps = emp.tauxCnapsSalarial || 0.01; // 1%
          // Plafond CNaPS standard ou calcul direct
          const montantCnaps = Math.round(salaireBrut * tauxCnaps);
          cotisations.push({
            nom: "CNaPS (1% Salarié)",
            base: salaireBrut,
            taux: tauxCnaps * 100,
            montant: montantCnaps,
          });
          totalCotisations += montantCnaps;
        }

        if (emp.assujettiOstie) {
          const tauxOstie = emp.tauxOstieSalarial || 0.01; // 1%
          const montantOstie = Math.round(salaireBrut * tauxOstie);
          cotisations.push({
            nom: "OSTIE / Santé (1% Salarié)",
            base: salaireBrut,
            taux: tauxOstie * 100,
            montant: montantOstie,
          });
          totalCotisations += montantOstie;
        }

        // 6. IRSA (Impôt sur le Revenu des Salariés)
        let irsa = 0;
        if (emp.assujettiIrsa) {
          const baseImposable = Math.max(0, salaireBrut - totalCotisations);
          // Barème progressif simplifié Madagascar ou forfait dégressif
          if (baseImposable > 600000) {
            irsa = Math.round((baseImposable - 600000) * 0.2 + 25000);
          } else if (baseImposable > 500000) {
            irsa = Math.round((baseImposable - 500000) * 0.15 + 10000);
          } else if (baseImposable > 400000) {
            irsa = Math.round((baseImposable - 400000) * 0.1 + 3000);
          } else if (baseImposable > 350000) {
            irsa = Math.round((baseImposable - 350000) * 0.05);
          } else {
            irsa = 2000; // Impôt minimum de perception
          }

          // Déduction pour charges de famille (ex: 2 000 Ar par enfant)
          const deductionEnfants = (emp.nbEnfantsCharge || 0) * 2000;
          irsa = Math.max(2000, irsa - deductionEnfants);
        }

        // 7. Retenues totales et Net à payer
        const totalRetenues = totalCotisations + irsa + totalAvances;
        const salaireNet = Math.max(0, salaireBrut - totalRetenues);

        const numeroSeq = String(seq).padStart(3, "0");
        const numero = `PAY-${periode.replace("-", "")}-${numeroSeq}`;
        seq++;

        // Détails paiement formaté
        let detailsPaiement = "";
        if (emp.modePaiement === "mobile_money") {
          detailsPaiement = `${emp.coordonneesPaiement?.fournisseurMobile || "Mobile Money"} : ${emp.coordonneesPaiement?.numeroMobile || emp.telephone}`;
        } else if (emp.modePaiement === "virement") {
          detailsPaiement = `${emp.coordonneesPaiement?.banque || "Banque"} - RIB : ${emp.coordonneesPaiement?.rib || "À fournir"}`;
        } else {
          detailsPaiement = "Paiement en espèces contre décharge";
        }

        const newBulletin: Omit<BulletinPaie, "id"> = {
          numero,
          employeId: emp.id,
          employeNom: `${emp.nom} ${emp.prenom}`.trim(),
          employeMatricule: emp.matricule,
          poste: emp.poste,
          departement: emp.departement,
          periode,
          dateEmission: new Date().toISOString(),
          heuresNormales,
          heuresSup25: hs25,
          heuresSup50: hs50,
          heuresSup100: 0,
          salaireBase: emp.salaireBase,
          montantHeuresSup: montantHs,
          primes,
          totalPrimes,
          avantagesEnNature: 0,
          salaireBrut,
          cotisationsSalariales: cotisations,
          totalCotisationsSalariales: totalCotisations,
          irsa,
          avancesDeduites: totalAvances,
          retenuesAbsences: 0,
          autresRetenues: 0,
          totalRetenues,
          salaireNet,
          modePaiement: emp.modePaiement,
          detailsPaiement,
          statut: "brouillon",
        };

        const created = await createDoc<BulletinPaie>(
          tenantId,
          "bulletins_paie",
          newBulletin
        );
        generatedList.push(created);

        // Mettre à jour les avances comme déduites
        for (const av of empAvances) {
          if (av.id && av.statut !== "deduit") {
            await updateTenantDoc(tenantId, "avances_salaire", av.id, {
              statut: "deduit",
            });
          }
        }
      }

      return generatedList;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh", "bulletins"] });
      qc.invalidateQueries({ queryKey: ["rh", "avances"] });
    },
  });
}

// ==========================================
// 6. DONNÉES DE DÉMONSTRATION (SEED RH)
// ==========================================

const DEFAULT_EMPLOYES: Omit<Employe, "id">[] = [
  {
    matricule: "EMP-001",
    nom: "RAZAFY",
    prenom: "Jean Claude",
    departement: "restaurant",
    poste: "Chef de Rang / Maître d'Hôtel",
    typeContrat: "CDI",
    dateEmbauche: "2024-01-15",
    statut: "actif",
    telephone: "034 12 345 67",
    email: "jean.razafy@hotel.mg",
    cin: "101 234 567 890",
    adresse: "Lot IV B 12 Ambohipo",
    salaireBase: 650000,
    tauxHoraire: 3750,
    modePaiement: "mobile_money",
    coordonneesPaiement: {
      fournisseurMobile: "MVola",
      numeroMobile: "034 12 345 67",
    },
    assujettiCnaps: true,
    tauxCnapsSalarial: 0.01,
    cnapsNumber: "CN-987654",
    assujettiOstie: true,
    tauxOstieSalarial: 0.01,
    ostieNumber: "OST-112233",
    assujettiIrsa: true,
    nbEnfantsCharge: 2,
  },
  {
    matricule: "EMP-002",
    nom: "ANDRIANINA",
    prenom: "Fara Mialy",
    departement: "cuisine",
    poste: "Chef de Partie / Cuisine Chaude",
    typeContrat: "CDI",
    dateEmbauche: "2023-06-01",
    statut: "actif",
    telephone: "033 98 765 43",
    email: "fara.andrianina@hotel.mg",
    cin: "101 456 789 012",
    adresse: "Lot II K 45 Itaosy",
    salaireBase: 750000,
    tauxHoraire: 4330,
    modePaiement: "virement",
    coordonneesPaiement: {
      banque: "BNI Madagascar",
      rib: "00004 00123 98765432101 45",
    },
    assujettiCnaps: true,
    tauxCnapsSalarial: 0.01,
    cnapsNumber: "CN-445566",
    assujettiOstie: true,
    tauxOstieSalarial: 0.01,
    ostieNumber: "OST-778899",
    assujettiIrsa: true,
    nbEnfantsCharge: 1,
  },
  {
    matricule: "EMP-003",
    nom: "RABENASOLO",
    prenom: "Hery",
    departement: "reception",
    poste: "Réceptionniste Polyvalent",
    typeContrat: "CDI",
    dateEmbauche: "2024-03-01",
    statut: "actif",
    telephone: "032 55 444 33",
    email: "hery.rabenasolo@hotel.mg",
    cin: "101 789 012 345",
    adresse: "Lot VB 32 Ankadifotsy",
    salaireBase: 600000,
    tauxHoraire: 3460,
    modePaiement: "mobile_money",
    coordonneesPaiement: {
      fournisseurMobile: "Orange Money",
      numeroMobile: "032 55 444 33",
    },
    assujettiCnaps: true,
    tauxCnapsSalarial: 0.01,
    cnapsNumber: "CN-112233",
    assujettiOstie: true,
    tauxOstieSalarial: 0.01,
    ostieNumber: "OST-445566",
    assujettiIrsa: true,
    nbEnfantsCharge: 0,
  },
  {
    matricule: "EMP-004",
    nom: "RAKOTOMALALA",
    prenom: "Soa Marie",
    departement: "hebergement",
    poste: "Gouvernante / Femme de chambre",
    typeContrat: "CDI",
    dateEmbauche: "2024-02-10",
    statut: "actif",
    telephone: "034 77 888 99",
    email: "soa.rakoto@hotel.mg",
    cin: "101 999 888 777",
    adresse: "Lot IA 18 Talatamaty",
    salaireBase: 500000,
    tauxHoraire: 2880,
    modePaiement: "especes",
    assujettiCnaps: true,
    tauxCnapsSalarial: 0.01,
    cnapsNumber: "CN-667788",
    assujettiOstie: true,
    tauxOstieSalarial: 0.01,
    ostieNumber: "OST-998877",
    assujettiIrsa: true,
    nbEnfantsCharge: 3,
  },
  {
    matricule: "EMP-005",
    nom: "RAMAROSON",
    prenom: "Luc",
    departement: "bar",
    poste: "Barman & Mixologue",
    typeContrat: "CDD",
    dateEmbauche: "2024-05-01",
    dateFinContrat: "2024-11-30",
    statut: "actif",
    telephone: "034 00 112 23",
    email: "luc.bar@hotel.mg",
    cin: "101 333 222 111",
    adresse: "Lot TR 54 Isoraka",
    salaireBase: 550000,
    tauxHoraire: 3170,
    modePaiement: "mobile_money",
    coordonneesPaiement: {
      fournisseurMobile: "MVola",
      numeroMobile: "034 00 112 23",
    },
    assujettiCnaps: true,
    tauxCnapsSalarial: 0.01,
    cnapsNumber: "CN-334455",
    assujettiOstie: true,
    tauxOstieSalarial: 0.01,
    ostieNumber: "OST-223344",
    assujettiIrsa: true,
    nbEnfantsCharge: 0,
  },
  {
    matricule: "EMP-006",
    nom: "RAVELO",
    prenom: "Tsiry",
    departement: "restaurant",
    poste: "Serveur Extra / Renfort Week-end",
    typeContrat: "Extra",
    dateEmbauche: "2024-07-01",
    statut: "actif",
    telephone: "033 11 223 34",
    cin: "101 555 444 333",
    adresse: "Lot AZ 21 Analamahitsy",
    salaireBase: 350000,
    tauxHoraire: 3000,
    modePaiement: "especes",
    assujettiCnaps: false, // Extra non éligible
    assujettiOstie: false,
    assujettiIrsa: false,
    nbEnfantsCharge: 0,
  },
];

export function useSeedDefaultRHData() {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  return useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Tenant ID is required");

      // 1. Vérifier si des employés existent déjà
      const existing = await fetchCollection<Employe>(tenantId, "employes");
      const createdEmployes: Employe[] = [];

      if (!existing || existing.length === 0) {
        for (const emp of DEFAULT_EMPLOYES) {
          const created = await createDoc<Employe>(tenantId, "employes", emp);
          createdEmployes.push(created);
        }
      } else {
        createdEmployes.push(...existing);
      }

      // 2. Créer des shifts sur la semaine courante
      const today = new Date();
      const currentMonday = startOfWeek(today, { weekStartsOn: 1 });

      const sampleShifts: Omit<PlanningShift, "id">[] = [];
      const shiftPatterns = [
        { start: "07:00", end: "15:30", type: "travail" as const, poste: "Service Matin & Déjeuner", tache: "Mise en place buffet petit-déjeuner et accueil" },
        { start: "11:00", end: "15:00", type: "coupure" as const, poste: "Service Déjeuner", tache: "Prise des commandes & service table" },
        { start: "15:00", end: "23:00", type: "travail" as const, poste: "Service Soir & Dîner", tache: "Service dîner et fermeture caisse restaurant" },
        { start: "08:00", end: "16:30", type: "travail" as const, poste: "Nettoyage Chambres Étages", tache: "Recouche chambres 1 à 8 et réassort linge" },
        { start: "22:00", end: "06:00", type: "travail" as const, poste: "Veilleur Réception Nuit", tache: "Accueil arrivées tardives et ronde de nuit" },
      ];

      for (let day = 0; day < 7; day++) {
        const d = addDays(currentMonday, day);
        const dateStr = format(d, "yyyy-MM-dd");

        createdEmployes.forEach((emp, idx) => {
          // Repos pour chaque employé un ou deux jours dans la semaine
          const isRepos = (idx === 0 && day === 1) || (idx === 1 && day === 0) || (idx === 2 && day === 6) || (idx === 3 && day === 2) || (idx === 4 && day === 0) || (idx === 5 && (day < 4)); // Extra que ven/sam/dim
          if (isRepos) {
            sampleShifts.push({
              employeId: emp.id,
              employeNom: `${emp.nom} ${emp.prenom}`.trim(),
              departement: emp.departement,
              date: dateStr,
              heureDebut: "00:00",
              heureFin: "00:00",
              type: "repos",
              notes: "Repos hebdomadaire légal",
              statut: "confirme",
            });
          } else {
            const pattern = shiftPatterns[idx % shiftPatterns.length];
            sampleShifts.push({
              employeId: emp.id,
              employeNom: `${emp.nom} ${emp.prenom}`.trim(),
              departement: emp.departement,
              date: dateStr,
              heureDebut: pattern.start,
              heureFin: pattern.end,
              pauseMinutes: 30,
              type: pattern.type,
              posteAffecte: pattern.poste,
              tache: pattern.tache,
              statut: "confirme",
            });
          }
        });
      }

      for (const s of sampleShifts) {
        await createDoc<PlanningShift>(tenantId, "planning_shifts", s);
      }

      // 3. Créer une avance sur salaire type
      if (createdEmployes.length > 0) {
        const currentMonth = format(today, "yyyy-MM");
        await createDoc<AvanceSalaire>(tenantId, "avances_salaire", {
          employeId: createdEmployes[0].id,
          employeNom: `${createdEmployes[0].nom} ${createdEmployes[0].prenom}`.trim(),
          moisConcerne: currentMonth,
          dateDemande: format(today, "yyyy-MM-dd"),
          dateVersement: format(today, "yyyy-MM-dd"),
          montant: 100000,
          motif: "Avance fête familiale / urgence",
          statut: "approuve",
          modeVersement: "mobile_money",
          referencePaiement: "MV-88992211",
        });
      }

      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh"] });
    },
  });
}
