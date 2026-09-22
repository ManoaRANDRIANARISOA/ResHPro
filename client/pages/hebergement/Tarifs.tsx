import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  Select,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Grid,
  Card,
  CardContent,
  Tooltip,
  Alert,
  Tabs,
  Tab,
  InputAdornment,
  Switch,
  FormControlLabel,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import BedIcon from "@mui/icons-material/Bed";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import LockIcon from "@mui/icons-material/Lock";
import { useEffect, useState, useMemo } from "react";
import { useChambres, useCreateChambre, useUpdateChambre, useDeleteChambre } from "@/services/api";
import type { Chambre, HebergementPack } from "@shared/api";
import { HebergementTaxe, DEFAULT_HEBERGEMENT_TAXES } from "@shared/tenant";
import { useTenant } from "@/contexts/TenantContext";
import { useRBAC } from "@/hooks/useRBAC";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

function SortableRow({ row, idx, categories, updateByIndex, removeRow }: any) {
  const itemId = row.id || row.tempId;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: itemId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : "auto",
    position: isDragging ? "relative" : "static",
  } as React.CSSProperties;

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "30px 80px 1fr 90px 140px 90px", md: "40px 140px 1fr 120px 180px 100px" },
        gap: 1.5,
        px: 2,
        py: 1,
        alignItems: "center",
        borderRadius: 1.5,
        border: "1px solid #f1f5f9",
        bgcolor: row.isNew ? "#f0fdf4" : (isDragging ? "#e2e8f0" : "#ffffff"),
        "&:hover": { bgcolor: "#f8fafc" },
        opacity: isDragging ? 0.8 : 1,
        boxShadow: isDragging ? "0 5px 15px rgba(0,0,0,0.15)" : "none",
      }}
    >
      <Box {...attributes} {...listeners} sx={{ cursor: "grab", display: "flex", alignItems: "center", color: "#94a3b8" }}>
        <DragIndicatorIcon fontSize="small" />
      </Box>
      <TextField
        size="small"
        value={row.numero}
        placeholder="Ex: 101"
        onChange={(e) => updateByIndex(idx, "numero", e.target.value)}
        sx={{ "& input": { fontWeight: 700 } }}
      />
      <Select
        size="small"
        value={row.categorie}
        onChange={(e) => updateByIndex(idx, "categorie", e.target.value as string)}
      >
        {categories.map((cat: string) => (
          <MenuItem key={cat} value={cat}>
            {cat}
          </MenuItem>
        ))}
      </Select>
      <TextField
        size="small"
        type="number"
        value={row.capacite}
        onChange={(e) => updateByIndex(idx, "capacite", parseInt(e.target.value || "1", 10))}
        inputProps={{ min: 1 }}
      />
      <TextField
        size="small"
        type="number"
        value={row.tarif}
        onChange={(e) => updateByIndex(idx, "tarif", parseInt(e.target.value || "0", 10))}
        InputProps={{
          endAdornment: <InputAdornment position="end">Ar</InputAdornment>,
        }}
        sx={{ "& input": { fontWeight: 700 } }}
      />
      <Stack direction="row" justifyContent="flex-end">
        <Tooltip title="Supprimer la chambre">
          <IconButton size="small" color="error" onClick={() => removeRow(idx)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}

const DEFAULT_PACKS: HebergementPack[] = [
  {
    id: "chambre_seule",
    nom: "Chambre Seule (Logement Simple)",
    description: "Nuitée standard sans repas inclus.",
    typeCalcul: "par_chambre_nuit",
    prix: 0,
    isDefault: true,
  },
  {
    id: "pdj_inclus",
    nom: "Formule Petit-Déjeuner (B&B)",
    description: "Nuitée avec petit-déjeuner complet par personne.",
    typeCalcul: "par_personne_nuit",
    prix: 15000,
  },
  {
    id: "demi_pension",
    nom: "Formule Demi-Pension",
    description: "Nuitée avec Petit-déjeuner et Dîner (hors boissons).",
    typeCalcul: "par_personne_nuit",
    prix: 45000,
  },
  {
    id: "pension_complete",
    nom: "Formule Pension Complète",
    description: "Nuitée avec Petit-déjeuner, Déjeuner et Dîner.",
    typeCalcul: "par_personne_nuit",
    prix: 75000,
  },
];

