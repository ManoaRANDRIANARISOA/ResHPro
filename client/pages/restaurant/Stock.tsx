import {
  Add,
  Check,
  Close,
  Delete,
  Edit,
  ErrorOutline,
  WarningAmber,
  TrendingUp,
  Inventory,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { SousCategorieStock, UniteStock } from "@shared/api";
import {
  useCreateStockProduit,
  useDeleteStockProduit,
  useStockProduits,
  useUpdateStockProduit,
} from "@/services/api";

function statusChip(stock: number, seuil: number) {
  if (stock === 0) return <Chip size="small" color="error" label="Rupture" />;
  if (stock <= seuil)
    return <Chip size="small" color="warning" label="Faible" />;
  return <Chip size="small" color="success" label="En stock" />;
}

// Prédiction IA basique - simule une prédiction
function predictNextOrder(stock: number, seuil: number, nom: string) {
  if (stock === 0) {
    return { priority: "haute", quantity: seuil * 2, days: 0 };
  }
  if (stock <= seuil) {
    return { priority: "moyenne", quantity: seuil - stock + 10, days: 2 };
  }
  // Basé sur une consommation estimée
  const daysLeft = Math.floor((stock / seuil) * 7);
  return { priority: "basse", quantity: seuil, days: daysLeft };
}

function AlertsBar({
  items,
}: {
  items: { id: string; nom: string; stock: number; seuilMin: number; unite: UniteStock }[];
}) {
  const critiques = items.filter((r) => r.stock === 0);
  const faibles = items.filter((r) => r.stock > 0 && r.stock <= r.seuilMin);
  
  // Prédictions pour les 3 produits les plus critiques
  const predictions = [...critiques, ...faibles]
    .slice(0, 3)
    .map((item) => ({
      ...item,
      prediction: predictNextOrder(item.stock, item.seuilMin, item.nom),
    }));

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Card sx={{ bgcolor: "warning.50", border: "1px solid", borderColor: "warning.200", height: 280 }}>
          <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <WarningAmber sx={{ color: "#f0b429" }} />
              <Typography fontWeight={700}>Alertes faibles</Typography>
              <Chip size="small" label={faibles.length} />
            </Stack>
            <Box sx={{ flex: 1, overflowY: "auto", pr: 1 }}>
              <Stack spacing={0.5}>
                {faibles.map((a) => (
                <Stack
                  key={a.id}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ color: "text.secondary" }}
                >
                  <Typography flex={1} fontSize="0.875rem">{a.nom}</Typography>
                  <Chip
                    size="small"
                    color="warning"
                    label={`${a.stock} ${a.unite}`}
                  />
                </Stack>
                ))}
                {faibles.length === 0 && (
                  <Typography color="text.secondary">Aucune alerte</Typography>
                )}
              </Stack>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card sx={{ bgcolor: "error.50", border: "1px solid", borderColor: "error.200", height: 280 }}>
          <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <ErrorOutline color="error" />
              <Typography fontWeight={700}>Ruptures de stock</Typography>
              <Chip size="small" label={critiques.length} />
            </Stack>
            <Box sx={{ flex: 1, overflowY: "auto", pr: 1 }}>
              <Stack spacing={0.5}>
                {critiques.map((a) => (
                <Stack
                  key={a.id}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ color: "text.secondary" }}
                >
                  <Typography flex={1} fontSize="0.875rem">{a.nom}</Typography>
                  <Chip size="small" color="error" label="0" />
                </Stack>
                ))}
                {critiques.length === 0 && (
                  <Typography color="text.secondary">Aucune rupture</Typography>
                )}
              </Stack>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card sx={{ bgcolor: "info.50", border: "1px solid", borderColor: "info.200", height: 280 }}>
          <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <TrendingUp color="info" />
              <Typography fontWeight={700}>Prédiction IA</Typography>
              <Chip size="small" label="Beta" color="info" />
            </Stack>
            <Box sx={{ flex: 1, overflowY: "auto", pr: 1 }}>
              <Stack spacing={0.5}>
              {predictions.map((p) => (
                <Stack
                  key={p.id}
                  spacing={0.5}
                  sx={{ 
                    py: 0.5, 
                    px: 1, 
                    bgcolor: "background.paper", 
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider"
                  }}
                >
                  <Typography fontSize="0.75rem" fontWeight={600}>
                    {p.nom}
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Chip 
                      size="small" 
                      label={p.prediction.priority} 
                      color={
                        p.prediction.priority === "haute" 
                          ? "error" 
                          : p.prediction.priority === "moyenne" 
                          ? "warning" 
                          : "default"
                      }
                      sx={{ fontSize: "0.65rem" }}
                    />
                    <Typography fontSize="0.7rem" color="text.secondary">
                      Commander {p.prediction.quantity} {p.unite} dans {p.prediction.days}j
                    </Typography>
                  </Stack>
                </Stack>
                ))}
                {predictions.length === 0 && (
                  <Typography color="text.secondary">Stock optimal</Typography>
                )}
              </Stack>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

