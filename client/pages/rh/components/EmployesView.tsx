import React, { useState, useMemo } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Divider,
} from "@mui/material";
import {
  Add,
  Edit,
  Delete,
  Search,
  Person,
  Phone,
  Email,
  Badge,
  Work,
  Payment,
  AccountBalance,
  PhoneIphone,
  Refresh,
} from "@mui/icons-material";
import {
  useEmployes,
  useCreateEmploye,
  useUpdateEmploye,
  useDeleteEmploye,
  useSeedDefaultRHData,
} from "@/services/api";
import {
  Employe,
  DepartementPersonnel,
  TypeContrat,
  ModePaiementSalaire,
} from "@shared/api";

const DEPARTEMENTS: { value: DepartementPersonnel; label: string }[] = [
  { value: "hebergement", label: "Hébergement / Étages" },
  { value: "restaurant", label: "Restaurant / Salle" },
  { value: "cuisine", label: "Cuisine" },
  { value: "bar", label: "Bar" },
  { value: "reception", label: "Réception & Accueil" },
  { value: "economat", label: "Économat & Stock" },
  { value: "direction", label: "Direction & Administration" },
  { value: "technique", label: "Maintenance & Technique" },
  { value: "autre", label: "Autre service" },
];

const CONTRATS: TypeContrat[] = ["CDI", "CDD", "Extra", "Saisonnier", "Stage"];

