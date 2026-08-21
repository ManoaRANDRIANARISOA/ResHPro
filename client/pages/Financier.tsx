import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Autocomplete,
  Tooltip as MuiTooltip,
  Slider,
  InputAdornment,
  Alert,
  Tabs,
  Tab,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import {
  Add,
  Print,
  Edit,
  Delete,
  CheckCircle,
  Receipt,
  Search,
  Settings,
  FlightTakeoff,
  Person,
  Phone,
  Email,
  CalendarToday,
  Payment,
  Close,
  FileDownload,
  LocalOffer,
  TrendingUp,
  TrendingDown,
  AccountBalanceWallet,
  People,
  Inventory2,
} from "@mui/icons-material";
import {
  useCreateFacture,
  useFactures,
  useClients,
  useUpdateFactureStatut,
  useUpdateFacture,
  useDeleteFacture,
  useChambres,
  useHebergementReservations,
  useRestoReservations,
  useBulletinsPaie,
  useAvancesSalaire,
  useStockProduits,
} from "@/services/api";
import { Facture, FactureLigne, Client } from "@shared/api";
import { exportToCSV, exportToPDF, printFacturePro } from "@/lib/export";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  LineChart,
  Line,
  TooltipProps,
} from "recharts";
import { useTenant } from "@/contexts/TenantContext";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import {
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  subDays,
  format,
} from "date-fns";
import { fr } from "date-fns/locale";

// Custom tooltip pour afficher les données des graphiques
function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    return (
      <Box sx={{ bgcolor: 'background.paper', p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2, boxShadow: 2 }}>
        <Typography variant="caption" fontWeight={800} color="text.secondary">{label}</Typography>
        {payload.map((entry, index) => (
          <Typography key={index} variant="body2" sx={{ color: entry.color, fontWeight: 700 }}>
            {entry.name === 'taux' && `Taux: ${entry.value}%`}
            {entry.name === 'reservations' && `Réservations: ${entry.value}`}
            {entry.name === 'revenus' && `Revenus: ${Number(entry.value).toLocaleString('fr-FR')} Ar`}
          </Typography>
        ))}
      </Box>
    );
  }
  return null;
}

const PAYMENT_MODES: { value: string; label: string }[] = [
  { value: "especes", label: "Espèces" },
  { value: "mobile_money", label: "Mobile Money (MVola / Airtel / Orange)" },
  { value: "carte", label: "Carte bancaire (TPE)" },
  { value: "virement", label: "Virement bancaire" },
  { value: "cheque", label: "Chèque bancaire" },
];

function getPaymentLabel(mode?: string) {
  if (!mode) return "Non précisé";
  const found = PAYMENT_MODES.find(m => m.value === mode);
  return found ? found.label : mode;
}

function StatutBadge({ f }: { f: Facture }) {
  if (f.statut === "payee") {
    return <Chip size="small" sx={{ bgcolor: "#dcfce7", color: "#166534", fontWeight: 700, border: "1px solid #bbf7d0" }} label="Payée" />;
  }
  if (f.statut === "annulee") {
    return <Chip size="small" sx={{ bgcolor: "#f1f5f9", color: "#64748b", fontWeight: 600 }} label="Annulée" />;
  }
  const now = new Date();
  const overdue = !!f.dueDate && now > new Date(f.dueDate);
  if (overdue) {
    return <Chip size="small" sx={{ bgcolor: "#fee2e2", color: "#991b1b", fontWeight: 700, border: "1px solid #fecaca" }} label="En retard" />;
  }
  return <Chip size="small" sx={{ bgcolor: "#fef3c7", color: "#92400e", fontWeight: 700, border: "1px solid #fde68a" }} label="Envoyée" />;
}