const sousCategorieLabels: Record<SousCategorieStock, string> = {
  cuisine: "Cuisine",
  petit_dejeuner: "Petit déjeuner",
  linge_lit: "Linge de lit",
  linge_salle: "Linge de salle",
  entretien: "Produits",
};

export default function RestoStock() {
  const { data: all } = useStockProduits();
  const create = useCreateStockProduit();
  const update = useUpdateStockProduit();
  const remove = useDeleteStockProduit();

  const [q, setQ] = useState("");
  const [view, setView] = useState<"all" | "low" | "zero">("all");
  const [catFilter, setCatFilter] = useState<SousCategorieStock | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Tous les produits restaurant
  const restoRows = useMemo(
    () => (all || []).filter((p) => p.famille === "Restaurant"),
    [all],
  );

  // Filtrage
  const filtered = restoRows
    .filter((r) => r.nom.toLowerCase().includes(q.toLowerCase()))
    .filter((r) =>
      view === "all"
        ? true
        : view === "low"
          ? r.stock <= r.seuilMin && r.stock > 0
          : r.stock === 0,
    )
    .filter((r) => catFilter === "all" || r.sousCategorie === catFilter);

  const alerts = restoRows.filter((r) => r.stock <= r.seuilMin);

  const [draft, setDraft] = useState({
    nom: "",
    unite: "kg" as UniteStock,
    seuilMin: 0,
    stock: 0,
    prixUnitaire: 0,
    sousCategorie: "cuisine" as SousCategorieStock,
  });
  
  const [editDraft, setEditDraft] = useState<{
    nom: string;
    unite: UniteStock;
    seuilMin: number;
    stock: number;
    prixUnitaire: number;
    sousCategorie: SousCategorieStock;
  } | null>(null);

  function startEdit(id: string) {
    const it = restoRows.find((r) => r.id === id);
    if (!it) return;
    setEditingId(id);
    setEditDraft({
      nom: it.nom,
      unite: it.unite,
      seuilMin: it.seuilMin,
      stock: it.stock,
      prixUnitaire: it.prixUnitaire || 0,
      sousCategorie: it.sousCategorie,
    });
  }

  function saveEdit() {
    if (!editingId || !editDraft) return;
    update.mutate({ id: editingId, ...editDraft });
    setEditingId(null);
    setEditDraft(null);
  }

  function addNew() {
    if (!draft.nom) return;
    create.mutate({ ...draft, famille: "Restaurant" });
    setDraft({
      nom: "",
      unite: "kg",
      seuilMin: 0,
      stock: 0,
      prixUnitaire: 0,
      sousCategorie: "cuisine",
    });
    setAdding(false);
  }

  // Stats rapides
  const totalProducts = restoRows.length;
  const lowStock = restoRows.filter(r => r.stock <= r.seuilMin && r.stock > 0).length;
  const outOfStock = restoRows.filter(r => r.stock === 0).length;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h4" fontWeight={800}>
          Gestion du Stock — Restaurant
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip 
            icon={<Inventory />} 
            label={`${totalProducts} produits`} 
            variant="outlined" 
          />
          <Chip 
            label={`${lowStock} faibles`} 
            color="warning"
            variant={lowStock > 0 ? "filled" : "outlined"}
          />
          <Chip 
            label={`${outOfStock} ruptures`} 
            color="error"
            variant={outOfStock > 0 ? "filled" : "outlined"}
          />
        </Stack>
      </Stack>

      <Stack spacing={2}>
        {/* Barre d'alertes et prédictions */}
        <AlertsBar
          items={restoRows.map(({ id, nom, stock, seuilMin, unite }) => ({
            id,
            nom,
            stock,
            seuilMin,
            unite,
          }))}
        />

        {/* Liste unifiée */}
        <Paper sx={{ p: 2 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 2 }}
          >
            <Typography fontWeight={800} variant="h6">
              Stock Cuisine & Produits
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {/* Filtres de vue */}
              <Chip
                size="small"
                label="Tous"
                color={view === "all" ? "primary" : "default"}
                variant={view === "all" ? "filled" : "outlined"}
                onClick={() => setView("all")}
              />
              <Chip
                size="small"
                label="Stock bas"
                color={view === "low" ? "primary" : "default"}
                variant={view === "low" ? "filled" : "outlined"}
                onClick={() => setView("low")}
              />
              <Chip
                size="small"
                label="Rupture"
                color={view === "zero" ? "primary" : "default"}
                variant={view === "zero" ? "filled" : "outlined"}
                onClick={() => setView("zero")}
              />
              
              {/* Filtre par catégorie */}
              <Select
                size="small"
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value as any)}
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="all">Toutes catégories</MenuItem>
                <MenuItem value="cuisine">Cuisine</MenuItem>
                <MenuItem value="entretien">Produits</MenuItem>
              </Select>

              <TextField
                size="small"
                placeholder="Rechercher..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                sx={{ minWidth: 200 }}
              />
              <Button
                startIcon={<Add />}
                variant="contained"
                onClick={() => setAdding(true)}
              >
                Nouveau produit
              </Button>
            </Stack>
          </Stack>

          {/* En-tête du tableau */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 140px 80px 80px 100px 100px 120px",
              px: 1,
              py: 1,
              color: "text.secondary",
              fontWeight: 700,
              fontSize: "0.875rem",
            }}
          >
            <Box>Produit</Box>
            <Box>Catégorie</Box>
            <Box>Unité</Box>
            <Box>Prix U.</Box>
            <Box>Seuil min</Box>
            <Box>Stock</Box>
            <Box>Actions</Box>
          </Box>

          {/* Ligne d'ajout */}
          {adding && (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 140px 80px 80px 100px 100px 120px",
                px: 1,
                py: 1,
                borderTop: "1px solid",
                borderColor: "divider",
                alignItems: "center",
                gap: 1,
              }}
            >
              <TextField
                size="small"
                placeholder="Nom du produit"
                value={draft.nom}
                onChange={(e) => setDraft((d) => ({ ...d, nom: e.target.value }))}
              />
              <Select
                size="small"
                value={draft.sousCategorie}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    sousCategorie: e.target.value as SousCategorieStock,
                  }))
                }
              >
                <MenuItem value="cuisine">Cuisine</MenuItem>
                <MenuItem value="entretien">Produits</MenuItem>
              </Select>
              <Select
                size="small"
                value={draft.unite}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, unite: e.target.value as UniteStock }))
                }
              >
                <MenuItem value="kg">kg</MenuItem>
                <MenuItem value="L">L</MenuItem>
                <MenuItem value="u">u</MenuItem>
                <MenuItem value="paquet">paquet</MenuItem>
              </Select>
              <TextField
                size="small"
                type="number"
                placeholder="Prix"
                value={draft.prixUnitaire}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    prixUnitaire: parseFloat(e.target.value || "0"),
                  }))
                }
              />
              <TextField
                size="small"
                type="number"
                value={draft.seuilMin}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    seuilMin: parseFloat(e.target.value || "0"),
                  }))
                }
              />
              <TextField
                size="small"
                type="number"
                value={draft.stock}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    stock: parseFloat(e.target.value || "0"),
                  }))
                }
              />
              <Stack direction="row" spacing={1}>
                <IconButton color="success" onClick={addNew}>
                  <Check />
                </IconButton>
                <IconButton color="inherit" onClick={() => setAdding(false)}>
                  <Close />
                </IconButton>
              </Stack>
            </Box>
          )}

          {/* Lignes de produits */}
          {filtered.map((r) => (
            <Box
              key={r.id}
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 140px 80px 80px 100px 100px 120px",
                px: 1,
                py: 1,
                borderTop: "1px solid",
                borderColor: "divider",
                alignItems: "center",
                gap: 1,
              }}
            >
              {editingId === r.id ? (
                <>
                  <TextField
                    size="small"
                    value={editDraft?.nom ?? ""}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...(d as any), nom: e.target.value }))
                    }
                  />
                  <Select
                    size="small"
                    value={editDraft?.sousCategorie ?? r.sousCategorie}
                    onChange={(e) =>
                      setEditDraft((d) => ({
                        ...(d as any),
                        sousCategorie: e.target.value as SousCategorieStock,
                      }))
                    }
                  >
                    <MenuItem value="cuisine">Cuisine</MenuItem>
                    <MenuItem value="entretien">Produits</MenuItem>
                  </Select>
                  <Select
                    size="small"
                    value={editDraft?.unite ?? r.unite}
                    onChange={(e) =>
                      setEditDraft((d) => ({
                        ...(d as any),
                        unite: e.target.value as UniteStock,
                      }))
                    }
                  >
                    <MenuItem value="kg">kg</MenuItem>
                    <MenuItem value="L">L</MenuItem>
                    <MenuItem value="u">u</MenuItem>
                    <MenuItem value="paquet">paquet</MenuItem>
                  </Select>
                  <TextField
                    size="small"
                    type="number"
                    value={editDraft?.prixUnitaire ?? 0}
                    onChange={(e) =>
                      setEditDraft((d) => ({
                        ...(d as any),
                        prixUnitaire: parseFloat(e.target.value || "0"),
                      }))
                    }
                  />
                  <TextField
                    size="small"
                    type="number"
                    value={editDraft?.seuilMin ?? 0}
                    onChange={(e) =>
                      setEditDraft((d) => ({
                        ...(d as any),
                        seuilMin: parseFloat(e.target.value || "0"),
                      }))
                    }
                  />
                  <TextField
                    size="small"
                    type="number"
                    value={editDraft?.stock ?? 0}
                    onChange={(e) =>
                      setEditDraft((d) => ({
                        ...(d as any),
                        stock: parseFloat(e.target.value || "0"),
                      }))
                    }
                  />
                  <Stack direction="row" spacing={1}>
                    <IconButton color="success" onClick={saveEdit}>
                      <Check />
                    </IconButton>
                    <IconButton
                      color="inherit"
                      onClick={() => {
                        setEditingId(null);
                        setEditDraft(null);
                      }}
                    >
                      <Close />
                    </IconButton>
                  </Stack>
                </>
              ) : (
                <>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {statusChip(r.stock, r.seuilMin)}
                    <Typography fontWeight={600}>{r.nom}</Typography>
                  </Box>
                  <Box>
                    <Chip 
                      size="small" 
                      label={sousCategorieLabels[r.sousCategorie]} 
                      variant="outlined"
                    />
                  </Box>
                  <Box>{r.unite}</Box>
                  <Box>{(r.prixUnitaire || 0).toLocaleString()} Ar</Box>
                  <Box>{r.seuilMin}</Box>
                  <Box>
                    <Typography 
                      fontWeight={700}
                      color={r.stock === 0 ? "error.main" : r.stock <= r.seuilMin ? "warning.main" : "success.main"}
                    >
                      {r.stock}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <IconButton size="small" onClick={() => startEdit(r.id)}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => remove.mutate({ id: r.id })}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Stack>
                </>
              )}
            </Box>
          ))}
          
          {filtered.length === 0 && (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography color="text.secondary">
                Aucun produit trouvé
              </Typography>
            </Box>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}