export function EmployesView() {
  const { data: employes = [], isLoading } = useEmployes();
  const createEmploye = useCreateEmploye();
  const updateEmploye = useUpdateEmploye();
  const deleteEmploye = useDeleteEmploye();
  const seedDefaultRH = useSeedDefaultRHData();

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [statutFilter, setStatutFilter] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const initialFormState: Omit<Employe, "id"> = {
    matricule: "",
    nom: "",
    prenom: "",
    departement: "restaurant",
    poste: "",
    typeContrat: "CDI",
    dateEmbauche: new Date().toISOString().split("T")[0],
    statut: "actif",
    telephone: "",
    email: "",
    cin: "",
    adresse: "",
    salaireBase: 500000,
    tauxHoraire: 2880,
    modePaiement: "mobile_money",
    coordonneesPaiement: {
      fournisseurMobile: "MVola",
      numeroMobile: "",
      banque: "",
      rib: "",
    },
    assujettiCnaps: true,
    tauxCnapsSalarial: 0.01,
    cnapsNumber: "",
    assujettiOstie: true,
    tauxOstieSalarial: 0.01,
    ostieNumber: "",
    assujettiIrsa: true,
    nbEnfantsCharge: 0,
    notes: "",
  };

  const [form, setForm] = useState<Omit<Employe, "id">>(initialFormState);

  // Filtered Employes
  const filteredEmployes = useMemo(() => {
    return employes.filter((emp) => {
      const matchSearch =
        !search ||
        `${emp.nom} ${emp.prenom}`.toLowerCase().includes(search.toLowerCase()) ||
        emp.matricule.toLowerCase().includes(search.toLowerCase()) ||
        emp.poste.toLowerCase().includes(search.toLowerCase());

      const matchDept = deptFilter === "all" || emp.departement === deptFilter;
      const matchStatut = statutFilter === "all" || emp.statut === statutFilter;

      return matchSearch && matchDept && matchStatut;
    });
  }, [employes, search, deptFilter, statutFilter]);

  // KPIs
  const totalActifs = employes.filter((e) => e.statut === "actif").length;
  const totalCDI = employes.filter((e) => e.typeContrat === "CDI").length;
  const totalCDD = employes.filter((e) => e.typeContrat === "CDD").length;
  const totalExtras = employes.filter((e) => e.typeContrat === "Extra").length;

  function handleOpenCreate() {
    setEditingId(null);
    const nextMatricule = `EMP-${String(employes.length + 1).padStart(3, "0")}`;
    setForm({
      ...initialFormState,
      matricule: nextMatricule,
    });
    setModalOpen(true);
  }

  function handleOpenEdit(emp: Employe) {
    setEditingId(emp.id);
    const { id, createdAt, updatedAt, ...rest } = emp;
    setForm({
      ...rest,
      coordonneesPaiement: {
        fournisseurMobile: emp.coordonneesPaiement?.fournisseurMobile || "MVola",
        numeroMobile: emp.coordonneesPaiement?.numeroMobile || emp.telephone || "",
        banque: emp.coordonneesPaiement?.banque || "",
        rib: emp.coordonneesPaiement?.rib || "",
      },
    });
    setModalOpen(true);
  }

  function handleSubmit() {
    if (!form.nom || !form.poste || !form.salaireBase) return;

    if (editingId) {
      updateEmploye.mutate(
        { id: editingId, ...form },
        {
          onSuccess: () => setModalOpen(false),
        }
      );
    } else {
      createEmploye.mutate(form, {
        onSuccess: () => setModalOpen(false),
      });
    }
  }

  function handleDelete(id: string, nom: string) {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'employé ${nom} ?`)) {
      deleteEmploye.mutate(id);
    }
  }

  function getDeptLabel(dept: DepartementPersonnel) {
    return DEPARTEMENTS.find((d) => d.value === dept)?.label || dept;
  }

  return (
    <Box>
      {/* KPI CARDS */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, borderLeft: "4px solid #4f46e5" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              EFFECTIF TOTAL ACTIF
            </Typography>
            <Typography variant="h4" fontWeight={800} color="#0f172a" mt={0.5}>
              {totalActifs}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Sur {employes.length} fiches enregistrées
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, borderLeft: "4px solid #06b6d4" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              CONTRATS CDI
            </Typography>
            <Typography variant="h4" fontWeight={800} color="#0f172a" mt={0.5}>
              {totalCDI}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Personnel permanent
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, borderLeft: "4px solid #f59e0b" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              CONTRATS CDD & SAISONNIERS
            </Typography>
            <Typography variant="h4" fontWeight={800} color="#0f172a" mt={0.5}>
              {totalCDD}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Missions à durée déterminée
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, borderLeft: "4px solid #10b981" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              EXTRAS & RENFORTS
            </Typography>
            <Typography variant="h4" fontWeight={800} color="#0f172a" mt={0.5}>
              {totalExtras}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Vacataires / Week-end
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* ACTION & FILTERS TOOLBAR */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flex={1} width="100%">
            <TextField
              size="small"
              placeholder="Rechercher par nom, matricule, poste..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 260 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                displayEmpty
              >
                <MenuItem value="all">Tous les départements</MenuItem>
                {DEPARTEMENTS.map((d) => (
                  <MenuItem key={d.value} value={d.value}>
                    {d.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={statutFilter}
                onChange={(e) => setStatutFilter(e.target.value)}
                displayEmpty
              >
                <MenuItem value="all">Tous les statuts</MenuItem>
                <MenuItem value="actif">Actif</MenuItem>
                <MenuItem value="conge">En congé</MenuItem>
                <MenuItem value="inactif">Inactif / Parti</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Stack direction="row" spacing={1.5}>
            {employes.length === 0 && (
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => {
                  if (window.confirm("Voulez-vous charger l'équipe type et leurs plannings de démonstration ?")) {
                    seedDefaultRH.mutate(undefined, {
                      onSuccess: () => alert("Équipe et plannings de démonstration générés avec succès !"),
                      onError: (err: any) => alert(err?.message || "Erreur lors de la génération."),
                    });
                  }
                }}
                disabled={seedDefaultRH.isPending}
              >
                {seedDefaultRH.isPending ? "Génération..." : "Générer équipe démo"}
              </Button>
            )}

            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleOpenCreate}
              sx={{
                background: "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)",
                fontWeight: 700,
              }}
            >
              Ajouter un salarié
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* EMPLOYEES TABLE */}
      <Paper sx={{ width: "100%", overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight: 620 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Matricule</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Salarié & Contact</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Poste & Département</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Contrat</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>
                  Salaire Base (Ar)
                </TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Règlement</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>CNaPS / OSTIE</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>
                  Statut
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEmployes.map((emp) => (
                <TableRow key={emp.id} hover>
                  <TableCell>
                    <Chip
                      size="small"
                      label={emp.matricule}
                      sx={{ fontWeight: 700, bgcolor: "#f1f5f9", color: "#334155" }}
                    />
                  </TableCell>

                  <TableCell>
                    <Typography fontWeight={700} color="#0f172a">
                      {emp.nom} {emp.prenom}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" mt={0.3}>
                      {emp.telephone && (
                        <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.3}>
                          <Phone sx={{ fontSize: 13 }} /> {emp.telephone}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Typography fontWeight={600} color="#334155" fontSize="0.875rem">
                      {emp.poste}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {getDeptLabel(emp.departement)}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Chip
                      size="small"
                      label={emp.typeContrat}
                      sx={{
                        fontWeight: 700,
                        bgcolor:
                          emp.typeContrat === "CDI"
                            ? "#e0e7ff"
                            : emp.typeContrat === "CDD"
                            ? "#fef3c7"
                            : "#f1f5f9",
                        color:
                          emp.typeContrat === "CDI"
                            ? "#3730a3"
                            : emp.typeContrat === "CDD"
                            ? "#92400e"
                            : "#475569",
                      }}
                    />
                  </TableCell>

                  <TableCell align="right">
                    <Typography fontWeight={800} color="#0f172a">
                      {emp.salaireBase.toLocaleString("fr-FR")} Ar
                    </Typography>
                    {emp.tauxHoraire && (
                      <Typography variant="caption" color="text.secondary">
                        {emp.tauxHoraire.toLocaleString("fr-FR")} Ar/h
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {emp.modePaiement === "mobile_money" ? (
                        <PhoneIphone sx={{ fontSize: 16, color: "#0284c7" }} />
                      ) : emp.modePaiement === "virement" ? (
                        <AccountBalance sx={{ fontSize: 16, color: "#4f46e5" }} />
                      ) : (
                        <Payment sx={{ fontSize: 16, color: "#16a34a" }} />
                      )}
                      <Typography variant="body2" fontWeight={600} textTransform="capitalize">
                        {emp.modePaiement.replace("_", " ")}
                      </Typography>
                    </Stack>
                    {emp.modePaiement === "mobile_money" && (
                      <Typography variant="caption" color="text.secondary">
                        {emp.coordonneesPaiement?.fournisseurMobile || "MVola"} :{" "}
                        {emp.coordonneesPaiement?.numeroMobile || emp.telephone}
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Chip
                        size="small"
                        label="CNaPS"
                        sx={{
                          height: 20,
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          bgcolor: emp.assujettiCnaps ? "#dcfce7" : "#f1f5f9",
                          color: emp.assujettiCnaps ? "#166534" : "#94a3b8",
                        }}
                      />
                      <Chip
                        size="small"
                        label="OSTIE"
                        sx={{
                          height: 20,
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          bgcolor: emp.assujettiOstie ? "#dbeafe" : "#f1f5f9",
                          color: emp.assujettiOstie ? "#1e40af" : "#94a3b8",
                        }}
                      />
                    </Stack>
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={emp.statut === "actif" ? "Actif" : emp.statut === "conge" ? "Congé" : "Inactif"}
                      sx={{
                        fontWeight: 700,
                        bgcolor:
                          emp.statut === "actif"
                            ? "#dcfce7"
                            : emp.statut === "conge"
                            ? "#fef3c7"
                            : "#f1f5f9",
                        color:
                          emp.statut === "actif"
                            ? "#166534"
                            : emp.statut === "conge"
                            ? "#92400e"
                            : "#64748b",
                      }}
                    />
                  </TableCell>

                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      <Tooltip title="Modifier la fiche">
                        <IconButton size="small" onClick={() => handleOpenEdit(emp)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(emp.id, `${emp.nom} ${emp.prenom}`)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}

              {filteredEmployes.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    {employes.length === 0 ? (
                      <Stack spacing={2} alignItems="center">
                        <Typography color="text.secondary" fontWeight={600}>
                          Aucun collaborateur enregistré dans cet établissement.
                        </Typography>
                        <Stack direction="row" spacing={1.5}>
                          <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={handleOpenCreate}
                            sx={{ bgcolor: "#4f46e5", fontWeight: 700, textTransform: "none" }}
                          >
                            Ajouter un collaborateur
                          </Button>
                          <Button
                            variant="outlined"
                            startIcon={<Refresh />}
                            onClick={() => seedDefaultRH.mutate()}
                            disabled={seedDefaultRH.isPending}
                            sx={{ textTransform: "none", fontWeight: 700 }}
                          >
                            {seedDefaultRH.isPending ? "Initialisation..." : "Initialiser avec des profils types (Démo)"}
                          </Button>
                        </Stack>
                      </Stack>
                    ) : (
                      <Typography color="text.secondary" fontWeight={600}>
                        Aucun salarié trouvé avec ces filtres de recherche.
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* MODAL CREATION / MODIFICATION */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          {editingId ? "Modifier la fiche salarié" : "Ajouter un nouveau salarié"}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={3}>
            {/* 1. IDENTITÉ */}
            <Box>
              <Typography variant="subtitle2" fontWeight={800} color="primary" mb={1.5}>
                1. IDENTITÉ & COORDONNÉES
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Matricule"
                    fullWidth
                    size="small"
                    value={form.matricule}
                    onChange={(e) => setForm({ ...form, matricule: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4.5}>
                  <TextField
                    label="Nom"
                    required
                    fullWidth
                    size="small"
                    value={form.nom}
                    onChange={(e) => setForm({ ...form, nom: e.target.value.toUpperCase() })}
                  />
                </Grid>
                <Grid item xs={12} sm={4.5}>
                  <TextField
                    label="Prénom(s)"
                    fullWidth
                    size="small"
                    value={form.prenom}
                    onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Téléphone"
                    fullWidth
                    size="small"
                    value={form.telephone}
                    onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="E-mail"
                    fullWidth
                    size="small"
                    type="email"
                    value={form.email || ""}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="N° CIN / Pièce d'identité"
                    fullWidth
                    size="small"
                    value={form.cin || ""}
                    onChange={(e) => setForm({ ...form, cin: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Adresse physique"
                    fullWidth
                    size="small"
                    value={form.adresse || ""}
                    onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* 2. POSTE & CONTRAT */}
            <Box>
              <Typography variant="subtitle2" fontWeight={800} color="primary" mb={1.5}>
                2. POSTE, DÉPARTEMENT & CONTRAT
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Intitulé du poste"
                    required
                    fullWidth
                    size="small"
                    placeholder="Ex: Chef de Rang, Cuisinier, Réceptionniste"
                    value={form.poste}
                    onChange={(e) => setForm({ ...form, poste: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Département"
                    fullWidth
                    size="small"
                    value={form.departement}
                    onChange={(e) =>
                      setForm({ ...form, departement: e.target.value as DepartementPersonnel })
                    }
                  >
                    {DEPARTEMENTS.map((d) => (
                      <MenuItem key={d.value} value={d.value}>
                        {d.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    label="Type de contrat"
                    fullWidth
                    size="small"
                    value={form.typeContrat}
                    onChange={(e) =>
                      setForm({ ...form, typeContrat: e.target.value as TypeContrat })
                    }
                  >
                    {CONTRATS.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Date d'embauche"
                    type="date"
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    value={form.dateEmbauche}
                    onChange={(e) => setForm({ ...form, dateEmbauche: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    label="Statut"
                    fullWidth
                    size="small"
                    value={form.statut}
                    onChange={(e) =>
                      setForm({ ...form, statut: e.target.value as Employe["statut"] })
                    }
                  >
                    <MenuItem value="actif">Actif (En poste)</MenuItem>
                    <MenuItem value="conge">En congé</MenuItem>
                    <MenuItem value="inactif">Inactif / Démissionnaire</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* 3. RÉMUNÉRATION & PAIEMENT */}
            <Box>
              <Typography variant="subtitle2" fontWeight={800} color="primary" mb={1.5}>
                3. RÉMUNÉRATION & MODE DE RÈGLEMENT
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Salaire de base mensuel (Ar)"
                    type="number"
                    required
                    fullWidth
                    size="small"
                    value={form.salaireBase}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const tauxH = Math.round(val / 173.33);
                      setForm({ ...form, salaireBase: val, tauxHoraire: tauxH });
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Taux horaire équivalent (Ar/h)"
                    type="number"
                    fullWidth
                    size="small"
                    value={form.tauxHoraire || ""}
                    onChange={(e) => setForm({ ...form, tauxHoraire: Number(e.target.value) })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    label="Mode de paiement privilégié"
                    fullWidth
                    size="small"
                    value={form.modePaiement}
                    onChange={(e) =>
                      setForm({ ...form, modePaiement: e.target.value as ModePaiementSalaire })
                    }
                  >
                    <MenuItem value="mobile_money">Mobile Money (MVola / Orange / Airtel)</MenuItem>
                    <MenuItem value="virement">Virement Bancaire (avec RIB)</MenuItem>
                    <MenuItem value="especes">Espèces (Contre décharge)</MenuItem>
                    <MenuItem value="cheque">Chèque bancaire</MenuItem>
                  </TextField>
                </Grid>

                {form.modePaiement === "mobile_money" && (
                  <>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        select
                        label="Opérateur Mobile"
                        fullWidth
                        size="small"
                        value={form.coordonneesPaiement?.fournisseurMobile || "MVola"}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            coordonneesPaiement: {
                              ...form.coordonneesPaiement,
                              fournisseurMobile: e.target.value,
                            },
                          })
                        }
                      >
                        <MenuItem value="MVola">MVola (Telma)</MenuItem>
                        <MenuItem value="Orange Money">Orange Money</MenuItem>
                        <MenuItem value="Airtel Money">Airtel Money</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Numéro Mobile Money"
                        fullWidth
                        size="small"
                        value={form.coordonneesPaiement?.numeroMobile || form.telephone}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            coordonneesPaiement: {
                              ...form.coordonneesPaiement,
                              numeroMobile: e.target.value,
                            },
                          })
                        }
                      />
                    </Grid>
                  </>
                )}

                {form.modePaiement === "virement" && (
                  <>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Nom de la Banque"
                        placeholder="Ex: BNI, BMOI, Société Générale, BOA"
                        fullWidth
                        size="small"
                        value={form.coordonneesPaiement?.banque || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            coordonneesPaiement: {
                              ...form.coordonneesPaiement,
                              banque: e.target.value,
                            },
                          })
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="RIB / Relevé bancaire"
                        placeholder="00004 00123 01234567890 12"
                        fullWidth
                        size="small"
                        value={form.coordonneesPaiement?.rib || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            coordonneesPaiement: {
                              ...form.coordonneesPaiement,
                              rib: e.target.value,
                            },
                          })
                        }
                      />
                    </Grid>
                  </>
                )}
              </Grid>
            </Box>

            <Divider />

            {/* 4. COTISATIONS ET FISCALITÉ FLEXIBLES */}
            <Box>
              <Typography variant="subtitle2" fontWeight={800} color="primary" mb={1.5}>
                4. COTISATIONS SOCIALES & FISCALITÉ (PERSONNALISABLE)
              </Typography>
              <Grid container spacing={2}>
                {/* CNaPS */}
                <Grid item xs={12} sm={6}>
                  <Paper sx={{ p: 1.5, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={form.assujettiCnaps}
                          onChange={(e) =>
                            setForm({ ...form, assujettiCnaps: e.target.checked })
                          }
                        />
                      }
                      label={
                        <Typography fontWeight={700} fontSize="0.875rem">
                          Assujetti à la CNaPS (Sécurité Sociale)
                        </Typography>
                      }
                    />
                    {form.assujettiCnaps && (
                      <Stack spacing={1} mt={1}>
                        <TextField
                          label="N° d'affiliation CNaPS"
                          size="small"
                          fullWidth
                          value={form.cnapsNumber || ""}
                          onChange={(e) => setForm({ ...form, cnapsNumber: e.target.value })}
                        />
                        <TextField
                          label="Taux de cotisation salariale"
                          size="small"
                          fullWidth
                          type="number"
                          value={(form.tauxCnapsSalarial || 0.01) * 100}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              tauxCnapsSalarial: Number(e.target.value) / 100,
                            })
                          }
                          InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                        />
                      </Stack>
                    )}
                  </Paper>
                </Grid>

                {/* OSTIE */}
                <Grid item xs={12} sm={6}>
                  <Paper sx={{ p: 1.5, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={form.assujettiOstie}
                          onChange={(e) =>
                            setForm({ ...form, assujettiOstie: e.target.checked })
                          }
                        />
                      }
                      label={
                        <Typography fontWeight={700} fontSize="0.875rem">
                          Assujetti OSTIE / Médecine du Travail
                        </Typography>
                      }
                    />
                    {form.assujettiOstie && (
                      <Stack spacing={1} mt={1}>
                        <TextField
                          label="N° OSTIE / Santé"
                          size="small"
                          fullWidth
                          value={form.ostieNumber || ""}
                          onChange={(e) => setForm({ ...form, ostieNumber: e.target.value })}
                        />
                        <TextField
                          label="Taux de cotisation salariale"
                          size="small"
                          fullWidth
                          type="number"
                          value={(form.tauxOstieSalarial || 0.01) * 100}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              tauxOstieSalarial: Number(e.target.value) / 100,
                            })
                          }
                          InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                        />
                      </Stack>
                    )}
                  </Paper>
                </Grid>

                {/* IRSA & CHARGES */}
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.assujettiIrsa}
                        onChange={(e) =>
                          setForm({ ...form, assujettiIrsa: e.target.checked })
                        }
                      />
                    }
                    label={
                      <Typography fontWeight={700} fontSize="0.875rem">
                        Assujetti à l'IRSA (Impôt sur les salaires)
                      </Typography>
                    }
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Nombre d'enfants / personnes à charge"
                    type="number"
                    size="small"
                    fullWidth
                    value={form.nbEnfantsCharge || 0}
                    onChange={(e) =>
                      setForm({ ...form, nbEnfantsCharge: Number(e.target.value) })
                    }
                  />
                </Grid>
              </Grid>
            </Box>
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setModalOpen(false)} color="inherit">
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!form.nom || !form.poste || !form.salaireBase || createEmploye.isPending || updateEmploye.isPending}
            sx={{ fontWeight: 700 }}
          >
            {editingId ? "Enregistrer les modifications" : "Créer le salarié"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