export default function Financier() {
  const { data: factures } = useFactures();
  const { data: clients } = useClients();
  const { data: restoAll } = useRestoReservations();
  const { data: hebergementAll } = useHebergementReservations();
  const { data: chambresData } = useChambres();
  const { tenantId, config, publicConfig } = useTenant();

  const isRHActive = Boolean(
    config?.modules?.rhPlanningPaie ?? (tenantId === "kanana" || tenantId === "demo")
  );
  const currentMonth = format(new Date(), "yyyy-MM");
  const { data: bulletinsRH = [] } = useBulletinsPaie(isRHActive ? currentMonth : undefined);
  const { data: avancesRH = [] } = useAvancesSalaire(isRHActive ? currentMonth : undefined);
  const { data: stockProduits = [] } = useStockProduits();

  const create = useCreateFacture();
  const updateStatut = useUpdateFactureStatut();
  const updateFacture = useUpdateFacture();
  const deleteFacture = useDeleteFacture();
  const [searchParams] = useSearchParams();

  // Configuration de l'établissement dynamique
  const tenantFiscalConfig = useMemo(() => {
    return {
      nom: config?.nom || publicConfig?.nom || "Établissement",
      logoUrl: config?.logoUrl || publicConfig?.logoUrl || "",
      nif: config?.nif || publicConfig?.nif || "À fournir par le client",
      stat: config?.stat || publicConfig?.stat || "À fournir par le client",
      rcs: config?.rcs || publicConfig?.rcs || "",
      adresse: config?.adresse || publicConfig?.adresse || "",
      rib: config?.rib || publicConfig?.rib || "",
      mvola: config?.mvola || publicConfig?.mvola || "",
      cachetSignatureUrl: config?.cachetSignatureUrl || publicConfig?.cachetSignatureUrl || "",
      telephone: config?.telephone || publicConfig?.telephone || "",
      email: config?.email || publicConfig?.email || "",
      invoicePrefix: config?.invoicePrefix || "FAC",
      currencySymbol: config?.currencySymbol || "Ar",
    };
  }, [config, publicConfig]);

  // Filtres
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "emise" | "payee" | "annulee" | "retard">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "Hebergement" | "Restaurant" | "Evenement">("all");
  const [agencyFilter, setAgencyFilter] = useState<"all" | "with_agency" | "direct">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<0 | 1>(0);

  // Modales
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingFactureId, setEditingFactureId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(true);

  // Formulaire établissement (NIF, STAT, etc.)
  const [tenantForm, setTenantForm] = useState({
    nom: "",
    nif: "",
    stat: "",
    rcs: "",
    adresse: "",
    rib: "",
    mvola: "",
    cachetSignatureUrl: "",
    telephone: "",
    email: "",
  });

  useEffect(() => {
    if (tenantFiscalConfig) {
      setTenantForm({
        nom: tenantFiscalConfig.nom,
        nif: tenantFiscalConfig.nif === "À fournir par le client" ? "" : tenantFiscalConfig.nif,
        stat: tenantFiscalConfig.stat === "À fournir par le client" ? "" : tenantFiscalConfig.stat,
        rcs: tenantFiscalConfig.rcs,
        adresse: tenantFiscalConfig.adresse,
        rib: tenantFiscalConfig.rib || "",
        mvola: tenantFiscalConfig.mvola || "",
        cachetSignatureUrl: tenantFiscalConfig.cachetSignatureUrl || "",
        telephone: tenantFiscalConfig.telephone,
        email: tenantFiscalConfig.email,
      });
    }
  }, [tenantFiscalConfig]);

  // Formulaire Facture
  const [formClient, setFormClient] = useState<{
    clientId: string;
    clientNom: string;
    clientTelephone: string;
    clientEmail: string;
    clientAdresse: string;
    agenceVoyage: string;
  }>({
    clientId: "",
    clientNom: "",
    clientTelephone: "",
    clientEmail: "",
    clientAdresse: "",
    agenceVoyage: "",
  });

  const [formMeta, setFormMeta] = useState<{
    source: Facture["source"];
    modePaiement: string;
    statut: Facture["statut"];
    date: string;
    dueDate: string;
    datePaiement: string;
    remisePourcentage: number;
    notes: string;
  }>({
    source: "Hebergement",
    modePaiement: "especes",
    statut: "emise",
    date: format(new Date(), "yyyy-MM-dd"),
    dueDate: format(new Date(Date.now() + 15 * 86400000), "yyyy-MM-dd"),
    datePaiement: "",
    remisePourcentage: 0,
    notes: "",
  });

  const [formLignes, setFormLignes] = useState<FactureLigne[]>([
    { description: "Nuitée Standard", qte: 1, pu: 120000 },
  ]);

  // Liste filtrée
  const clientIdParam = searchParams.get("clientId");
  const list = useMemo(() => {
    let base = (factures || []).filter((f) => {
      const matchQ =
        f.clientNom.toLowerCase().includes(q.toLowerCase()) ||
        f.numero.toLowerCase().includes(q.toLowerCase()) ||
        (f.agenceVoyage && f.agenceVoyage.toLowerCase().includes(q.toLowerCase())) ||
        (f.clientTelephone && f.clientTelephone.includes(q));
      return matchQ;
    });

    if (clientIdParam) {
      const client = (clients || []).find((c) => c.id === clientIdParam);
      if (client) base = base.filter((f) => f.clientNom === client.nom || f.clientId === client.id);
    }

    if (sourceFilter !== "all") base = base.filter((f) => f.source === sourceFilter);

    if (agencyFilter === "with_agency") {
      base = base.filter((f) => !!f.agenceVoyage && f.agenceVoyage.trim().length > 0);
    } else if (agencyFilter === "direct") {
      base = base.filter((f) => !f.agenceVoyage || f.agenceVoyage.trim().length === 0);
    }

    if (statusFilter !== "all") {
      base = base.filter((f) => {
        const now = new Date();
        const due = f.dueDate ? new Date(f.dueDate) : null;
        if (statusFilter === "retard") return f.statut === "emise" && !!due && now > due;
        if (statusFilter === "emise") return f.statut === "emise" && (!due || now <= due);
        return f.statut === statusFilter;
      });
    }

    return base.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [factures, q, clientIdParam, clients, statusFilter, sourceFilter, agencyFilter]);

  const selected = list.find((f) => f.id === selectedId) || list[0] || null;

  useEffect(() => {
    const fromParam = searchParams.get("factureId");
    if (fromParam) {
      setSelectedId(fromParam);
    }
  }, [searchParams]);

  // Agences connues dans le système
  const knownAgencies = useMemo(() => {
    const set = new Set<string>();
    (clients || []).forEach(c => {
      if (c.agenceVoyage?.trim()) set.add(c.agenceVoyage.trim());
    });
    (factures || []).forEach(f => {
      if (f.agenceVoyage?.trim()) set.add(f.agenceVoyage.trim());
    });
    return Array.from(set);
  }, [clients, factures]);

  // Calculs KPIs
  const kpis = useMemo(() => {
    const all = factures || [];
    const totalFacture = all.reduce((s, f) => s + f.totalTTC, 0);
    const payees = all.filter(f => f.statut === "payee");
    const totalPaye = payees.reduce((s, f) => s + f.totalTTC, 0);
    const now = new Date();
    const enRetardList = all.filter(f => f.statut === "emise" && !!f.dueDate && now > new Date(f.dueDate));
    const totalRetard = enRetardList.reduce((s, f) => s + f.totalTTC, 0);
    const enAttenteList = all.filter(f => f.statut === "emise" && (!f.dueDate || now <= new Date(f.dueDate)));
    const totalEnAttente = enAttenteList.reduce((s, f) => s + f.totalTTC, 0);
    const totalRemises = all.reduce((s, f) => s + (f.remiseMontant || 0), 0);

    return {
      totalFacture,
      totalPaye,
      totalEnAttente,
      totalRetard,
      totalRemises,
      countPaye: payees.length,
      countTotal: all.length,
    };
  }, [factures]);

  // Calculs dynamiques du formulaire
  const formCalculations = useMemo(() => {
    const rawSubTotal = formLignes.reduce((sum, l) => sum + (Number(l.qte || 0) * Number(l.pu || 0)), 0);
    const remisePct = Math.min(10, Math.max(0, Number(formMeta.remisePourcentage || 0)));
    const remiseMontant = remisePct > 0 ? Math.round((rawSubTotal * remisePct) / 100) : 0;
    const netTotal = rawSubTotal - remiseMontant;
    return {
      rawSubTotal,
      remisePct,
      remiseMontant,
      netTotal,
    };
  }, [formLignes, formMeta.remisePourcentage]);

  // Ouvrir modal de création
  function openCreateModal() {
    setIsEditing(false);
    setEditingFactureId(null);
    setFormClient({
      clientId: "",
      clientNom: "",
      clientTelephone: "",
      clientEmail: "",
      clientAdresse: "",
      agenceVoyage: "",
    });
    setFormMeta({
      source: "Hebergement",
      modePaiement: "especes",
      statut: "emise",
      date: format(new Date(), "yyyy-MM-dd"),
      dueDate: format(new Date(Date.now() + 15 * 86400000), "yyyy-MM-dd"),
      datePaiement: "",
      remisePourcentage: 0,
      notes: "",
    });
    setFormLignes([
      { description: "Nuitée Standard", qte: 1, pu: 120000 },
    ]);
    setModalOpen(true);
  }

  // Ouvrir modal d'édition
  function openEditModal(f: Facture) {
    setIsEditing(true);
    setEditingFactureId(f.id);
    const cli = (clients || []).find(c => c.id === f.clientId || c.nom === f.clientNom);
    setFormClient({
      clientId: f.clientId || cli?.id || "",
      clientNom: f.clientNom || "",
      clientTelephone: f.clientTelephone || cli?.telephone || "",
      clientEmail: f.clientEmail || cli?.email || "",
      clientAdresse: f.clientAdresse || cli?.adresse || "",
      agenceVoyage: f.agenceVoyage || cli?.agenceVoyage || "",
    });
    setFormMeta({
      source: f.source,
      modePaiement: f.modePaiement || "especes",
      statut: f.statut,
      date: f.date ? format(new Date(f.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      dueDate: f.dueDate ? format(new Date(f.dueDate), "yyyy-MM-dd") : "",
      datePaiement: f.datePaiement ? format(new Date(f.datePaiement), "yyyy-MM-dd") : "",
      remisePourcentage: f.remisePourcentage || 0,
      notes: f.notes || "",
    });
    setFormLignes(f.lignes && f.lignes.length > 0 ? f.lignes : [{ description: "Prestation", qte: 1, pu: f.totalTTC }]);
    setModalOpen(true);
  }

  // Sauvegarde Facture
  function saveFacture() {
    if (!formClient.clientNom.trim()) {
      alert("Veuillez renseigner le nom du client");
      return;
    }
    if (formLignes.length === 0) {
      alert("Veuillez ajouter au moins une ligne de prestation");
      return;
    }

    const payload: any = {
      clientId: formClient.clientId || undefined,
      clientNom: formClient.clientNom.trim(),
      clientTelephone: formClient.clientTelephone.trim() || undefined,
      clientEmail: formClient.clientEmail.trim() || undefined,
      clientAdresse: formClient.clientAdresse.trim() || undefined,
      agenceVoyage: formClient.agenceVoyage.trim() || undefined,
      source: formMeta.source,
      modePaiement: formMeta.modePaiement,
      statut: formMeta.statut,
      date: new Date(formMeta.date).toISOString(),
      dueDate: formMeta.dueDate ? new Date(formMeta.dueDate).toISOString() : undefined,
      datePaiement: formMeta.statut === "payee"
        ? (formMeta.datePaiement ? new Date(formMeta.datePaiement).toISOString() : new Date().toISOString())
        : undefined,
      lignes: formLignes.map(l => ({
        description: l.description,
        qte: Number(l.qte || 1),
        pu: Number(l.pu || 0),
        noteSpeciale: l.noteSpeciale || undefined,
      })),
      sousTotal: formCalculations.rawSubTotal,
      remisePourcentage: formCalculations.remisePct,
      remiseMontant: formCalculations.remiseMontant,
      totalTTC: formCalculations.netTotal,
      notes: formMeta.notes.trim() || undefined,
    };

    if (isEditing && editingFactureId) {
      updateFacture.mutate({ id: editingFactureId, ...payload }, {
        onSuccess: () => {
          setModalOpen(false);
          setSelectedId(editingFactureId);
        }
      });
    } else {
      create.mutate(payload, {
        onSuccess: (f) => {
          setModalOpen(false);
          setSelectedId(f.id);
        }
      });
    }
  }

  // Sauvegarde rapide du NIF / STAT établissement
  async function saveTenantSettings() {
    if (!tenantId) return;
    try {
      const updateData = {
        nom: tenantForm.nom.trim() || tenantFiscalConfig.nom,
        nif: tenantForm.nif.trim() || "À fournir par le client",
        stat: tenantForm.stat.trim() || "À fournir par le client",
        rcs: tenantForm.rcs.trim(),
        adresse: tenantForm.adresse.trim(),
        rib: tenantForm.rib.trim(),
        mvola: tenantForm.mvola.trim(),
        cachetSignatureUrl: tenantForm.cachetSignatureUrl.trim(),
        telephone: tenantForm.telephone.trim(),
        email: tenantForm.email.trim(),
      };

      await updateDoc(doc(db, `tenants/${tenantId}/publicConfig/main`), updateData);
      await setDoc(doc(db, `tenants/${tenantId}/config/main`), updateData, { merge: true });
      setSettingsOpen(false);
      alert("Coordonnées et NIF/STAT de l'établissement mis à jour avec succès !");
      window.location.reload();
    } catch (err: any) {
      console.error("Erreur mise à jour établissement:", err);
      alert("Erreur: " + err.message);
    }
  }

  // Impression de la facture sélectionnée
  function handlePrintSelected() {
    if (!selected) return;
    const clientObj = (clients || []).find(c => c.id === selected.clientId || c.nom === selected.clientNom);
    const configForPrint = { 
      ...tenantFiscalConfig, 
      cachetSignatureUrl: includeSignature ? tenantFiscalConfig.cachetSignatureUrl : undefined 
    };
    printFacturePro(selected, configForPrint, clientObj);
  }

  // Export CSV global
  function handleExportCSV() {
    const exportData = (factures || []).map(f => ({
      'Numéro': f.numero,
      'Date': new Date(f.date).toLocaleDateString('fr-FR'),
      'Client': f.clientNom,
      'Agence': f.agenceVoyage || 'Direct',
      'Téléphone': f.clientTelephone || '',
      'Source': f.source,
      'Mode Règlement': getPaymentLabel(f.modePaiement),
      'Sous-Total (Ar)': (f.sousTotal || f.totalTTC).toLocaleString('fr-FR'),
      'Remise (%)': f.remisePourcentage ? `${f.remisePourcentage}%` : '0%',
      'Total Net (Ar)': f.totalTTC.toLocaleString('fr-FR'),
      'Statut': f.statut === 'payee' ? 'Payée' : f.statut === 'annulee' ? 'Annulée' : 'Envoyée'
    }));
    exportToCSV(exportData, 'factures_reshpro');
  }

  // Export PDF liste
  function handleExportListPDF() {
    const exportData = (factures || []).map(f => ({
      'Numéro': f.numero,
      'Date': new Date(f.date).toLocaleDateString('fr-FR'),
      'Client': f.clientNom + (f.agenceVoyage ? ` (${f.agenceVoyage})` : ''),
      'Source': f.source,
      'Mode': getPaymentLabel(f.modePaiement),
      'Montant Net': `${f.totalTTC.toLocaleString('fr-FR')} Ar`,
      'Statut': f.statut === 'payee' ? 'Payée' : f.statut === 'annulee' ? 'Annulée' : 'Envoyée'
    }));
    exportToPDF('État Récapitulatif des Factures', exportData, 'factures_liste', tenantFiscalConfig.nom);
  }

  // Rapports graphiques
  const restoResa = useMemo(() => {
    const now = new Date();
    const days = eachDayOfInterval({ start: subDays(now, 6), end: now });
    return days.map((d) => {
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const count = (restoAll || []).filter((r) => {
        const rd = new Date(r.dateDebut);
        rd.setHours(0, 0, 0, 0);
        return r.statut !== "annulee" && rd.getTime() === dayStart.getTime();
      }).length;
      const name = format(d, "EEEEE", { locale: fr }).toUpperCase();
      return { name, reservations: count };
    });
  }, [restoAll]);

  const occData = useMemo(() => {
    const now = new Date();
    const mStart = startOfMonth(now);
    const mEnd = endOfMonth(now);
    const totalDays = eachDayOfInterval({ start: mStart, end: mEnd }).length;
    const allRooms = chambresData || [];
    const counts: Record<string, number> = Object.fromEntries(
      allRooms.map((ch) => [ch.id, 0]),
    );
    (hebergementAll || [])
      .filter((r) => r.statut !== "annulee" && r.statut !== "no_show")
      .forEach((r) => {
        if (!r.chambreId || !(r.chambreId in counts)) return;
        const s = new Date(r.dateDebut);
        const e = new Date(r.dateFin ?? r.dateDebut);
        const start = s < mStart ? mStart : s;
        const end = e > mEnd ? mEnd : e;
        const days = eachDayOfInterval({ start, end });
        counts[r.chambreId] = (counts[r.chambreId] || 0) + days.length;
      });
    return allRooms.map((ch) => ({
      name: `Ch. ${ch.numero}`,
      taux: totalDays ? Math.round(((counts[ch.id] || 0) / totalDays) * 100) : 0,
    }));
  }, [hebergementAll, chambresData]);

  const ca = useMemo(() => {
    const sum = (src: Facture["source"]) =>
      (factures || [])
        .filter((f) => f.source === src && f.statut === "payee")
        .reduce((s, f) => s + f.totalTTC, 0);
    return [
      { name: "Hébergement", revenus: sum("Hebergement") },
      { name: "Restaurant", revenus: sum("Restaurant") },
      { name: "Événements", revenus: sum("Evenement") },
    ];
  }, [factures]);

  // Suivi Financier Global : Entrées vs Sorties (avec RH si actif)
  const cashflowSummary = useMemo(() => {
    const totalEntrees = kpis.totalPaye;

    // Masse salariale nette du mois
    const salairesPayes = bulletinsRH
      .filter((b) => b.statut === "paye")
      .reduce((acc, b) => acc + (b.salaireNet || 0), 0);
    const salairesTotalMois = bulletinsRH.reduce((acc, b) => acc + (b.salaireNet || 0), 0);

    // Avances décaissées
    const avancesPayees = avancesRH
      .filter((a) => a.statut === "approuve")
      .reduce((acc, a) => acc + (a.montant || 0), 0);

    // Charges patronales / cotisations
    const cotisationsTotales = bulletinsRH.reduce(
      (acc, b) => acc + (b.totalCotisationsSalariales || 0) + (b.irsa || 0),
      0
    );

    // Achats stock
    const valeurStock = (stockProduits || []).reduce(
      (acc, p) => acc + (p.stock || 0) * (p.prixUnitaire || 0),
      0
    );

    const totalSortiesRH = isRHActive ? salairesPayes + avancesPayees : 0;
    const totalSortiesGlobal = totalSortiesRH;
    const soldeNetExploitation = totalEntrees - totalSortiesGlobal;

    return {
      totalEntrees,
      salairesPayes,
      salairesTotalMois,
      avancesPayees,
      cotisationsTotales,
      valeurStock,
      totalSortiesRH,
      totalSortiesGlobal,
      soldeNetExploitation,
    };
  }, [kpis, bulletinsRH, avancesRH, stockProduits, isRHActive]);

  const cashflowChartData = useMemo(() => {
    return [
      {
        name: "Hébergement",
        montant: ca.find(c => c.name === "Hébergement")?.revenus || 0,
        type: "Entrée",
        fill: "#10b981",
      },
      {
        name: "Restaurant",
        montant: ca.find(c => c.name === "Restaurant")?.revenus || 0,
        type: "Entrée",
        fill: "#06b6d4",
      },
      {
        name: "Événements",
        montant: ca.find(c => c.name === "Événements")?.revenus || 0,
        type: "Entrée",
        fill: "#8b5cf6",
      },
      ...(isRHActive
        ? [
            {
              name: "Salaires RH",
              montant: cashflowSummary.salairesTotalMois,
              type: "Sortie",
              fill: "#f59e0b",
            },
            {
              name: "Acomptes RH",
              montant: cashflowSummary.avancesPayees,
              type: "Sortie",
              fill: "#ef4444",
            },
          ]
        : []),
    ];
  }, [ca, cashflowSummary, isRHActive]);

  return (
    <Box sx={{ pb: 6 }}>
      {/* HEADER SECTION */}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2} mb={3}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography variant="h4" fontWeight={800} color="#0f172a">
              Facturation & Finances
            </Typography>
            <Chip 
              size="small" 
              icon={<FlightTakeoff fontSize="small" />} 
              label={`${knownAgencies.length} Agences partenaires`} 
              sx={{ bgcolor: "#e0e7ff", color: "#3730a3", fontWeight: 700 }} 
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Établissement : <strong>{tenantFiscalConfig.nom}</strong> &nbsp;·&nbsp; NIF : <strong style={{ color: "#4f46e5" }}>{tenantFiscalConfig.nif}</strong> &nbsp;·&nbsp; STAT : <strong style={{ color: "#4f46e5" }}>{tenantFiscalConfig.stat}</strong>
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <Button
            variant="outlined"
            size="small"
            startIcon={<Settings />}
            onClick={() => setSettingsOpen(true)}
            sx={{ borderColor: "#cbd5e1", color: "#475569" }}
          >
            NIF / STAT Établissement
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownload />}
            onClick={handleExportCSV}
          >
            Excel
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Print />}
            onClick={handleExportListPDF}
          >
            Liste PDF
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<Add />}
            onClick={openCreateModal}
            sx={{ bgcolor: "#4f46e5", "&:hover": { bgcolor: "#4338ca" }, px: 2, fontWeight: 700 }}
          >
            Nouvelle Facture
          </Button>
        </Stack>
      </Stack>

      {/* KPI METRICS */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#ffffff" }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">
              Total Facturé
            </Typography>
            <Typography variant="h5" fontWeight={800} color="#0f172a" mt={0.5}>
              {kpis.totalFacture.toLocaleString('fr-FR')} <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Ar</span>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {kpis.countTotal} facture{kpis.countTotal > 1 ? "s" : ""} émise{kpis.countTotal > 1 ? "s" : ""}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderRadius: 3, border: "1px solid #bbf7d0", bgcolor: "#f0fdf4" }}>
            <Typography variant="caption" fontWeight={700} color="#166534" textTransform="uppercase">
              Total Encaissé
            </Typography>
            <Typography variant="h5" fontWeight={800} color="#15803d" mt={0.5}>
              {kpis.totalPaye.toLocaleString('fr-FR')} <span style={{ fontSize: "0.8rem", color: "#166534" }}>Ar</span>
            </Typography>
            <Typography variant="caption" color="#166534" fontWeight={600}>
              ✓ {kpis.countPaye} facture{kpis.countPaye > 1 ? "s" : ""} soldée{kpis.countPaye > 1 ? "s" : ""}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderRadius: 3, border: "1px solid #fde68a", bgcolor: "#fffbeb" }}>
            <Typography variant="caption" fontWeight={700} color="#92400e" textTransform="uppercase">
              En Attente
            </Typography>
            <Typography variant="h5" fontWeight={800} color="#b45309" mt={0.5}>
              {kpis.totalEnAttente.toLocaleString('fr-FR')} <span style={{ fontSize: "0.8rem", color: "#92400e" }}>Ar</span>
            </Typography>
            <Typography variant="caption" color="#92400e">
              Créances en cours
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderRadius: 3, border: "1px solid #fecaca", bgcolor: "#fef2f2" }}>
            <Typography variant="caption" fontWeight={700} color="#991b1b" textTransform="uppercase">
              En Retard
            </Typography>
            <Typography variant="h5" fontWeight={800} color="#b91c1c" mt={0.5}>
              {kpis.totalRetard.toLocaleString('fr-FR')} <span style={{ fontSize: "0.8rem", color: "#991b1b" }}>Ar</span>
            </Typography>
            <Typography variant="caption" color="#991b1b" fontWeight={600}>
              Échéance dépassée
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderRadius: 3, border: "1px solid #e0e7ff", bgcolor: "#eef2ff" }}>
            <Typography variant="caption" fontWeight={700} color="#3730a3" textTransform="uppercase">
              Rabais & Remises
            </Typography>
            <Typography variant="h5" fontWeight={800} color="#4338ca" mt={0.5}>
              {kpis.totalRemises.toLocaleString('fr-FR')} <span style={{ fontSize: "0.8rem", color: "#3730a3" }}>Ar</span>
            </Typography>
            <Typography variant="caption" color="#4338ca">
              Gestes commerciaux (≤ 10%)
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* TABS VIEW */}
      <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)} sx={{ mb: 2.5, borderBottom: 1, borderColor: "divider" }}>
        <Tab label="📋 Facturier & Aperçu Pro" sx={{ fontWeight: 700, textTransform: "none" }} />
        <Tab label="📊 Rapports & Statistiques" sx={{ fontWeight: 700, textTransform: "none" }} />
      </Tabs>

      {activeTab === 0 && (
        <Grid container spacing={2.5}>
          {/* LEFT: INVOICE LIST */}
          <Grid item xs={12} lg={5.5}>
            <Paper sx={{ p: 2, borderRadius: 3, border: "1px solid #e2e8f0" }}>
              {/* SEARCH & FILTERS */}
              <TextField
                size="small"
                placeholder="Rechercher par numéro, client, agence, tél..."
                fullWidth
                value={q}
                onChange={(e) => setQ(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 1.5 }}
              />

              <Stack direction="row" spacing={0.8} sx={{ mb: 1, flexWrap: "wrap", gap: 0.5 }}>
                <Chip size="small" label="Tous statuts" onClick={() => setStatusFilter("all")} color={statusFilter === "all" ? "primary" : "default"} variant={statusFilter === "all" ? "filled" : "outlined"} />
                <Chip size="small" label="Envoyée" onClick={() => setStatusFilter("emise")} color={statusFilter === "emise" ? "warning" : "default"} variant={statusFilter === "emise" ? "filled" : "outlined"} />
                <Chip size="small" label="Payée" onClick={() => setStatusFilter("payee")} color={statusFilter === "payee" ? "success" : "default"} variant={statusFilter === "payee" ? "filled" : "outlined"} />
                <Chip size="small" label="En retard" onClick={() => setStatusFilter("retard")} color={statusFilter === "retard" ? "error" : "default"} variant={statusFilter === "retard" ? "filled" : "outlined"} />
                <Chip size="small" label="Annulée" onClick={() => setStatusFilter("annulee")} color={statusFilter === "annulee" ? "default" : "default"} variant={statusFilter === "annulee" ? "filled" : "outlined"} />
              </Stack>

              <Stack direction="row" spacing={0.8} sx={{ mb: 1.5, flexWrap: "wrap", gap: 0.5 }}>
                <Chip size="small" label="Toutes sources" onClick={() => setSourceFilter("all")} color={sourceFilter === "all" ? "primary" : "default"} variant={sourceFilter === "all" ? "filled" : "outlined"} />
                <Chip size="small" label="Hébergement" onClick={() => setSourceFilter("Hebergement")} color={sourceFilter === "Hebergement" ? "primary" : "default"} variant={sourceFilter === "Hebergement" ? "filled" : "outlined"} />
                <Chip size="small" label="Restaurant" onClick={() => setSourceFilter("Restaurant")} color={sourceFilter === "Restaurant" ? "primary" : "default"} variant={sourceFilter === "Restaurant" ? "filled" : "outlined"} />
                <Chip size="small" label="Événement" onClick={() => setSourceFilter("Evenement")} color={sourceFilter === "Evenement" ? "primary" : "default"} variant={sourceFilter === "Evenement" ? "filled" : "outlined"} />
              </Stack>

              <Stack direction="row" spacing={0.8} sx={{ mb: 2, flexWrap: "wrap", gap: 0.5 }}>
                <Chip size="small" label="Tous types" onClick={() => setAgencyFilter("all")} color={agencyFilter === "all" ? "secondary" : "default"} variant={agencyFilter === "all" ? "filled" : "outlined"} />
                <Chip size="small" icon={<FlightTakeoff fontSize="small" />} label="Avec Agence" onClick={() => setAgencyFilter("with_agency")} color={agencyFilter === "with_agency" ? "secondary" : "default"} variant={agencyFilter === "with_agency" ? "filled" : "outlined"} />
                <Chip size="small" label="Clients Directs" onClick={() => setAgencyFilter("direct")} color={agencyFilter === "direct" ? "secondary" : "default"} variant={agencyFilter === "direct" ? "filled" : "outlined"} />
              </Stack>

              <Divider sx={{ mb: 1.5 }} />

              {/* LIST */}
              <Box sx={{ maxHeight: "60vh", overflowY: "auto", pr: 0.5 }}>
                {list.length === 0 && (
                  <Box sx={{ textAlign: "center", py: 5, color: "text.secondary" }}>
                    <Receipt sx={{ fontSize: 40, opacity: 0.4, mb: 1 }} />
                    <Typography variant="body2">Aucune facture ne correspond à ces critères</Typography>
                  </Box>
                )}

                {list.map((f) => {
                  const isSel = selected?.id === f.id;
                  return (
                    <Paper
                      key={f.id}
                      onClick={() => setSelectedId(f.id)}
                      elevation={isSel ? 2 : 0}
                      sx={{
                        p: 1.8,
                        mb: 1.2,
                        borderRadius: 2.5,
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor: isSel ? "#4f46e5" : "#e2e8f0",
                        bgcolor: isSel ? "#f8faff" : "#ffffff",
                        transition: "all 0.15s ease",
                        "&:hover": {
                          borderColor: "#818cf8",
                          bgcolor: "#fcfdff",
                        },
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography fontWeight={800} color="#0f172a" fontSize="0.95rem">
                              {f.numero}
                            </Typography>
                            <Chip size="small" label={f.source} variant="outlined" sx={{ fontSize: "0.68rem", height: 20 }} />
                          </Stack>

                          <Typography fontWeight={700} color="#1e293b" fontSize="0.9rem" mt={0.4}>
                            {f.clientNom}
                          </Typography>

                          {f.agenceVoyage && (
                            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, bgcolor: "#eef2ff", px: 1, py: 0.2, borderRadius: 1, mt: 0.5 }}>
                              <FlightTakeoff sx={{ fontSize: 13, color: "#4338ca" }} />
                              <Typography variant="caption" fontWeight={700} color="#4338ca">
                                {f.agenceVoyage}
                              </Typography>
                            </Box>
                          )}

                          <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                            📅 {new Date(f.date).toLocaleDateString('fr-FR')} &nbsp;·&nbsp; 💳 {getPaymentLabel(f.modePaiement)}
                          </Typography>
                        </Box>

                        <Box sx={{ textAlign: "right" }}>
                          <Typography fontWeight={800} color="#4f46e5" fontSize="1.05rem">
                            {f.totalTTC.toLocaleString('fr-FR')} Ar
                          </Typography>
                          {f.remiseMontant && f.remiseMontant > 0 ? (
                            <Typography variant="caption" color="#059669" fontWeight={600} display="block">
                              Remise: -{f.remiseMontant.toLocaleString('fr-FR')} Ar ({f.remisePourcentage}%)
                            </Typography>
                          ) : null}
                          <Box mt={0.6}>
                            <StatutBadge f={f} />
                          </Box>
                        </Box>
                      </Stack>
                    </Paper>
                  );
                })}
              </Box>
            </Paper>
          </Grid>

          {/* RIGHT: LIVE INTERACTIVE INVOICE PREVIEW */}
          <Grid item xs={12} lg={6.5}>
            {!selected ? (
              <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3, border: "1px solid #e2e8f0" }}>
                <Receipt sx={{ fontSize: 48, color: "#94a3b8", mb: 1 }} />
                <Typography color="text.secondary">Sélectionnez une facture pour afficher son aperçu officiel</Typography>
              </Paper>
            ) : (
              <Paper sx={{ p: 3, borderRadius: 3, border: "1px solid #cbd5e1", bgcolor: "#ffffff", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
                {/* TOOLBAR */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" pb={2} mb={2.5} borderBottom="1px solid #f1f5f9" flexWrap="wrap" gap={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1" fontWeight={800} color="#0f172a">
                      Aperçu Document
                    </Typography>
                    <StatutBadge f={selected} />
                  </Stack>

                  <Stack direction="row" spacing={1}>
                    <FormControlLabel
                      control={
                        <Checkbox 
                          size="small" 
                          checked={includeSignature} 
                          onChange={(e) => setIncludeSignature(e.target.checked)} 
                        />
                      }
                      label={<Typography variant="caption" fontWeight={600}>Inclure signature</Typography>}
                      sx={{ mr: 1, color: "text.secondary" }}
                    />
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<Print />}
                      onClick={handlePrintSelected}
                      sx={{ bgcolor: "#4f46e5", "&:hover": { bgcolor: "#4338ca" }, fontWeight: 700 }}
                    >
                      Imprimer / PDF A4
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Edit />}
                      onClick={() => openEditModal(selected)}
                    >
                      Modifier
                    </Button>
                    {selected.statut !== "payee" && (
                      <Button
                        size="small"
                        color="success"
                        variant="outlined"
                        startIcon={<CheckCircle />}
                        onClick={() => updateStatut.mutate({ id: selected.id, statut: "payee" })}
                      >
                        Marquer Payée
                      </Button>
                    )}
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        if (confirm(`Confirmez-vous la suppression de la facture ${selected.numero} ?`)) {
                          deleteFacture.mutate(selected.id);
                        }
                      }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>

                {/* VISUAL A4 SHEET SIMULATION */}
                <Box
                  sx={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 2,
                    p: 3,
                    bgcolor: "#ffffff",
                    position: "relative",
                  }}
                >
                  {/* HEADER */}
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" pb={2} mb={2} borderBottom="2px solid #f8fafc">
                    <Box>
                      <Typography variant="h6" fontWeight={900} color="#0f172a" letterSpacing="-0.3px">
                        {tenantFiscalConfig.nom}
                      </Typography>
                      {tenantFiscalConfig.adresse && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          📍 {tenantFiscalConfig.adresse}
                        </Typography>
                      )}
                      {(tenantFiscalConfig.telephone || tenantFiscalConfig.email) && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          📞 {tenantFiscalConfig.telephone} {tenantFiscalConfig.email && `· ✉️ ${tenantFiscalConfig.email}`}
                        </Typography>
                      )}
                      <Stack direction="row" spacing={1} mt={0.8}>
                        <Chip
                          size="small"
                          label={`NIF : ${tenantFiscalConfig.nif}`}
                          sx={{ fontSize: "0.7rem", height: 20, bgcolor: "#f1f5f9", fontWeight: 700 }}
                        />
                        <Chip
                          size="small"
                          label={`STAT : ${tenantFiscalConfig.stat}`}
                          sx={{ fontSize: "0.7rem", height: 20, bgcolor: "#f1f5f9", fontWeight: 700 }}
                        />
                      </Stack>
                    </Box>

                    <Box sx={{ textAlign: "right" }}>
                      <Typography variant="h6" fontWeight={900} color="#1e293b">
                        FACTURE
                      </Typography>
                      <Typography variant="body2" fontWeight={800} color="#4f46e5">
                        {selected.numero}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                        Date : <strong>{new Date(selected.date).toLocaleDateString('fr-FR')}</strong>
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Échéance : <strong>{selected.dueDate ? new Date(selected.dueDate).toLocaleDateString('fr-FR') : "À réception"}</strong>
                      </Typography>
                    </Box>
                  </Stack>

                  {/* CLIENT & AGENCY BLOCK */}
                  <Grid container spacing={2} mb={2.5}>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 1.5, bgcolor: "#f8fafc", borderRadius: 2, border: "1px solid #e2e8f0", height: "100%" }}>
                        <Typography variant="caption" fontWeight={800} color="#64748b" textTransform="uppercase">
                          Facturé à (Client)
                        </Typography>
                        <Typography variant="subtitle2" fontWeight={800} color="#0f172a" mt={0.5}>
                          {selected.clientNom}
                        </Typography>
                        {selected.clientTelephone && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            📞 {selected.clientTelephone}
                          </Typography>
                        )}
                        {selected.clientEmail && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            ✉️ {selected.clientEmail}
                          </Typography>
                        )}
                        {selected.clientAdresse && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            🏠 {selected.clientAdresse}
                          </Typography>
                        )}
                        {selected.agenceVoyage ? (
                          <Box sx={{ mt: 1, bgcolor: "#eef2ff", border: "1px solid #c7d2fe", p: 0.6, borderRadius: 1 }}>
                            <Typography variant="caption" fontWeight={700} color="#3730a3">
                              ✈️ Agence : <strong>{selected.agenceVoyage}</strong>
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                            Client direct
                          </Typography>
                        )}
                      </Box>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 1.5, bgcolor: "#f8fafc", borderRadius: 2, border: "1px solid #e2e8f0", height: "100%" }}>
                        <Typography variant="caption" fontWeight={800} color="#64748b" textTransform="uppercase">
                          Modalités de Règlement
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color="#0f172a" mt={0.5}>
                          Mode : {getPaymentLabel(selected.modePaiement)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Source prestation : {selected.source}
                        </Typography>
                        {selected.statut === "payee" && selected.datePaiement && (
                          <Typography variant="caption" color="#166534" fontWeight={700} display="block" mt={0.5}>
                            ✓ Règlement reçu le {new Date(selected.datePaiement).toLocaleDateString('fr-FR')}
                          </Typography>
                        )}
                        {selected.notes && (
                          <Typography variant="caption" color="text.secondary" display="block" mt={0.8} sx={{ fontStyle: "italic" }}>
                            Note : {selected.notes}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  </Grid>

                  {/* ITEMS TABLE */}
                  <Box sx={{ border: "1px solid #e2e8f0", borderRadius: 1.5, overflow: "hidden", mb: 2 }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 70px 110px 120px", p: 1, bgcolor: "#f1f5f9", fontWeight: 800, fontSize: "0.75rem", color: "#334155" }}>
                      <Box>Description</Box>
                      <Box sx={{ textAlign: "center" }}>Qté</Box>
                      <Box sx={{ textAlign: "right" }}>Prix Unit.</Box>
                      <Box sx={{ textAlign: "right" }}>Total</Box>
                    </Box>
                    {selected.lignes.map((l, i) => (
                      <Box
                        key={i}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "1fr 70px 110px 120px",
                          p: 1,
                          borderTop: "1px solid #f1f5f9",
                          fontSize: "0.82rem",
                          alignItems: "center",
                        }}
                      >
                        <Box>
                          <Typography variant="body2" fontWeight={600} color="#0f172a" fontSize="0.82rem">
                            {l.description}
                          </Typography>
                          {l.noteSpeciale && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                              {l.noteSpeciale}
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ textAlign: "center", fontWeight: 600 }}>{l.qte}</Box>
                        <Box sx={{ textAlign: "right", color: "text.secondary" }}>{l.pu.toLocaleString('fr-FR')} Ar</Box>
                        <Box sx={{ textAlign: "right", fontWeight: 700 }}>{(l.qte * l.pu).toLocaleString('fr-FR')} Ar</Box>
                      </Box>
                    ))}
                  </Box>

                  {/* TOTALS BOX */}
                  <Stack direction="row" justifyContent="flex-end">
                    <Box sx={{ width: 280, p: 1.5, bgcolor: "#f8fafc", borderRadius: 2, border: "1px solid #e2e8f0" }}>
                      <Stack direction="row" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2" color="text.secondary">Sous-total brut :</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {(selected.sousTotal || selected.lignes.reduce((s, l) => s + l.qte * l.pu, 0)).toLocaleString('fr-FR')} Ar
                        </Typography>
                      </Stack>

                      {selected.remiseMontant && selected.remiseMontant > 0 ? (
                        <Stack direction="row" justifyContent="space-between" mb={0.5}>
                          <Typography variant="body2" color="#059669" fontWeight={600}>
                            Remise ({selected.remisePourcentage}%) :
                          </Typography>
                          <Typography variant="body2" color="#059669" fontWeight={700}>
                            - {selected.remiseMontant.toLocaleString('fr-FR')} Ar
                          </Typography>
                        </Stack>
                      ) : null}

                      <Divider sx={{ my: 1 }} />

                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle2" fontWeight={800} color="#0f172a">Net à payer :</Typography>
                        <Typography variant="h6" fontWeight={900} color="#4f46e5">
                          {selected.totalTTC.toLocaleString('fr-FR')} Ar
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>

                  {/* LEGAL FOOTER */}
                  <Box mt={3} pt={1.5} borderTop="1px dashed #cbd5e1">
                    <Typography variant="caption" color="text.secondary" display="block">
                      {tenantFiscalConfig.nom} — NIF : {tenantFiscalConfig.nif} | STAT : {tenantFiscalConfig.stat} {tenantFiscalConfig.rcs && `| RCS : ${tenantFiscalConfig.rcs}`}
                    </Typography>
                    <Typography variant="caption" color="#94a3b8" display="block">
                      TVA non applicable — Régime de l'Impôt Synthétique.
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            )}
          </Grid>
        </Grid>
      )}

      {/* TAB 1: RAPPORTS & STATISTIQUES */}
      {activeTab === 1 && (
        <Stack spacing={3}>
          <Paper sx={{ p: 3, borderRadius: 3, border: "1px solid #e2e8f0" }}>
            <Typography variant="h6" fontWeight={800} mb={2}>
              Tableau de bord de performance financière
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" fontWeight={700} color="text.secondary" mb={1}>
                  Fréquentation & Réservations Restaurant (7 derniers jours)
                </Typography>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={restoResa}>
                    <XAxis dataKey="name" />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="reservations" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" fontWeight={700} color="text.secondary" mb={1}>
                  Taux d'occupation par chambre (%) — Mois en cours
                </Typography>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={occData}>
                    <XAxis dataKey="name" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="taux" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" fontWeight={700} color="text.secondary" mb={1}>
                  Chiffre d'Affaires Encaissé par Activité (Ariary)
                </Typography>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={ca}>
                    <XAxis dataKey="name" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="revenus" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Grid>
            </Grid>
          </Paper>

          {/* SECTION: FLUX DE TRÉSORERIE & SORTIES RH */}
          <Paper sx={{ p: 3, borderRadius: 3, border: "1px solid #e2e8f0" }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} mb={2}>
              <Box>
                <Typography variant="h6" fontWeight={800} color="#0f172a">
                  Flux de Trésorerie : Entrées vs Sorties d'Exploitation
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Synthèse globale du mois en cours ({format(new Date(), "MMMM yyyy", { locale: fr })})
                </Typography>
              </Box>
              {isRHActive && (
                <Chip
                  size="small"
                  label="Module RH Inclus"
                  sx={{ bgcolor: "#e0e7ff", color: "#3730a3", fontWeight: 700 }}
                />
              )}
            </Stack>

            <Grid container spacing={2} mb={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, borderLeft: "4px solid #10b981", bgcolor: "#f0fdf4" }}>
                  <Typography variant="caption" fontWeight={700} color="#166534" textTransform="uppercase">
                    Total Entrées Encaissées
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="#15803d" mt={0.5}>
                    {cashflowSummary.totalEntrees.toLocaleString('fr-FR')} Ar
                  </Typography>
                  <Typography variant="caption" color="#166534">
                    Factures soldées
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, borderLeft: "4px solid #f59e0b", bgcolor: "#fffbeb" }}>
                  <Typography variant="caption" fontWeight={700} color="#92400e" textTransform="uppercase">
                    Sorties Masse Salariale {isRHActive ? "(RH)" : ""}
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="#b45309" mt={0.5}>
                    {cashflowSummary.salairesTotalMois.toLocaleString('fr-FR')} Ar
                  </Typography>
                  <Typography variant="caption" color="#92400e">
                    {bulletinsRH.length} salariés ce mois
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, borderLeft: "4px solid #ef4444", bgcolor: "#fef2f2" }}>
                  <Typography variant="caption" fontWeight={700} color="#991b1b" textTransform="uppercase">
                    Acomptes & Avances Versés
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="#b91c1c" mt={0.5}>
                    {cashflowSummary.avancesPayees.toLocaleString('fr-FR')} Ar
                  </Typography>
                  <Typography variant="caption" color="#991b1b">
                    Avances accordées
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, borderLeft: `4px solid ${cashflowSummary.soldeNetExploitation >= 0 ? '#4f46e5' : '#ef4444'}`, bgcolor: "#f8fafc" }}>
                  <Typography variant="caption" fontWeight={700} color="#475569" textTransform="uppercase">
                    Solde d'Exploitation Net
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color={cashflowSummary.soldeNetExploitation >= 0 ? "#4338ca" : "#b91c1c"} mt={0.5}>
                    {cashflowSummary.soldeNetExploitation.toLocaleString('fr-FR')} Ar
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Entrées — Sorties Salariales
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* GRAPHIQUE COMPARATIF ENTRÉES VS CHARGES */}
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" mb={1.5}>
              Ventilation Comparative : Recettes vs Décaissements (Ariary)
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={cashflowChartData}>
                <XAxis dataKey="name" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="montant" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Stack>
      )}

      {/* MODAL CREATION / EDITION FACTURE */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, pb: 1, borderBottom: "1px solid #f1f5f9" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <span>{isEditing ? "Modifier la Facture" : "Créer une Nouvelle Facture"}</span>
            <IconButton size="small" onClick={() => setModalOpen(false)}>
              <Close fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ pt: 2.5 }}>
          <Stack spacing={2.5}>
            {/* SECTION 1: CLIENT & AGENCE */}
            <Box>
              <Typography variant="subtitle2" fontWeight={800} color="#0f172a" mb={1.5}>
                1. Identification du Client & Agence
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    freeSolo
                    options={clients || []}
                    getOptionLabel={(opt) => typeof opt === "string" ? opt : opt.nom}
                    value={formClient.clientNom}
                    onChange={(_, val) => {
                      if (val && typeof val !== "string") {
                        setFormClient({
                          clientId: val.id,
                          clientNom: val.nom,
                          clientTelephone: val.telephone || "",
                          clientEmail: val.email || "",
                          clientAdresse: val.adresse || "",
                          agenceVoyage: val.agenceVoyage || "",
                        });
                      }
                    }}
                    onInputChange={(_, newInputValue) => {
                      setFormClient(prev => ({ ...prev, clientNom: newInputValue }));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        label="Nom du Client *"
                        placeholder="Rechercher ou saisir un nom"
                        required
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    freeSolo
                    options={knownAgencies}
                    value={formClient.agenceVoyage}
                    onChange={(_, val) => {
                      setFormClient(prev => ({ ...prev, agenceVoyage: val || "" }));
                    }}
                    onInputChange={(_, newInputValue) => {
                      setFormClient(prev => ({ ...prev, agenceVoyage: newInputValue }));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        label="Agence de Voyage (si applicable)"
                        placeholder="Ex: Madagascar Tours, Lemur Travel..."
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <>
                              <InputAdornment position="start">
                                <FlightTakeoff fontSize="small" color="action" />
                              </InputAdornment>
                              {params.InputProps.startAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <TextField
                    size="small"
                    label="Téléphone"
                    fullWidth
                    value={formClient.clientTelephone}
                    onChange={(e) => setFormClient(prev => ({ ...prev, clientTelephone: e.target.value }))}
                    placeholder="034 00 000 00"
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <TextField
                    size="small"
                    label="E-mail"
                    fullWidth
                    value={formClient.clientEmail}
                    onChange={(e) => setFormClient(prev => ({ ...prev, clientEmail: e.target.value }))}
                    placeholder="client@domaine.com"
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <TextField
                    size="small"
                    label="Adresse"
                    fullWidth
                    value={formClient.clientAdresse}
                    onChange={(e) => setFormClient(prev => ({ ...prev, clientAdresse: e.target.value }))}
                    placeholder="Ville / Adresse"
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* SECTION 2: MODALITÉS & DATES */}
            <Box>
              <Typography variant="subtitle2" fontWeight={800} color="#0f172a" mb={1.5}>
                2. Source, Dates & Règlement
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
                  <TextField
                    size="small"
                    select
                    label="Source de la Prestation"
                    fullWidth
                    value={formMeta.source}
                    onChange={(e) => setFormMeta(prev => ({ ...prev, source: e.target.value as any }))}
                  >
                    <MenuItem value="Hebergement">Hébergement</MenuItem>
                    <MenuItem value="Restaurant">Restaurant</MenuItem>
                    <MenuItem value="Evenement">Événement</MenuItem>
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={3}>
                  <TextField
                    size="small"
                    select
                    label="Mode de Règlement *"
                    fullWidth
                    value={formMeta.modePaiement}
                    onChange={(e) => setFormMeta(prev => ({ ...prev, modePaiement: e.target.value }))}
                  >
                    {PAYMENT_MODES.map((pm) => (
                      <MenuItem key={pm.value} value={pm.value}>
                        {pm.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={3}>
                  <TextField
                    size="small"
                    select
                    label="Statut du Règlement"
                    fullWidth
                    value={formMeta.statut}
                    onChange={(e) => setFormMeta(prev => ({ ...prev, statut: e.target.value as any }))}
                  >
                    <MenuItem value="emise">Envoyée / En attente</MenuItem>
                    <MenuItem value="payee">Payée (Acquittée)</MenuItem>
                    <MenuItem value="annulee">Annulée</MenuItem>
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={3}>
                  <TextField
                    size="small"
                    type="date"
                    label="Date d'émission"
                    fullWidth
                    value={formMeta.date}
                    onChange={(e) => setFormMeta(prev => ({ ...prev, date: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12} sm={3}>
                  <TextField
                    size="small"
                    type="date"
                    label="Date d'échéance"
                    fullWidth
                    value={formMeta.dueDate}
                    onChange={(e) => setFormMeta(prev => ({ ...prev, dueDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                {formMeta.statut === "payee" && (
                  <Grid item xs={12} sm={3}>
                    <TextField
                      size="small"
                      type="date"
                      label="Date de paiement"
                      fullWidth
                      value={formMeta.datePaiement}
                      onChange={(e) => setFormMeta(prev => ({ ...prev, datePaiement: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                )}
              </Grid>
            </Box>

            <Divider />

            {/* SECTION 3: LIGNES D'ARTICLES */}
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
                  3. Détail des Prestations
                </Typography>
                <Button
                  size="small"
                  startIcon={<Add />}
                  onClick={() => setFormLignes(prev => [...prev, { description: "Nouvelle prestation", qte: 1, pu: 50000 }])}
                >
                  Ajouter une ligne
                </Button>
              </Stack>

              <Stack spacing={1.5}>
                {formLignes.map((ligne, idx) => (
                  <Paper key={idx} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Grid container spacing={1.5} alignItems="center">
                      <Grid item xs={12} sm={5}>
                        <TextField
                          size="small"
                          label="Description"
                          fullWidth
                          value={ligne.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormLignes(prev => prev.map((l, i) => i === idx ? { ...l, description: val } : l));
                          }}
                        />
                      </Grid>

                      <Grid item xs={4} sm={2}>
                        <TextField
                          size="small"
                          type="number"
                          label="Qté"
                          fullWidth
                          value={ligne.qte}
                          inputProps={{ min: 1 }}
                          onChange={(e) => {
                            const val = parseInt(e.target.value || "1", 10);
                            setFormLignes(prev => prev.map((l, i) => i === idx ? { ...l, qte: val } : l));
                          }}
                        />
                      </Grid>

                      <Grid item xs={6} sm={2.5}>
                        <TextField
                          size="small"
                          type="number"
                          label="Prix Unitaire (Ar)"
                          fullWidth
                          value={ligne.pu}
                          onChange={(e) => {
                            const val = parseInt(e.target.value || "0", 10);
                            setFormLignes(prev => prev.map((l, i) => i === idx ? { ...l, pu: val } : l));
                          }}
                        />
                      </Grid>

                      <Grid item xs={10} sm={2}>
                        <Typography variant="body2" fontWeight={800} color="#4f46e5" textAlign="right">
                          {(ligne.qte * ligne.pu).toLocaleString('fr-FR')} Ar
                        </Typography>
                      </Grid>

                      <Grid item xs={2} sm={0.5} textAlign="right">
                        {formLignes.length > 1 && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setFormLignes(prev => prev.filter((_, i) => i !== idx))}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        )}
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
              </Stack>
            </Box>

            <Divider />

            {/* SECTION 4: RABAIS / REMISE (0 - 10%) & CALCULS */}
            <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" fontWeight={800} color="#0f172a" mb={0.5}>
                    Rabais Commercial Responsable (Max 10%)
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                    Ajustez le taux de remise accordé (limité à 10% maximum).
                  </Typography>

                  <Stack direction="row" spacing={2} alignItems="center">
                    <Slider
                      value={formMeta.remisePourcentage}
                      min={0}
                      max={10}
                      step={0.5}
                      onChange={(_, val) => setFormMeta(prev => ({ ...prev, remisePourcentage: val as number }))}
                      sx={{ color: "#4f46e5" }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      value={formMeta.remisePourcentage}
                      inputProps={{ min: 0, max: 10, step: 0.5 }}
                      onChange={(e) => {
                        const val = Math.min(10, Math.max(0, parseFloat(e.target.value || "0")));
                        setFormMeta(prev => ({ ...prev, remisePourcentage: val }));
                      }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                      sx={{ width: 100 }}
                    />
                  </Stack>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1.5, bgcolor: "#ffffff", borderRadius: 2, border: "1px solid #e2e8f0" }}>
                    <Stack direction="row" justifyContent="space-between" mb={0.5}>
                      <Typography variant="body2" color="text.secondary">Sous-total brut :</Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {formCalculations.rawSubTotal.toLocaleString('fr-FR')} Ar
                      </Typography>
                    </Stack>

                    {formCalculations.remiseMontant > 0 && (
                      <Stack direction="row" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2" color="#059669" fontWeight={700}>
                          Remise ({formCalculations.remisePct}%) :
                        </Typography>
                        <Typography variant="body2" color="#059669" fontWeight={800}>
                          - {formCalculations.remiseMontant.toLocaleString('fr-FR')} Ar
                        </Typography>
                      </Stack>
                    )}

                    <Divider sx={{ my: 1 }} />

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle1" fontWeight={800} color="#0f172a">Net à Payer :</Typography>
                      <Typography variant="h6" fontWeight={900} color="#4f46e5">
                        {formCalculations.netTotal.toLocaleString('fr-FR')} Ar
                      </Typography>
                    </Stack>
                  </Box>
                </Grid>
              </Grid>
            </Box>

            {/* NOTES */}
            <TextField
              size="small"
              label="Notes particulières / Mentions facture"
              fullWidth
              multiline
              rows={2}
              value={formMeta.notes}
              onChange={(e) => setFormMeta(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Ex: Facture acquittée, règlement par MVola le 19/08..."
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: "1px solid #f1f5f9" }}>
          <Button onClick={() => setModalOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={saveFacture}
            disabled={create.isPending || updateFacture.isPending}
            sx={{ bgcolor: "#4f46e5", "&:hover": { bgcolor: "#4338ca" }, px: 3, fontWeight: 700 }}
          >
            {create.isPending || updateFacture.isPending ? "Enregistrement..." : isEditing ? "Enregistrer les modifications" : "Générer la Facture"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL CONFIGURATION NIF / STAT ÉTABLISSEMENT */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          Coordonnées & Fiscalité de l'Établissement
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            Ces informations sont dynamiquement liées à votre établissement (Tenant <strong>{tenantId}</strong>) et figureront automatiquement sur toutes vos factures et exports PDF.
          </Typography>

          <Stack spacing={2}>
            <TextField
              size="small"
              label="Nom de l'établissement"
              fullWidth
              value={tenantForm.nom}
              onChange={(e) => setTenantForm(prev => ({ ...prev, nom: e.target.value }))}
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  label="NIF de l'établissement"
                  fullWidth
                  placeholder="À fournir par le client"
                  value={tenantForm.nif}
                  onChange={(e) => setTenantForm(prev => ({ ...prev, nif: e.target.value }))}
                  helperText="Laissez vide pour afficher 'À fournir par le client'"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  label="STAT de l'établissement"
                  fullWidth
                  placeholder="À fournir par le client"
                  value={tenantForm.stat}
                  onChange={(e) => setTenantForm(prev => ({ ...prev, stat: e.target.value }))}
                  helperText="Laissez vide pour afficher 'À fournir par le client'"
                />
              </Grid>
            </Grid>

            <TextField
              size="small"
              label="RCS (optionnel)"
              fullWidth
              value={tenantForm.rcs}
              onChange={(e) => setTenantForm(prev => ({ ...prev, rcs: e.target.value }))}
            />

            <TextField
              size="small"
              label="Adresse physique"
              fullWidth
              placeholder="Ex: Andasibe Mpangalatsary, Madagascar"
              value={tenantForm.adresse}
              onChange={(e) => setTenantForm(prev => ({ ...prev, adresse: e.target.value }))}
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  label="Téléphone officiel"
                  fullWidth
                  value={tenantForm.telephone}
                  onChange={(e) => setTenantForm(prev => ({ ...prev, telephone: e.target.value }))}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  label="E-mail officiel"
                  fullWidth
                  value={tenantForm.email}
                  onChange={(e) => setTenantForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  label="RIB (Virement bancaire)"
                  fullWidth
                  placeholder="00000 00000 00000000000 00"
                  value={tenantForm.rib}
                  onChange={(e) => setTenantForm(prev => ({ ...prev, rib: e.target.value }))}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  label="Numéro MVola"
                  fullWidth
                  placeholder="034 00 000 00"
                  value={tenantForm.mvola}
                  onChange={(e) => setTenantForm(prev => ({ ...prev, mvola: e.target.value }))}
                />
              </Grid>
            </Grid>

            <TextField
              size="small"
              label="URL Cachet & Signature (Image PNG/JPG transparente)"
              fullWidth
              placeholder="https://..."
              value={tenantForm.cachetSignatureUrl}
              onChange={(e) => setTenantForm(prev => ({ ...prev, cachetSignatureUrl: e.target.value }))}
              helperText="Astuce: Hébergez l'image et collez le lien direct ici."
            />
            {tenantForm.cachetSignatureUrl && (
              <Box sx={{ mt: 1, border: '1px dashed #ccc', p: 1, borderRadius: 1, display: 'inline-block' }}>
                <img src={tenantForm.cachetSignatureUrl} alt="Aperçu signature" style={{ maxHeight: 60 }} />
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSettingsOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={saveTenantSettings} sx={{ bgcolor: "#4f46e5" }}>
            Mettre à jour l'Établissement
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
