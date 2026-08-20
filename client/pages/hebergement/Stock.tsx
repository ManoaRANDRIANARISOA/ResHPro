import {
  Add,
  Check,
  Close,
  Delete,
  Edit,
  ErrorOutline,
  WarningAmber,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
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

function AlertsBar({
  items,
}: {
  items: { id: string; nom: string; stock: number; seuilMin: number }[];
}) {
  const critiques = items.filter((r) => r.stock === 0);
  const faibles = items.filter((r) => r.stock > 0 && r.stock <= r.seuilMin);
  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
      <Paper sx={{ p: 2, flex: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <WarningAmber sx={{ color: "#f0b429" }} />
          <Typography fontWeight={700}>Alertes faibles</Typography>
          <Chip size="small" label={faibles.length} />
        </Stack>
        <Stack spacing={0.5}>
          {faibles.slice(0, 5).map((a) => (
            <Stack
              key={a.id}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ color: "text.secondary" }}
            >
              <Typography flex={1}>{a.nom}</Typography>
              <Chip
                size="small"
                color="warning"
                label={`Stock ${a.stock} / Seuil ${a.seuilMin}`}
              />
            </Stack>
          ))}
          {faibles.length === 0 && (
            <Typography color="text.secondary">Aucune alerte</Typography>
          )}
        </Stack>
      </Paper>
      <Paper sx={{ p: 2, flex: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <ErrorOutline color="error" />
          <Typography fontWeight={700}>Ruptures proches</Typography>
          <Chip size="small" label={critiques.length} />
        </Stack>
        <Stack spacing={0.5}>
          {critiques.slice(0, 5).map((a) => (
            <Stack
              key={a.id}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ color: "text.secondary" }}
            >
              <Typography flex={1}>{a.nom}</Typography>
              <Chip size="small" color="error" label={`Stock ${a.stock}`} />
            </Stack>
          ))}
          {critiques.length === 0 && (
            <Typography color="text.secondary">Aucune rupture</Typography>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

function Section({
  title,
  allowedSousCats,
  famille,
}: {
  title: string;
  allowedSousCats: SousCategorieStock[];
  famille: "Hebergement" | "Restaurant";
}) {
  const { data: all } = useStockProduits();
  const create = useCreateStockProduit();
  const update = useUpdateStockProduit();
  const remove = useDeleteStockProduit();

  const [q, setQ] = useState("");
  const [view, setView] = useState<"all" | "low" | "zero">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(
    () =>
      (all || [])
        .filter(
          (p) =>
            p.famille === famille && allowedSousCats.includes(p.sousCategorie),
        )
        .map((p) => ({
          ...p,
          stock: p.stock ?? (p as any).quantite ?? 0,
        })),
    [all, famille, allowedSousCats],
  );
  const alerts = rows.filter((r) => r.stock <= r.seuilMin);
  const filtered = rows
    .filter((r) => r.nom.toLowerCase().includes(q.toLowerCase()))
    .filter((r) =>
      view === "all"
        ? true
        : view === "low"
          ? r.stock <= r.seuilMin && r.stock > 0
          : r.stock === 0,
    );

  const [draft, setDraft] = useState({
    nom: "",
    unite: "u" as UniteStock,
    seuilMin: 0,
    stock: 0,
    sousCategorie: allowedSousCats[0] as SousCategorieStock,
  });
  const [editDraft, setEditDraft] = useState<{
    nom: string;
    unite: UniteStock;
    seuilMin: number;
    stock: number;
    sousCategorie: SousCategorieStock;
  } | null>(null);

  function startEdit(id: string) {
    const it = rows.find((r) => r.id === id);
    if (!it) return;
    setEditingId(id);
    setEditDraft({
      nom: it.nom,
      unite: it.unite,
      seuilMin: it.seuilMin,
      stock: it.stock,
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
    create.mutate({ ...draft, famille });
    setDraft({
      nom: "",
      unite: "u",
      seuilMin: 0,
      stock: 0,
      sousCategorie: allowedSousCats[0],
    });
    setAdding(false);
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Typography fontWeight={800}>{title}</Typography>
        <Stack direction="row" spacing={1}>
          <Chip
            size="small"
            label={`Alertes: ${alerts.length}`}
            color={alerts.length ? "warning" : "default"}
          />
          <Chip
            size="small"
            label="Tous"
            color={view === "all" ? "primary" : "default"}
            variant={view === "all" ? "filled" : "outlined"}
            onClick={() => setView("all")}
          />
          <Chip
            size="small"
            label="Bas"
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
          <TextField
            size="small"
            placeholder="Rechercher"
            value={q}
            onChange={(e) => setQ(e.target.value)}
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
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 160px 120px 120px 160px",
          px: 1,
          py: 1,
          color: "text.secondary",
          fontWeight: 700,
        }}
      >
        <Box>Produit</Box>
        <Box>Catégorie</Box>
        <Box>Seuil</Box>
        <Box>Stock</Box>
        <Box>Actions</Box>
      </Box>
      {adding && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 160px 120px 120px 160px",
            px: 1,
            py: 1,
            borderTop: "1px solid",
            borderColor: "divider",
            alignItems: "center",
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
            {allowedSousCats.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </Select>
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
      {filtered.map((r) => (
        <Box
          key={r.id}
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 160px 120px 120px 160px",
            px: 1,
            py: 1,
            borderTop: "1px solid",
            borderColor: "divider",
            alignItems: "center",
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
                {allowedSousCats.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
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
                <Typography>{r.nom}</Typography>
              </Box>
              <Box>{r.sousCategorie}</Box>
              <Box>{r.seuilMin}</Box>
              <Box>{r.stock}</Box>
              <Stack direction="row" spacing={1}>
                <IconButton onClick={() => startEdit(r.id)}>
                  <Edit />
                </IconButton>
                <IconButton
                  color="error"
                  onClick={() => remove.mutate({ id: r.id })}
                >
                  <Delete />
                </IconButton>
              </Stack>
            </>
          )}
        </Box>
      ))}
    </Paper>
  );
}

export default function HebergementStock() {
  const { data: all } = useStockProduits();
  const hebergRows = useMemo(
    () => (all || []).filter((p) => p.famille === "Hebergement"),
    [all],
  );

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} mb={2}>
        Hébergement — Stock
      </Typography>
      <Stack spacing={2}>
        <Paper sx={{ p: 2 }}>
          <Typography fontWeight={700} mb={1}>
            Filtres et alertes
          </Typography>
          <AlertsBar
            items={hebergRows.map(({ id, nom, stock, seuilMin }) => ({
              id,
              nom,
              stock,
              seuilMin,
            }))}
          />
        </Paper>
        <Section
          title="Service linge"
          allowedSousCats={["linge_lit", "linge_salle", "entretien"]}
          famille="Hebergement"
        />
        <Section
          title="Petit déjeuner"
          allowedSousCats={["petit_dejeuner"]}
          famille="Hebergement"
        />
      </Stack>
    </Box>
  );
}
