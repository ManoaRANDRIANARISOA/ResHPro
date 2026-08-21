import { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  FormControlLabel,
  Checkbox,
  Stack,
  Card,
  CardContent,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  InputAdornment,
  Divider,
} from "@mui/material";
import AddBusinessIcon from "@mui/icons-material/AddBusiness";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import TuneIcon from "@mui/icons-material/Tune";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import BusinessIcon from "@mui/icons-material/Business";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import {
  useAllTenants,
  useProvisionTenant,
  useUpdateTenantSubscription,
  useUpdateTenantModules,
  useToggleTenantSuspension,
} from "@/services/firestore/superadmin";
import { getSubscriptionDetails, TenantSubscription, TenantConfig } from "@shared/tenant";
import { format, addMonths, addDays } from "date-fns";
import { fr } from "date-fns/locale";

export default function SuperAdminDashboard() {
  const { data: tenants = [], isLoading, refetch } = useAllTenants();
  const provision = useProvisionTenant();
  const updateSubscription = useUpdateTenantSubscription();
  const updateModules = useUpdateTenantModules();
  const toggleSuspension = useToggleTenantSuspension();

  // Recherche & Filtres de locataires
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expiring_soon" | "expired" | "suspended">("all");

  // Formulaire de provisionnement d'un nouveau locataire
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const defaultEndStr = format(addMonths(new Date(), 12), "yyyy-MM-dd");

  const [form, setForm] = useState({
    tenantId: "",
    nom: "",
    themePrimary: "#2563eb",
    themeSecondary: "#10b981",
    logoUrl: "",
    invoicePrefix: "INV",
    nif: "",
    stat: "",
    rcs: "",
    adresse: "",
    telephone: "",
    email: "",
    // Abonnement initial
    subscriptionDuration: "12", // '1', '3', '6', '12', 'trial14', 'custom'
    subscriptionStartDate: todayStr,
    subscriptionEndDate: defaultEndStr,
    subscriptionPlan: "premium" as const,
    // Modules
    modules: {
      hebergement: true,
      restaurant: true,
      stock: true,
      fichesTechniques: true,
      analyseEcarts: true,
      rhPlanningPaie: true,
    }
  });

  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  // Modales d'action sur un locataire existant
  const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [modulesModalOpen, setModulesModalOpen] = useState(false);

  // État du modal de renouvellement
  const [renewMonths, setRenewMonths] = useState("12");
  const [renewCustomEndDate, setRenewCustomEndDate] = useState("");

  // État du modal des modules
  const [tenantModulesForm, setTenantModulesForm] = useState<TenantConfig["modules"]>({
    hebergement: true,
    restaurant: true,
    stock: true,
    fichesTechniques: true,
    analyseEcarts: true,
    iaPredicitions: false,
    multiSite: false,
    rhPlanningPaie: false,
  });

  // Gestion du changement de durée dans le formulaire de création
  function handleDurationChange(duration: string) {
    const start = new Date(form.subscriptionStartDate || new Date());
    let end: Date;
    if (duration === "1") end = addMonths(start, 1);
    else if (duration === "3") end = addMonths(start, 3);
    else if (duration === "6") end = addMonths(start, 6);
    else if (duration === "12") end = addMonths(start, 12);
    else if (duration === "trial14") end = addDays(start, 14);
    else end = addMonths(start, 1);

    setForm({
      ...form,
      subscriptionDuration: duration,
      subscriptionEndDate: format(end, "yyyy-MM-dd"),
    });
  }

  // Lancer le provisionnement
  function handleProvision() {
    if (!form.tenantId || !form.nom) return;

    const subscription: TenantSubscription = {
      status: "active",
      startDate: form.subscriptionStartDate,
      endDate: form.subscriptionEndDate,
      plan: form.subscriptionPlan,
      durationMonths: Number(form.subscriptionDuration) || 12,
      contactCommercial: {
        telephone: "+261 34 00 000 00",
        email: "commercial@reshpro.mg",
        nom: "ResiPro Commercial",
      },
    };

    provision.mutate({
      ...form,
      subscription,
    }, {
      onSuccess: (id) => {
        setCreatedUrl(`${window.location.origin}/${id}/login`);
        refetch();
        setForm({
          ...form,
          tenantId: "",
          nom: "",
          nif: "",
          stat: "",
          rcs: "",
          adresse: "",
          telephone: "",
          email: "",
          invoicePrefix: "INV",
          subscriptionStartDate: todayStr,
          subscriptionEndDate: defaultEndStr,
        });
      }
    });
  }

  // Renouveler l'abonnement d'un locataire
  function handleRenewSubscription() {
    if (!selectedTenant) return;
    const currentSub = selectedTenant.config?.subscription || selectedTenant.publicConfig?.subscription;
    const now = new Date();
    const baseDate = currentSub?.endDate && new Date(currentSub.endDate) > now ? new Date(currentSub.endDate) : now;

    let newEndDate: Date;
    if (renewMonths === "custom" && renewCustomEndDate) {
      newEndDate = new Date(renewCustomEndDate);
    } else {
      newEndDate = addMonths(baseDate, Number(renewMonths) || 12);
    }

    const updatedSub: TenantSubscription = {
      status: "active",
      startDate: currentSub?.startDate || format(now, "yyyy-MM-dd"),
      endDate: format(newEndDate, "yyyy-MM-dd"),
      plan: currentSub?.plan || "premium",
      durationMonths: Number(renewMonths) || 12,
      contactCommercial: currentSub?.contactCommercial || {
        telephone: "+261 34 00 000 00",
        email: "commercial@reshpro.mg",
        nom: "ResiPro Commercial",
      },
      suspendedReason: undefined,
    };

    updateSubscription.mutate({
      tenantId: selectedTenant.id,
      subscription: updatedSub,
    }, {
      onSuccess: () => {
        setRenewModalOpen(false);
        setSelectedTenant(null);
        refetch();
        alert(`Abonnement renouvelé avec succès jusqu'au ${format(newEndDate, "dd MMMM yyyy", { locale: fr })}.`);
      },
      onError: (err: any) => {
        alert(err?.message || "Erreur lors du renouvellement.");
      }
    });
  }

  // Mettre à jour les modules d'un locataire
  function handleSaveModules() {
    if (!selectedTenant) return;
    updateModules.mutate({
      tenantId: selectedTenant.id,
      modules: tenantModulesForm,
    }, {
      onSuccess: () => {
        setModulesModalOpen(false);
        setSelectedTenant(null);
        refetch();
        alert("Modules mis à jour avec succès.");
      },
      onError: (err: any) => {
        alert(err?.message || "Erreur lors de la mise à jour des modules.");
      }
    });
  }

  // Suspendre ou Réactiver un locataire
  function handleToggleSuspension(t: any) {
    const sub = t.config?.subscription || t.publicConfig?.subscription;
    const subDetails = getSubscriptionDetails(sub);
    const isSuspended = subDetails.status === "suspended";
    const action = isSuspended ? "réactiver" : "suspendre temporairement";

    if (window.confirm(`Voulez-vous vraiment ${action} l'accès pour l'établissement '${t.publicConfig?.nom || t.id}' ?`)) {
      toggleSuspension.mutate({
        tenantId: t.id,
        currentStatus: subDetails.status,
        currentEndDate: subDetails.endDateFormatted,
      }, {
        onSuccess: () => {
          refetch();
        }
      });
    }
  }

  // Ouvrir modal de modules
  function openModulesModal(t: any) {
    setSelectedTenant(t);
    const currentModules = t.config?.modules || {
      hebergement: true,
      restaurant: true,
      stock: true,
      fichesTechniques: true,
      analyseEcarts: true,
      iaPredicitions: false,
      multiSite: false,
      rhPlanningPaie: false,
    };
    setTenantModulesForm(currentModules);
    setModulesModalOpen(true);
  }

  // Ouvrir modal de renouvellement
  function openRenewModal(t: any) {
    setSelectedTenant(t);
    const sub = t.config?.subscription || t.publicConfig?.subscription;
    const now = new Date();
    const baseDate = sub?.endDate && new Date(sub.endDate) > now ? new Date(sub.endDate) : now;
    setRenewMonths("12");
    setRenewCustomEndDate(format(addMonths(baseDate, 12), "yyyy-MM-dd"));
    setRenewModalOpen(true);
  }

  // KPIs Globaux
  const kpis = useMemo(() => {
    let total = tenants.length;
    let active = 0;
    let expiringSoon = 0;
    let expired = 0;
    let rhCount = 0;

    for (const t of tenants) {
      const sub = t.config?.subscription || t.publicConfig?.subscription;
      const details = getSubscriptionDetails(sub);
      if (details.status === "active" || details.status === "trial") active++;
      else if (details.status === "expiring_soon") expiringSoon++;
      else if (details.status === "expired" || details.status === "suspended") expired++;

      if (t.config?.modules?.rhPlanningPaie || t.id === "kanana" || t.id === "demo") {
        rhCount++;
      }
    }

    return { total, active, expiringSoon, expired, rhCount };
  }, [tenants]);

  // Filtrage des locataires
  const filteredTenants = useMemo(() => {
    return tenants.filter((t: any) => {
      const nom = (t.publicConfig?.nom || "").toLowerCase();
      const id = (t.id || "").toLowerCase();
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q || nom.includes(q) || id.includes(q);

      if (!matchSearch) return false;

      if (statusFilter === "all") return true;
      const sub = t.config?.subscription || t.publicConfig?.subscription;
      const details = getSubscriptionDetails(sub);
      return details.status === statusFilter;
    });
  }, [tenants, searchTerm, statusFilter]);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: "auto", bgcolor: "#f8fafc", minHeight: "100vh" }}>
      {/* HEADER & TITRE */}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2} mb={3.5}>
        <Box>
          <Typography variant="h4" fontWeight={900} color="#0f172a">
            Centre de Contrôle Super-Admin
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Gestion multi-locataires, cycle de vie des abonnements, modules activés et auto-restriction
          </Typography>
        </Box>
        <Chip
          icon={<BusinessIcon />}
          label={`${kpis.total} Établissement${kpis.total > 1 ? "s" : ""} enregistré${kpis.total > 1 ? "s" : ""}`}
          sx={{ fontWeight: 800, bgcolor: "#e0e7ff", color: "#3730a3", px: 1 }}
        />
      </Stack>

      {/* KPI METRICS OVERVIEW */}
      <Grid container spacing={2.5} mb={4}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#ffffff" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">
                Total Locataires
              </Typography>
              <BusinessIcon fontSize="small" sx={{ color: "#64748b" }} />
            </Stack>
            <Typography variant="h4" fontWeight={900} color="#0f172a" mt={1}>
              {kpis.total}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Parc d'hôtels & restos
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: "1px solid #bbf7d0", bgcolor: "#f0fdf4" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" fontWeight={700} color="#166534" textTransform="uppercase">
                Abonnements Actifs
              </Typography>
              <CheckCircleOutlineIcon fontSize="small" sx={{ color: "#16a34a" }} />
            </Stack>
            <Typography variant="h4" fontWeight={900} color="#15803d" mt={1}>
              {kpis.active}
            </Typography>
            <Typography variant="caption" color="#166534">
              Accès illimités en cours
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: "1px solid #fde68a", bgcolor: "#fffbeb" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" fontWeight={700} color="#92400e" textTransform="uppercase">
                Échéance Proche (J-10)
              </Typography>
              <WarningAmberIcon fontSize="small" sx={{ color: "#d97706" }} />
            </Stack>
            <Typography variant="h4" fontWeight={900} color="#b45309" mt={1}>
              {kpis.expiringSoon}
            </Typography>
            <Typography variant="caption" color="#92400e">
              Alerte préventive active
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: "1px solid #fecaca", bgcolor: "#fef2f2" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" fontWeight={700} color="#991b1b" textTransform="uppercase">
                Expirés / Suspendus
              </Typography>
              <ErrorOutlineIcon fontSize="small" sx={{ color: "#dc2626" }} />
            </Stack>
            <Typography variant="h4" fontWeight={900} color="#b91c1c" mt={1}>
              {kpis.expired}
            </Typography>
            <Typography variant="caption" color="#991b1b">
              Auto-restriction active
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: "1px solid #e0e7ff", bgcolor: "#eef2ff" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" fontWeight={700} color="#3730a3" textTransform="uppercase">
                Option RH & Paie
              </Typography>
              <PeopleAltIcon fontSize="small" sx={{ color: "#4f46e5" }} />
            </Stack>
            <Typography variant="h4" fontWeight={900} color="#4338ca" mt={1}>
              {kpis.rhCount}
            </Typography>
            <Typography variant="caption" color="#3730a3">
              Locataires souscrits RH
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* CONTENU PRINCIPAL EN 2 COLONNES */}
      <Grid container spacing={3.5}>
        {/* COLONNE GAUCHE : FORMULAIRE DE PROVISIONNEMENT */}
        <Grid item xs={12} lg={5}>
          <Paper sx={{ p: 3.5, borderRadius: 3.5, border: "1px solid #e2e8f0", bgcolor: "#ffffff" }}>
            <Stack direction="row" alignItems="center" spacing={1.5} mb={2.5}>
              <Box sx={{ p: 1, borderRadius: 2, bgcolor: "#eff6ff", color: "#2563eb" }}>
                <AddBusinessIcon />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={800} color="#0f172a">
                  Provisionner un Nouveau Locataire
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Création d'un espace dédié avec cycle de vie paramétrable
                </Typography>
              </Box>
            </Stack>

            <Stack spacing={2.2}>
              <TextField 
                label="Identifiant URL unique (ex: kanana, okalodge)" 
                size="small"
                fullWidth 
                required
                value={form.tenantId}
                onChange={(e) => setForm({ ...form, tenantId: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "") })}
                helperText={`Lien de connexion direct : /${form.tenantId || "{slug}"}/login`}
              />
              <TextField 
                label="Nom de l'établissement *" 
                size="small"
                fullWidth 
                required
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
              />

              <Stack direction="row" spacing={1.5}>
                <TextField 
                  label="NIF" 
                  size="small"
                  fullWidth 
                  placeholder="À fournir"
                  value={form.nif}
                  onChange={(e) => setForm({ ...form, nif: e.target.value })}
                />
                <TextField 
                  label="STAT" 
                  size="small"
                  fullWidth 
                  placeholder="À fournir"
                  value={form.stat}
                  onChange={(e) => setForm({ ...form, stat: e.target.value })}
                />
              </Stack>

              <Stack direction="row" spacing={1.5}>
                <TextField 
                  label="Téléphone officiel" 
                  size="small"
                  fullWidth 
                  placeholder="+261 34 ..."
                  value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                />
                <TextField 
                  label="Email de contact" 
                  size="small"
                  fullWidth 
                  placeholder="contact@..."
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Stack>

              <Stack direction="row" spacing={1.5}>
                <TextField 
                  label="Préfixe Factures" 
                  size="small"
                  fullWidth 
                  placeholder="Ex: KAN"
                  value={form.invoicePrefix}
                  onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })}
                />
                <TextField 
                  label="Logo URL" 
                  size="small"
                  fullWidth 
                  placeholder="https://..."
                  value={form.logoUrl}
                  onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                />
              </Stack>

              {/* SECTION: PARAMÉTRAGE DU CYCLE DE VIE ET DE L'ABONNEMENT */}
              <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <Typography variant="subtitle2" fontWeight={800} color="#1e293b" mb={1.5}>
                  ⏳ Durée & Cycle de Vie de l'Abonnement
                </Typography>
                
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={6}>
                    <FormControl size="small" fullWidth>
                      <InputLabel>Durée de validité</InputLabel>
                      <Select
                        label="Durée de validité"
                        value={form.subscriptionDuration}
                        onChange={(e) => handleDurationChange(e.target.value)}
                      >
                        <MenuItem value="1">1 Mois (Mensuel)</MenuItem>
                        <MenuItem value="3">3 Mois (Trimestriel)</MenuItem>
                        <MenuItem value="6">6 Mois (Semestriel)</MenuItem>
                        <MenuItem value="12">12 Mois (1 An - Annuel)</MenuItem>
                        <MenuItem value="trial14">14 Jours (Essai Gratuit)</MenuItem>
                        <MenuItem value="custom">Date Personnalisée</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Date d'échéance"
                      type="date"
                      size="small"
                      fullWidth
                      value={form.subscriptionEndDate}
                      onChange={(e) => setForm({ ...form, subscriptionEndDate: e.target.value, subscriptionDuration: "custom" })}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* SECTION: MODULES À ACTIVER */}
              <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <Typography variant="subtitle2" fontWeight={800} color="#1e293b" mb={1}>
                  🧩 Modules & Fonctionnalités Souscrites
                </Typography>
                <Grid container spacing={0.5}>
                  <Grid item xs={6}>
                    <FormControlLabel 
                      control={<Checkbox size="small" checked={form.modules.hebergement} onChange={(e) => setForm({...form, modules: {...form.modules, hebergement: e.target.checked}})} />} 
                      label={<Typography variant="caption" fontWeight={600}>Hébergement</Typography>} 
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControlLabel 
                      control={<Checkbox size="small" checked={form.modules.restaurant} onChange={(e) => setForm({...form, modules: {...form.modules, restaurant: e.target.checked}})} />} 
                      label={<Typography variant="caption" fontWeight={600}>Restaurant & Bar</Typography>} 
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControlLabel 
                      control={<Checkbox size="small" checked={form.modules.stock} onChange={(e) => setForm({...form, modules: {...form.modules, stock: e.target.checked}})} />} 
                      label={<Typography variant="caption" fontWeight={600}>Économat / Stock</Typography>} 
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControlLabel 
                      control={<Checkbox size="small" checked={form.modules.fichesTechniques} onChange={(e) => setForm({...form, modules: {...form.modules, fichesTechniques: e.target.checked}})} />} 
                      label={<Typography variant="caption" fontWeight={600}>Fiches Techniques</Typography>} 
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControlLabel 
                      control={<Checkbox size="small" checked={form.modules.analyseEcarts} onChange={(e) => setForm({...form, modules: {...form.modules, analyseEcarts: e.target.checked}})} />} 
                      label={<Typography variant="caption" fontWeight={600}>Analyse Écarts</Typography>} 
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControlLabel 
                      control={<Checkbox size="small" color="secondary" checked={form.modules.rhPlanningPaie} onChange={(e) => setForm({...form, modules: {...form.modules, rhPlanningPaie: e.target.checked}})} />} 
                      label={<Typography variant="caption" fontWeight={700} color="#7c3aed">👥 RH & Paie (Option)</Typography>} 
                    />
                  </Grid>
                </Grid>
              </Box>

              <Button 
                variant="contained" 
                size="large" 
                sx={{
                  bgcolor: "#2563eb",
                  fontWeight: 800,
                  py: 1.3,
                  borderRadius: 2.5,
                  textTransform: "none",
                  "&:hover": { bgcolor: "#1d4ed8" },
                }}
                onClick={handleProvision}
                disabled={provision.isPending || !form.tenantId || !form.nom}
              >
                {provision.isPending ? "Création en cours..." : "🚀 Créer & Activer le Locataire"}
              </Button>
            </Stack>

            {createdUrl && (
              <Alert severity="success" sx={{ mt: 2.5, borderRadius: 2.5 }}>
                <Typography variant="subtitle2" fontWeight={800}>Locataire créé avec succès !</Typography>
                Lien de connexion : <a href={createdUrl} target="_blank" rel="noreferrer"><b>{createdUrl}</b></a>
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* COLONNE DROITE : ANNUAIRE DES TENANTS EXISTANTS */}
        <Grid item xs={12} lg={7}>
          <Paper sx={{ p: 3.5, borderRadius: 3.5, border: "1px solid #e2e8f0", bgcolor: "#ffffff" }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2} mb={2.5}>
              <Box>
                <Typography variant="h6" fontWeight={800} color="#0f172a">
                  Annuaire des Locataires ({filteredTenants.length})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Supervision en direct, renouvellement et alertes de fin de période
                </Typography>
              </Box>

              {/* FILTRE PAR STATUT D'ABONNEMENT */}
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <MenuItem value="all">Tous les statuts</MenuItem>
                  <MenuItem value="active">🟢 Actifs</MenuItem>
                  <MenuItem value="expiring_soon">🟡 Échéance J-10</MenuItem>
                  <MenuItem value="expired">🔴 Expirés / Bloqués</MenuItem>
                  <MenuItem value="suspended">⚫ Suspendus</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            {/* BARRE DE RECHERCHE */}
            <TextField
              size="small"
              fullWidth
              placeholder="Rechercher par nom ou identifiant URL..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: "#94a3b8" }} />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2.5 }}
            />

            {isLoading ? (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <Typography color="text.secondary">Chargement des établissements...</Typography>
              </Box>
            ) : filteredTenants.length === 0 ? (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <Typography color="text.secondary">Aucun établissement ne correspond aux critères.</Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {filteredTenants.map((t: any) => {
                  const sub = t.config?.subscription || t.publicConfig?.subscription;
                  const subDetails = getSubscriptionDetails(sub);
                  const hasRH = t.config?.modules?.rhPlanningPaie || t.id === "kanana" || t.id === "demo";

                  return (
                    <Card
                      key={t.id}
                      variant="outlined"
                      sx={{
                        borderRadius: 3,
                        border: "1px solid #e2e8f0",
                        transition: "all 0.2s ease-in-out",
                        "&:hover": {
                          borderColor: "#cbd5e1",
                          boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.05)",
                        },
                      }}
                    >
                      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2} mb={1.5}>
                          {/* LOGO & NOM */}
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                            <img 
                              src={t.publicConfig?.logoUrl || "/assets/default-logo.jpg"} 
                              alt={t.id} 
                              style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 12, border: "1px solid #e2e8f0" }} 
                            />
                            <Box>
                              <Typography variant="subtitle1" fontWeight={800} color="#0f172a" lineHeight={1.2}>
                                {t.publicConfig?.nom || t.id}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                /{t.id} • Factures : {t.config?.invoicePrefix || "FAC"}
                              </Typography>
                            </Box>
                          </Stack>

                          {/* BADGE DE CYCLE DE VIE DE L'ABONNEMENT */}
                          <Box>
                            {subDetails.status === "active" && (
                              <Chip
                                icon={<CheckCircleOutlineIcon fontSize="small" />}
                                label={`Actif (${subDetails.daysRemaining}j restants)`}
                                size="small"
                                sx={{ bgcolor: "#f0fdf4", color: "#166534", fontWeight: 700, border: "1px solid #bbf7d0" }}
                              />
                            )}
                            {subDetails.status === "trial" && (
                              <Chip
                                label={`Essai (${subDetails.daysRemaining}j)`}
                                size="small"
                                sx={{ bgcolor: "#eff6ff", color: "#1e40af", fontWeight: 700, border: "1px solid #bfdbfe" }}
                              />
                            )}
                            {subDetails.status === "expiring_soon" && (
                              <Chip
                                icon={<WarningAmberIcon fontSize="small" />}
                                label={`Expire dans ${subDetails.daysRemaining}j`}
                                size="small"
                                sx={{ bgcolor: "#fffbeb", color: "#b45309", fontWeight: 800, border: "1px solid #fde68a" }}
                              />
                            )}
                            {subDetails.status === "expired" && (
                              <Chip
                                icon={<ErrorOutlineIcon fontSize="small" />}
                                label="Expiré (Restreint)"
                                size="small"
                                sx={{ bgcolor: "#fef2f2", color: "#b91c1c", fontWeight: 800, border: "1px solid #fecaca" }}
                              />
                            )}
                            {subDetails.status === "suspended" && (
                              <Chip
                                icon={<PauseCircleOutlineIcon fontSize="small" />}
                                label="Suspendu"
                                size="small"
                                sx={{ bgcolor: "#f1f5f9", color: "#475569", fontWeight: 800, border: "1px solid #cbd5e1" }}
                              />
                            )}
                          </Box>
                        </Stack>

                        {/* DATE D'ÉCHÉANCE ET CONTACTS */}
                        {subDetails.endDateFormatted && (
                          <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                            📅 Période valide jusqu'au <b>{subDetails.endDateFormatted}</b>
                          </Typography>
                        )}

                        {/* LISTE DES MODULES ACTIFS */}
                        <Stack direction="row" flexWrap="wrap" gap={0.8} mb={2}>
                          {t.config?.modules?.hebergement && <Chip size="small" label="Hébergement" sx={{ height: 22, fontSize: "0.7rem" }} />}
                          {t.config?.modules?.restaurant && <Chip size="small" label="Restaurant" sx={{ height: 22, fontSize: "0.7rem" }} />}
                          {t.config?.modules?.stock && <Chip size="small" label="Stock" sx={{ height: 22, fontSize: "0.7rem" }} />}
                          {t.config?.modules?.fichesTechniques && <Chip size="small" label="Fiches Tech." sx={{ height: 22, fontSize: "0.7rem" }} />}
                          {t.config?.modules?.analyseEcarts && <Chip size="small" label="Écarts" sx={{ height: 22, fontSize: "0.7rem" }} />}
                          {hasRH ? (
                            <Chip size="small" label="👥 RH & Paie Actif" sx={{ height: 22, fontSize: "0.7rem", bgcolor: "#ede9fe", color: "#5b21b6", fontWeight: 700 }} />
                          ) : (
                            <Chip size="small" label="RH Non Inclus" variant="outlined" sx={{ height: 22, fontSize: "0.7rem", color: "#94a3b8" }} />
                          )}
                        </Stack>

                        <Divider sx={{ mb: 1.5 }} />

                        {/* BOUTONS D'ACTION DU CYCLE DE VIE */}
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<AutorenewIcon fontSize="small" />}
                            onClick={() => openRenewModal(t)}
                            sx={{
                              bgcolor: "#10b981",
                              textTransform: "none",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              borderRadius: 2,
                              "&:hover": { bgcolor: "#059669" },
                            }}
                          >
                            Renouveler
                          </Button>

                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<TuneIcon fontSize="small" />}
                            onClick={() => openModulesModal(t)}
                            sx={{
                              borderColor: "#cbd5e1",
                              color: "#334155",
                              textTransform: "none",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              borderRadius: 2,
                              "&:hover": { bgcolor: "#f8fafc" },
                            }}
                          >
                            Modules
                          </Button>

                          <Button
                            variant="outlined"
                            size="small"
                            color={subDetails.status === "suspended" ? "success" : "error"}
                            startIcon={subDetails.status === "suspended" ? <PlayCircleOutlineIcon fontSize="small" /> : <PauseCircleOutlineIcon fontSize="small" />}
                            onClick={() => handleToggleSuspension(t)}
                            sx={{
                              textTransform: "none",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              borderRadius: 2,
                            }}
                          >
                            {subDetails.status === "suspended" ? "Réactiver" : "Suspendre"}
                          </Button>

                          <Button
                            variant="outlined"
                            size="small"
                            endIcon={<OpenInNewIcon fontSize="small" />}
                            href={`/${t.id}/login`}
                            target="_blank"
                            sx={{
                              borderColor: "#3b82f6",
                              color: "#2563eb",
                              textTransform: "none",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              borderRadius: 2,
                            }}
                          >
                            Connexion
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* MODAL DE RENOUVELLEMENT D'ABONNEMENT */}
      <Dialog open={renewModalOpen} onClose={() => setRenewModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          Renouveler l'Abonnement
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedTenant && (
            <Stack spacing={2.5}>
              <Typography variant="body2" color="text.secondary">
                Établissement : <b>{selectedTenant.publicConfig?.nom || selectedTenant.id}</b>
              </Typography>

              <FormControl size="small" fullWidth>
                <InputLabel>Durée du renouvellement</InputLabel>
                <Select
                  label="Durée du renouvellement"
                  value={renewMonths}
                  onChange={(e) => {
                    setRenewMonths(e.target.value);
                    const now = new Date();
                    if (e.target.value !== "custom") {
                      setRenewCustomEndDate(format(addMonths(now, Number(e.target.value)), "yyyy-MM-dd"));
                    }
                  }}
                >
                  <MenuItem value="1">+1 Mois</MenuItem>
                  <MenuItem value="3">+3 Mois (Trimestre)</MenuItem>
                  <MenuItem value="6">+6 Mois (Semestre)</MenuItem>
                  <MenuItem value="12">+12 Mois (1 An)</MenuItem>
                  <MenuItem value="custom">Date Personnalisée</MenuItem>
                </Select>
              </FormControl>

              {renewMonths === "custom" && (
                <TextField
                  label="Nouvelle date d'expiration"
                  type="date"
                  size="small"
                  fullWidth
                  value={renewCustomEndDate}
                  onChange={(e) => setRenewCustomEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRenewModalOpen(false)} sx={{ textTransform: "none" }}>
            Annuler
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleRenewSubscription}
            disabled={updateSubscription.isPending}
            sx={{ fontWeight: 700, textTransform: "none" }}
          >
            {updateSubscription.isPending ? "Enregistrement..." : "Confirmer le Renouvellement"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL DE GESTION DES MODULES */}
      <Dialog open={modulesModalOpen} onClose={() => setModulesModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          Gérer les Modules Souscrits
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedTenant && (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Activez ou désactivez les fonctionnalités pour <b>{selectedTenant.publicConfig?.nom || selectedTenant.id}</b> :
              </Typography>

              <FormControlLabel 
                control={<Checkbox checked={tenantModulesForm.hebergement} onChange={(e) => setTenantModulesForm({...tenantModulesForm, hebergement: e.target.checked})} />} 
                label="Module Hébergement (Chambres & Réservations)" 
              />
              <FormControlLabel 
                control={<Checkbox checked={tenantModulesForm.restaurant} onChange={(e) => setTenantModulesForm({...tenantModulesForm, restaurant: e.target.checked})} />} 
                label="Module Restaurant & Bar" 
              />
              <FormControlLabel 
                control={<Checkbox checked={tenantModulesForm.stock} onChange={(e) => setTenantModulesForm({...tenantModulesForm, stock: e.target.checked})} />} 
                label="Module Économat / Stock" 
              />
              <FormControlLabel 
                control={<Checkbox checked={tenantModulesForm.fichesTechniques} onChange={(e) => setTenantModulesForm({...tenantModulesForm, fichesTechniques: e.target.checked})} />} 
                label="Fiches Techniques & Recettes" 
              />
              <FormControlLabel 
                control={<Checkbox checked={tenantModulesForm.analyseEcarts} onChange={(e) => setTenantModulesForm({...tenantModulesForm, analyseEcarts: e.target.checked})} />} 
                label="Analyse des Écarts & Pertes" 
              />
              <Divider sx={{ my: 1 }} />
              <FormControlLabel 
                control={<Checkbox color="secondary" checked={tenantModulesForm.rhPlanningPaie || false} onChange={(e) => setTenantModulesForm({...tenantModulesForm, rhPlanningPaie: e.target.checked})} />} 
                label={<Typography fontWeight={700} color="#7c3aed">👥 Module RH (Planning Personnel & Suivi Paie)</Typography>} 
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModulesModalOpen(false)} sx={{ textTransform: "none" }}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveModules}
            disabled={updateModules.isPending}
            sx={{ fontWeight: 700, textTransform: "none" }}
          >
            {updateModules.isPending ? "Enregistrement..." : "Enregistrer les Modifications"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