export default function HebergementTarifs() {
  const { data: rooms } = useChambres();
  const createChambre = useCreateChambre();
  const updateChambre = useUpdateChambre();
  const deleteChambre = useDeleteChambre();
  const { config, tenantId, refreshConfig } = useTenant();

  const [tabValue, setTabValue] = useState<number>(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Catégories de chambres
  const [categories, setCategories] = useState<string[]>([]);
  const [newCatInput, setNewCatInput] = useState("");
  const [openCatModal, setOpenCatModal] = useState(false);

  // 2. Grille des chambres
  const [rows, setRows] = useState<
    Array<{ id?: string; tempId?: string; numero: string; categorie: string; capacite: number; tarif: number; isNew?: boolean; ordre?: number }>
  >([]);

  // 3. Formules & Packs
  const [packs, setPacks] = useState<HebergementPack[]>([]);
  const [packModalOpen, setPackModalOpen] = useState(false);
  const [editingPack, setEditingPack] = useState<HebergementPack | null>(null);
  const [packForm, setPackForm] = useState<{
    id?: string;
    nom: string;
    description: string;
    typeCalcul: "par_personne_nuit" | "par_chambre_nuit" | "forfait_fixe";
    prix: number;
  }>({
    nom: "",
    description: "",
    typeCalcul: "par_personne_nuit",
    prix: 0,
  });

  const { role } = useRBAC();
  const isDirectionOrAdmin = role === "direction" || role === "admin";

  const [taxes, setTaxes] = useState<HebergementTaxe[]>(DEFAULT_HEBERGEMENT_TAXES);
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<HebergementTaxe | null>(null);
  const [taxForm, setTaxForm] = useState<Omit<HebergementTaxe, "id">>({
    nom: "",
    description: "",
    typeCalcul: "par_nuitee",
    montant: 0,
    actif: true,
  });

  // Synchronisation avec les données Firestore
  useEffect(() => {
    if (config?.hebergementTypes && config.hebergementTypes.length > 0) {
      setCategories(config.hebergementTypes);
    } else {
      setCategories(["standard", "suite", "familiale", "bungalow"]);
    }

    if (config?.hebergementPacks && config.hebergementPacks.length > 0) {
      setPacks(config.hebergementPacks);
    } else {
      setPacks(DEFAULT_PACKS);
    }

    if (config?.hebergementTaxes && config.hebergementTaxes.length > 0) {
      setTaxes(config.hebergementTaxes);
    } else {
      setTaxes(DEFAULT_HEBERGEMENT_TAXES);
    }
  }, [config]);

  useEffect(() => {
    const sortedRooms = [...(rooms || [])].sort((a, b) => {
      if (a.ordre !== undefined && b.ordre !== undefined) return a.ordre - b.ordre;
      if (a.ordre !== undefined) return -1;
      if (b.ordre !== undefined) return 1;

      const numA = a.numero || "";
      const numB = b.numero || "";
      return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' });
    });

    setRows(
      sortedRooms.map((c) => ({
        id: c.id,
        tempId: `temp_${Math.random().toString(36).substr(2, 9)}`,
        numero: c.numero,
        categorie: c.categorie,
        capacite: c.capacite,
        tarif: c.tarif_base,
        ordre: c.ordre,
      }))
    );
  }, [rooms]);

  // Sauvegarde globale de la configuration des catégories et des packs
  async function saveConfigToFirestore(newCats?: string[], newPacksList?: HebergementPack[]) {
    if (!tenantId) return;
    try {
      const catsToSave = newCats || categories;
      const packsToSave = newPacksList || packs;

      const ref = doc(db, `tenants/${tenantId}/config/main`);
      await setDoc(ref, { hebergementTypes: catsToSave, hebergementPacks: packsToSave }, { merge: true });
      await refreshConfig();
      setSuccessMsg("Configuration enregistrée avec succès !");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Erreur lors de la sauvegarde de la config hébergement:", err);
    }
  }

  // Gestion des catégories
  function handleAddCategory() {
    const trimmed = newCatInput.trim();
    if (!trimmed) return;
    if (!categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...categories, trimmed];
      setCategories(updated);
      saveConfigToFirestore(updated, packs);
    }
    setNewCatInput("");
    setOpenCatModal(false);
  }

  function handleRemoveCategory(catToRemove: string) {
    if (categories.length <= 1) {
      alert("Vous devez conserver au moins une catégorie.");
      return;
    }
    const updated = categories.filter((c) => c !== catToRemove);
    setCategories(updated);
    saveConfigToFirestore(updated, packs);
  }

  // Gestion des chambres
  function updateByIndex(idx: number, key: keyof (typeof rows)[number], value: any) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }

  function addRow() {
    setRows((rs) => [
      ...rs,
      { tempId: `temp_${Date.now()}_${Math.random()}`, numero: "", categorie: categories[0] || "standard", capacite: 2, tarif: 0, isNew: true },
    ]);
  }

  function removeRow(idx: number) {
    const r = rows[idx];
    if (r.id) {
      deleteChambre.mutate({ id: r.id });
    }
    setRows((rs) => rs.filter((_, i) => i !== idx));
  }

  async function handleValidateRooms() {
    for (let index = 0; index < rows.length; index++) {
      const r = rows[index];
      if (r.isNew) {
        if (!r.numero || !r.categorie) continue;
        await createChambre.mutateAsync({
          numero: r.numero,
          categorie: r.categorie,
          capacite: r.capacite,
          tarif_base: r.tarif,
          statut: "libre",
          ordre: index,
        });
      } else if (r.id) {
        await updateChambre.mutateAsync({
          id: r.id,
          numero: r.numero,
          categorie: r.categorie,
          capacite: r.capacite,
          tarif_base: r.tarif,
          ordre: index,
        });
      }
    }
    setSuccessMsg("Tarifs des chambres enregistrés avec succès !");
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRows((items) => {
        const oldIndex = items.findIndex((i) => (i.id || i.tempId) === active.id);
        const newIndex = items.findIndex((i) => (i.id || i.tempId) === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  // Gestion des packs
  function openAddPack() {
    setEditingPack(null);
    setPackForm({
      nom: "",
      description: "",
      typeCalcul: "par_personne_nuit",
      prix: 0,
    });
    setPackModalOpen(true);
  }

  function openEditPack(pack: HebergementPack) {
    setEditingPack(pack);
    setPackForm({
      id: pack.id,
      nom: pack.nom,
      description: pack.description || "",
      typeCalcul: pack.typeCalcul,
      prix: pack.prix,
    });
    setPackModalOpen(true);
  }

  function handleSavePack() {
    if (!packForm.nom.trim()) return;

    let updatedPacks: HebergementPack[];
    if (editingPack) {
      updatedPacks = packs.map((p) =>
        p.id === editingPack.id
          ? {
              ...p,
              nom: packForm.nom.trim(),
              description: packForm.description.trim(),
              typeCalcul: packForm.typeCalcul,
              prix: Number(packForm.prix) || 0,
            }
          : p
      );
    } else {
      const newPack: HebergementPack = {
        id: `pack_${Date.now()}`,
        nom: packForm.nom.trim(),
        description: packForm.description.trim(),
        typeCalcul: packForm.typeCalcul,
        prix: Number(packForm.prix) || 0,
      };
      updatedPacks = [...packs, newPack];
    }

    setPacks(updatedPacks);
    saveConfigToFirestore(categories, updatedPacks);
    setPackModalOpen(false);
  }

  function handleDeletePack(packId: string) {
    if (packs.length <= 1) {
      alert("Vous devez conserver au moins une formule.");
      return;
    }
    const updated = packs.filter((p) => p.id !== packId);
    setPacks(updated);
    saveConfigToFirestore(categories, updated);
  }

  // Gestion des taxes de séjour
  async function saveTaxesToFirestore(newTaxesList?: HebergementTaxe[]) {
    if (!tenantId || !isDirectionOrAdmin) return;
    try {
      const toSave = newTaxesList || taxes;
      const ref = doc(db, `tenants/${tenantId}/config/main`);
      await setDoc(ref, { hebergementTaxes: toSave }, { merge: true });
      await refreshConfig();
      setSuccessMsg("Taxes & vignettes de séjour enregistrées avec succès !");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Erreur lors de la sauvegarde des taxes hébergement:", err);
    }
  }

  function handleToggleTaxActif(taxId: string, actif: boolean) {
    if (!isDirectionOrAdmin) return;
    const updated = taxes.map((t) => (t.id === taxId ? { ...t, actif } : t));
    setTaxes(updated);
    saveTaxesToFirestore(updated);
  }

  function openAddTax() {
    if (!isDirectionOrAdmin) return;
    setEditingTax(null);
    setTaxForm({
      nom: "",
      description: "",
      typeCalcul: "par_nuitee",
      montant: 0,
      actif: true,
    });
    setTaxModalOpen(true);
  }

  function openEditTax(tax: HebergementTaxe) {
    if (!isDirectionOrAdmin) return;
    setEditingTax(tax);
    setTaxForm({
      nom: tax.nom,
      description: tax.description || "",
      typeCalcul: tax.typeCalcul,
      montant: tax.montant,
      actif: tax.actif,
    });
    setTaxModalOpen(true);
  }

  function handleSaveTax() {
    if (!isDirectionOrAdmin || !taxForm.nom.trim()) return;
    let updated: HebergementTaxe[];
    if (editingTax) {
      updated = taxes.map((t) =>
        t.id === editingTax.id
          ? {
              ...t,
              nom: taxForm.nom.trim(),
              description: taxForm.description.trim(),
              typeCalcul: taxForm.typeCalcul,
              montant: taxForm.montant,
              actif: taxForm.actif,
            }
          : t
      );
    } else {
      const newTax: HebergementTaxe = {
        id: `taxe_${Date.now()}`,
        nom: taxForm.nom.trim(),
        description: taxForm.description.trim(),
        typeCalcul: taxForm.typeCalcul,
        montant: taxForm.montant,
        actif: taxForm.actif,
      };
      updated = [...taxes, newTax];
    }
    setTaxes(updated);
    saveTaxesToFirestore(updated);
    setTaxModalOpen(false);
  }

  function handleDeleteTax(taxId: string) {
    if (!isDirectionOrAdmin) return;
    if (confirm("Confirmez-vous la suppression de cette taxe ?")) {
      const updated = taxes.filter((t) => t.id !== taxId);
      setTaxes(updated);
      saveTaxesToFirestore(updated);
    }
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", pb: 6 }}>
      {/* HEADER */}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} mb={3} gap={2}>
        <Box>
          <Typography variant="h4" fontWeight={900} color="#0f172a" letterSpacing="-0.5px">
            Hébergement — Tarifs & Formules
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Configurez vos catégories de chambres, la grille tarifaire et vos formules de séjour personnalisées.
          </Typography>
        </Box>
      </Stack>

      {successMsg && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3, borderRadius: 2 }}>
          {successMsg}
        </Alert>
      )}

      {/* NAVIGATION TABS */}
      <Paper sx={{ mb: 3, borderRadius: 2, border: "1px solid #e2e8f0" }} elevation={0}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 2,
            "& .MuiTab-root": {
              fontWeight: 700,
              fontSize: "0.95rem",
              py: 2,
              textTransform: "none",
            },
          }}
        >
          <Tab icon={<BedIcon />} iconPosition="start" label="Chambres & Tarifs de Base" />
          <Tab icon={<CardGiftcardIcon />} iconPosition="start" label="Formules & Packs de Séjour" />
          <Tab icon={<RestaurantIcon />} iconPosition="start" label="Gestion des Catégories" />
          <Tab icon={<AccountBalanceIcon />} iconPosition="start" label="Taxes & Vignettes de Séjour" />
        </Tabs>
      </Paper>

      {/* TAB 0: CHAMBRES & TARIFS DE BASE */}
      {tabValue === 0 && (
        <Paper sx={{ p: 3, borderRadius: 2, border: "1px solid #e2e8f0" }} elevation={0}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} mb={2} gap={1}>
            <Box>
              <Typography variant="h6" fontWeight={800} color="#0f172a">
                Grille des Chambres & Tarifs
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Définissez les chambres, leur catégorie associée, leur capacité et leur prix de base par nuitée.
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addRow}
              sx={{ borderRadius: 1.5, fontWeight: 700 }}
            >
              Ajouter une chambre
            </Button>
          </Stack>

          {/* TABLE HEADER */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "30px 80px 1fr 90px 140px 90px", md: "40px 140px 1fr 120px 180px 100px" },
              gap: 1.5,
              px: 2,
              py: 1.2,
              bgcolor: "#f8fafc",
              borderRadius: 1.5,
              border: "1px solid #e2e8f0",
              color: "#475569",
              fontWeight: 800,
              fontSize: "0.82rem",
              mb: 1,
            }}
          >
            <Box></Box>
            <Box>N° Chambre</Box>
            <Box>Catégorie</Box>
            <Box>Capacité</Box>
            <Box>Tarif Base (Ar)</Box>
            <Box sx={{ textAlign: "right" }}>Actions</Box>
          </Box>

          {/* ROWS */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rows.map(r => r.id || r.tempId || '')} strategy={verticalListSortingStrategy}>
              <Stack spacing={1}>
                {rows.map((r, idx) => (
                  <SortableRow
                    key={r.id || r.tempId}
                    row={r}
                    idx={idx}
                    categories={categories}
                    updateByIndex={updateByIndex}
                    removeRow={removeRow}
                  />
                ))}
              </Stack>
            </SortableContext>
          </DndContext>

          {rows.length === 0 && (
            <Box textAlign="center" py={5} color="text.secondary">
              <Typography>Aucune chambre enregistrée pour le moment.</Typography>
            </Box>
          )}

          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3, pt: 2, borderTop: "1px solid #e2e8f0" }}>
            <Button variant="contained" onClick={handleValidateRooms} sx={{ px: 3, fontWeight: 800, borderRadius: 1.5 }}>
              Enregistrer les Tarifs
            </Button>
          </Stack>
        </Paper>
      )}

      {/* TAB 1: FORMULES & PACKS DE SÉJOUR */}
      {tabValue === 1 && (
        <Paper sx={{ p: 3, borderRadius: 2, border: "1px solid #e2e8f0" }} elevation={0}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} mb={3} gap={1}>
            <Box>
              <Typography variant="h6" fontWeight={800} color="#0f172a">
                Formules & Packs de Séjour
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Ces formules (B&B, demi-pension, packs forfaitaires) s'affichent lors de la réservation et se ventilent automatiquement sur la facture client.
              </Typography>
            </Box>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openAddPack}
              sx={{ borderRadius: 1.5, fontWeight: 700 }}
            >
              + Nouveau Pack / Formule
            </Button>
          </Stack>

          <Grid container spacing={2}>
            {packs.map((pack) => {
              const typeLabel =
                pack.typeCalcul === "par_personne_nuit"
                  ? "Par personne / par nuit"
                  : pack.typeCalcul === "par_chambre_nuit"
                  ? "Par chambre / par nuit"
                  : "Forfait fixe séjour";

              const typeColor =
                pack.typeCalcul === "par_personne_nuit"
                  ? { bg: "#e0f2fe", text: "#0369a1" }
                  : pack.typeCalcul === "par_chambre_nuit"
                  ? { bg: "#fef3c7", text: "#92400e" }
                  : { bg: "#ede9fe", text: "#6d28d9" };

              return (
                <Grid item xs={12} md={6} key={pack.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: "100%",
                      borderRadius: 2,
                      borderColor: "#e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      transition: "all 0.2s ease",
                      "&:hover": { borderColor: "#94a3b8", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" },
                    }}
                  >
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                        <Typography variant="subtitle1" fontWeight={800} color="#0f172a">
                          {pack.nom}
                        </Typography>
                        <Chip
                          size="small"
                          label={typeLabel}
                          sx={{
                            fontWeight: 700,
                            fontSize: "0.72rem",
                            bgcolor: typeColor.bg,
                            color: typeColor.text,
                            borderRadius: 1,
                          }}
                        />
                      </Stack>

                      <Typography variant="body2" color="text.secondary" minHeight={40} mb={2}>
                        {pack.description || "Aucune description renseignée."}
                      </Typography>

                      <Box sx={{ bgcolor: "#f8fafc", p: 1.5, borderRadius: 1.5, border: "1px solid #f1f5f9" }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Tarif appliqué
                        </Typography>
                        <Typography variant="h6" fontWeight={900} color="#0f172a">
                          {pack.prix > 0 ? `${pack.prix.toLocaleString("fr-FR")} Ar` : "Inclus / Gratuit"}
                          <Typography component="span" variant="caption" color="text.secondary" ml={1}>
                            {pack.typeCalcul === "par_personne_nuit"
                              ? "/ pers. / nuit"
                              : pack.typeCalcul === "par_chambre_nuit"
                              ? "/ chambre / nuit"
                              : "forfait"}
                          </Typography>
                        </Typography>
                      </Box>
                    </CardContent>

                    <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ p: 1.5, pt: 0 }}>
                      <Button size="small" variant="text" startIcon={<EditIcon />} onClick={() => openEditPack(pack)}>
                        Modifier
                      </Button>
                      <IconButton size="small" color="error" onClick={() => handleDeletePack(pack.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Paper>
      )}

      {/* TAB 2: GESTION DES CATÉGORIES */}
      {tabValue === 2 && (
        <Paper sx={{ p: 3, borderRadius: 2, border: "1px solid #e2e8f0" }} elevation={0}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} mb={2} gap={1}>
            <Box>
              <Typography variant="h6" fontWeight={800} color="#0f172a">
                Catégories de Chambres de l'Établissement
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Personnalisez les types de chambres adaptés à votre structure (Bungalow, Suite, Familiale, Villa, etc.).
              </Typography>
            </Box>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenCatModal(true)}
              sx={{ borderRadius: 1.5, fontWeight: 700 }}
            >
              + Nouvelle Catégorie
            </Button>
          </Stack>

          <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRadius: 2, border: "1px solid #e2e8f0", mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={800} color="#334155" mb={1.5}>
              Catégories actives ({categories.length}) :
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1.2}>
              {categories.map((cat) => {
                const countRooms = (rooms || []).filter((r) => r.categorie === cat).length;
                return (
                  <Chip
                    key={cat}
                    label={`${cat} (${countRooms} chambre${countRooms > 1 ? "s" : ""})`}
                    onDelete={() => handleRemoveCategory(cat)}
                    sx={{
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      py: 2,
                      px: 1,
                      bgcolor: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 2,
                      "& .MuiChip-deleteIcon": { color: "#94a3b8", "&:hover": { color: "#ef4444" } },
                    }}
                  />
                );
              })}
            </Stack>
          </Box>
        </Paper>
      )}

      {/* TAB 3: TAXES & VIGNETTES DE SÉJOUR */}
      {tabValue === 3 && (
        <Paper sx={{ p: 3, borderRadius: 2, border: "1px solid #e2e8f0" }} elevation={0}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} mb={2} gap={1}>
            <Box>
              <Typography variant="h6" fontWeight={800} color="#0f172a">
                Taxes de Séjour & Vignettes Touristiques
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Configurez les taxes appliquées automatiquement sur les factures d'hébergement (taxe communale fixe, vignette touristique par nuitée, etc.).
              </Typography>
            </Box>
            {isDirectionOrAdmin && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openAddTax}
                sx={{ fontWeight: 800, textTransform: "none", bgcolor: "#4f46e5", "&:hover": { bgcolor: "#4338ca" } }}
              >
                Ajouter une taxe
              </Button>
            )}
          </Stack>

          {!isDirectionOrAdmin && (
            <Alert severity="info" icon={<LockIcon />} sx={{ mb: 3, borderRadius: 2 }}>
              <strong>Accès sécurisé :</strong> Seule la Direction Générale et les Administrateurs sont autorisés à modifier les libellés, tarifs et modes de calcul des taxes de séjour. Vous pouvez consulter les paramètres actifs ci-dessous.
            </Alert>
          )}

          <Grid container spacing={2}>
            {taxes.map((taxe) => (
              <Grid item xs={12} sm={6} md={6} key={taxe.id}>
                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    borderColor: taxe.actif ? "#c7d2fe" : "#e2e8f0",
                    bgcolor: taxe.actif ? "#ffffff" : "#f8fafc",
                    transition: "all 0.2s ease-in-out",
                    opacity: taxe.actif ? 1 : 0.7,
                  }}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle1" fontWeight={800} color="#1e293b">
                            {taxe.nom}
                          </Typography>
                          <Chip
                            size="small"
                            label={taxe.actif ? "Active" : "Inactive"}
                            color={taxe.actif ? "success" : "default"}
                            sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700 }}
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                          {taxe.description || (taxe.typeCalcul === "fixe" ? "Taxe forfaitaire par séjour" : "Calculée au prorata des nuitées")}
                        </Typography>
                      </Box>
                      {isDirectionOrAdmin && (
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={taxe.actif}
                              onChange={(e) => handleToggleTaxActif(taxe.id, e.target.checked)}
                            />
                          }
                          label={<Typography variant="caption" fontWeight={600}>{taxe.actif ? "Activée" : "Désactivée"}</Typography>}
                          sx={{ m: 0 }}
                        />
                      )}
                    </Stack>

                    <Box sx={{ my: 1.5, p: 1.5, bgcolor: taxe.actif ? "#eef2ff" : "#f1f5f9", borderRadius: 1.5, border: "1px solid", borderColor: taxe.actif ? "#e0e7ff" : "#e2e8f0" }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            Mode de calcul :
                          </Typography>
                          <Typography variant="body2" fontWeight={700} color="#334155">
                            {taxe.typeCalcul === "fixe"
                              ? "Montant fixe par séjour"
                              : taxe.typeCalcul === "par_nuitee"
                              ? "Par nuitée de séjour"
                              : taxe.typeCalcul === "par_chambre_nuitee"
                              ? "Par chambre × nuitée"
                              : "Par personne × nuitée"}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right" }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            Tarif :
                          </Typography>
                          <Typography variant="h6" fontWeight={900} color="#4f46e5">
                            {taxe.montant.toLocaleString("fr-FR")} Ar
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>

                    {isDirectionOrAdmin && (
                      <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<EditIcon />}
                          onClick={() => openEditTax(taxe)}
                          sx={{ textTransform: "none", fontWeight: 700 }}
                        >
                          Modifier
                        </Button>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteTax(taxe.id)}
                          sx={{ border: "1px solid #fee2e2", "&:hover": { bgcolor: "#fef2f2" } }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* MODAL AJOUT CATÉGORIE */}
      <Dialog open={openCatModal} onClose={() => setOpenCatModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Ajouter une Catégorie de Chambre</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Nom de la catégorie"
            placeholder="Ex: Bungalow VIP, Suite Océan, Dortoir..."
            value={newCatInput}
            onChange={(e) => setNewCatInput(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenCatModal(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleAddCategory} disabled={!newCatInput.trim()} sx={{ fontWeight: 700 }}>
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL CONFIGURATION PACK / FORMULE */}
      <Dialog open={packModalOpen} onClose={() => setPackModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {editingPack ? "Modifier la Formule / Pack" : "Créer une Formule / Pack de Séjour"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Nom de la formule"
              fullWidth
              required
              placeholder="Ex: Formule Petit-Déjeuner, Pack Romantique, Demi-Pension..."
              value={packForm.nom}
              onChange={(e) => setPackForm({ ...packForm, nom: e.target.value })}
            />

            <Select
              label="Mode de facturation"
              fullWidth
              value={packForm.typeCalcul}
              onChange={(e) => setPackForm({ ...packForm, typeCalcul: e.target.value as any })}
            >
              <MenuItem value="par_personne_nuit">Par personne / par nuit (ex: Petit-déj, Demi-pension)</MenuItem>
              <MenuItem value="par_chambre_nuit">Par chambre / par nuit (ex: Climatisation, Vue mer)</MenuItem>
              <MenuItem value="forfait_fixe">Forfait fixe séjour (ex: Pack Romance, Excursion incluse)</MenuItem>
            </Select>

            <TextField
              label="Tarif de la formule"
              fullWidth
              type="number"
              value={packForm.prix}
              onChange={(e) => setPackForm({ ...packForm, prix: Math.max(0, parseInt(e.target.value || "0", 10)) })}
              InputProps={{
                endAdornment: <InputAdornment position="end">Ar</InputAdornment>,
              }}
              helperText={
                packForm.typeCalcul === "par_personne_nuit"
                  ? "Montant facturé par personne pour chaque nuitée."
                  : packForm.typeCalcul === "par_chambre_nuit"
                  ? "Montant facturé par nuitée pour la chambre."
                  : "Montant forfaitaire unique pour l'ensemble du séjour."
              }
            />

            <TextField
              label="Description / Prestations incluses"
              fullWidth
              multiline
              rows={3}
              placeholder="Ex: Comprend le buffet petit-déjeuner chaque matin, jus frais, café et viennoiseries..."
              value={packForm.description}
              onChange={(e) => setPackForm({ ...packForm, description: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPackModalOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSavePack} disabled={!packForm.nom.trim()} sx={{ fontWeight: 800 }}>
            {editingPack ? "Enregistrer les modifications" : "Créer le Pack"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL CONFIGURATION TAXE / VIGNETTE */}
      <Dialog open={taxModalOpen} onClose={() => setTaxModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {editingTax ? "Modifier la Taxe / Vignette" : "Ajouter une Taxe ou Vignette de Séjour"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Nom de la taxe / vignette"
              fullWidth
              required
              placeholder="Ex: Taxe Communale, Vignette Touristique, Éco-Taxe..."
              value={taxForm.nom}
              onChange={(e) => setTaxForm({ ...taxForm, nom: e.target.value })}
            />

            <Select
              label="Mode d'application"
              fullWidth
              value={taxForm.typeCalcul}
              onChange={(e) => setTaxForm({ ...taxForm, typeCalcul: e.target.value as any })}
            >
              <MenuItem value="fixe">Montant fixe forfaitaire (par séjour)</MenuItem>
              <MenuItem value="par_nuitee">Par nuitée de séjour (ex: 5 000 Ar × nombre de nuits)</MenuItem>
              <MenuItem value="par_chambre_nuitee">Par chambre × nuitée</MenuItem>
              <MenuItem value="par_personne_nuitee">Par personne × nuitée</MenuItem>
            </Select>

            <TextField
              label="Tarif en Ariary (Ar)"
              fullWidth
              required
              type="number"
              value={taxForm.montant}
              onChange={(e) => setTaxForm({ ...taxForm, montant: Math.max(0, parseInt(e.target.value || "0", 10)) })}
              InputProps={{
                endAdornment: <InputAdornment position="end">Ar</InputAdornment>,
              }}
              helperText={
                taxForm.typeCalcul === "fixe"
                  ? "Montant unique appliqué une seule fois sur la facture."
                  : "Montant multiplié par le nombre d'unités de séjour."
              }
            />

            <TextField
              label="Description (Optionnelle)"
              fullWidth
              multiline
              rows={2}
              placeholder="Ex: Reversée à la commune urbaine pour chaque séjour..."
              value={taxForm.description}
              onChange={(e) => setTaxForm({ ...taxForm, description: e.target.value })}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={taxForm.actif}
                  onChange={(e) => setTaxForm({ ...taxForm, actif: e.target.checked })}
                />
              }
              label={
                <Typography variant="body2" fontWeight={700}>
                  {taxForm.actif ? "Taxe active (appliquée automatiquement)" : "Taxe inactive"}
                </Typography>
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTaxModalOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleSaveTax}
            disabled={!taxForm.nom.trim()}
            sx={{ fontWeight: 800, bgcolor: "#4f46e5", "&:hover": { bgcolor: "#4338ca" } }}
          >
            {editingTax ? "Enregistrer" : "Ajouter la Taxe"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
