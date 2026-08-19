import { useMemo, useState, useEffect } from "react";
import React from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem as MItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  Divider,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import SearchIcon from "@mui/icons-material/Search";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import AddIcon from "@mui/icons-material/Add";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import LocalCafeIcon from "@mui/icons-material/LocalCafe";
import CakeIcon from "@mui/icons-material/Cake";
import RamenDiningIcon from "@mui/icons-material/RamenDining";
import {
  useCreateMenuItem,
  useMenuItems,
  useUpdateMenuItem,
  useCreateFacture,
  useStockProduits,
  useFichesTechniques,
  useFactures,
} from "@/services/api";
import { useClients, useTodayRestoReservations } from "@/services/api";
import { MenuItem as Item, StockProduit, Substitution } from "@shared/api";
import { FicheTechnique } from "@shared/fiche-technique";
import { exportToPDF } from "@/lib/export";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";

const dynamicIcons: Record<string, React.ReactNode> = {
  RestaurantIcon: <RestaurantIcon fontSize="small" />,
  RamenDiningIcon: <RamenDiningIcon fontSize="small" />,
  LocalCafeIcon: <LocalCafeIcon fontSize="small" />,
  CakeIcon: <CakeIcon fontSize="small" />,
};

function getCategoryIcon(catId: string, tenantCategories: any[]) {
  const cat = tenantCategories?.find((c) => c.id === catId);
  if (cat?.icon && dynamicIcons[cat.icon]) return dynamicIcons[cat.icon];
  // Fallback to old mapping or default
  const legacy: any = { plats: <RestaurantIcon fontSize="small" />, entrees: <RamenDiningIcon fontSize="small" />, boissons: <LocalCafeIcon fontSize="small" />, desserts: <CakeIcon fontSize="small" /> };
  return legacy[catId] || <RestaurantIcon fontSize="small" />;
}

function getCategoryLabel(catId: string, tenantCategories: any[]) {
  const cat = tenantCategories?.find((c) => c.id === catId);
  if (cat?.label) return cat.label;
  const legacy: any = { plats: "Plats", entrees: "Entrées", boissons: "Boissons", desserts: "Desserts" };
  return legacy[catId] || catId;
}

const categoryLabels: Record<string, string> = {
  plats: "Plats",
  entrees: "Entrées",
  boissons: "Boissons",
  desserts: "Desserts",
};

function CategoryChips({
  categories,
  value,
  onChange,
  tenantCategories,
}: {
  categories: { id: string; count: number }[];
  value: string;
  onChange: (v: string) => void;
  tenantCategories: any[];
}) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap">
      <Chip
        label="Toutes"
        color={value === "all" ? "primary" : "default"}
        variant={value === "all" ? "filled" : "outlined"}
        onClick={() => onChange("all")}
      />
      {categories.map((c) => (
        <Chip
          key={c.id}
          icon={getCategoryIcon(c.id, tenantCategories) as any}
          label={`${getCategoryLabel(c.id, tenantCategories)} (${c.count})`}
          color={value === c.id ? "primary" : "default"}
          variant={value === c.id ? "filled" : "outlined"}
          onClick={() => onChange(c.id)}
        />
      ))}
    </Stack>
  );
}

function Filters({
  value,
  onChange,
}: {
  value: "all" | "on" | "off";
  onChange: (v: "all" | "on" | "off") => void;
}) {
  return (
    <Stack
      direction="row"
      spacing={1}
      justifyContent="flex-end"
      flexWrap="wrap"
    >
      <Chip
        label="Tous"
        variant={value === "all" ? "filled" : "outlined"}
        color={value === "all" ? "primary" : "default"}
        onClick={() => onChange("all")}
      />
      <Chip
        label="Disponibles"
        variant={value === "on" ? "filled" : "outlined"}
        color={value === "on" ? "primary" : "default"}
        onClick={() => onChange("on")}
      />
      <Chip
        label="Indisponibles"
        variant={value === "off" ? "filled" : "outlined"}
        color={value === "off" ? "primary" : "default"}
        onClick={() => onChange("off")}
      />
    </Stack>
  );
}

function ItemCard({
  item,
  selected,
  onClick,
  onToggleEnabled,
  tenantCategories,
  fiches,
  stockProduits,
}: {
  item: Item;
  selected: boolean;
  onClick: () => void;
  onToggleEnabled: (id: string, next: boolean) => void;
  tenantCategories: any[];
  fiches: FicheTechnique[] | undefined;
  stockProduits: StockProduit[] | undefined;
}) {
  const disabled = !item.enabled;
  
  const missingIngredients = useMemo(() => {
    if (!item.ficheTechniqueId || !fiches || !stockProduits) return [];
    const fiche = fiches.find(f => f.id === item.ficheTechniqueId);
    if (!fiche) return [];
    
    const missing: string[] = [];
    fiche.ingredients?.forEach(ing => {
      const p = stockProduits.find(sp => sp.id === ing.produitId);
      const qtyRequired = ing.quantite / (fiche.portions || 1);
      const currentStock = p?.stockTheorique ?? p?.stock ?? 0;
      if (currentStock < qtyRequired) {
        missing.push(p?.nom || 'Inconnu');
      }
    });
    return missing;
  }, [item, fiches, stockProduits]);

  const isRupture = missingIngredients.length > 0;

  return (
    <Paper
      onClick={disabled ? undefined : onClick}
      sx={{
        borderRadius: 3,
        cursor: disabled ? "not-allowed" : "pointer",
        border: "2px solid",
        borderColor: selected ? "primary.main" : "divider",
        position: "relative",
        overflow: "visible",
        bgcolor: disabled ? "action.disabledBackground" : "background.paper",
        filter: disabled ? "grayscale(0.8) opacity(0.6)" : "none",
        transition: "all 0.2s",
        "&:hover": disabled ? {} : {
          transform: "translateY(-4px)",
          boxShadow: 4,
        },
      }}
    >
      {/* Image avec effet 3D - dépasse du cadre */}
      <Box
        sx={{
          position: "relative",
          height: 140,
          overflow: "visible",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          pt: 2,
        }}
      >
        <img
          src={item.photoUrl || "/placeholder.svg"}
          alt={item.nom}
          style={{
            width: "120px",
            height: "120px",
            borderRadius: "16px",
            objectFit: "cover",
            position: "relative",
            top: "-20px",
            boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
          }}
        />
        {/* Toggle disponibilité (subtil) */}
        <Box sx={{ position:'absolute', left: 8, top: 8 }}>
          <Button size="small" variant="outlined" color={item.enabled? 'success':'inherit'} onClick={(e)=>{ e.stopPropagation(); onToggleEnabled(item.id, !item.enabled); }} sx={{ minWidth: 0, px: 1 }}>
            {item.enabled? 'On':'Off'}
          </Button>
        </Box>
        {/* Prix en cercle sur l'image (côté droit) */}
        <Box
          sx={{
            position: "absolute",
            right: 16,
            top: 8,
            width: 56,
            height: 56,
            borderRadius: "50%",
            bgcolor: "primary.main",
            color: "white",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: 2,
            fontWeight: 800,
          }}
        >
          <Typography variant="caption" fontSize="0.65rem" lineHeight={1}>
            {item.prix.toLocaleString()}
          </Typography>
          <Typography variant="caption" fontSize="0.6rem" fontWeight={600}>
            Ar
          </Typography>
        </Box>
      </Box>

      {/* Contenu en dessous de l'image */}
      <Box sx={{ p: 2, pt: 0 }}>
        <Typography 
          fontWeight={700} 
          fontSize="1rem" 
          textAlign="center"
          sx={{ mb: 1 }}
        >
          {item.nom}
        </Typography>
        
        <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
          <Chip
            size="small"
            icon={getCategoryIcon(item.categorieId, tenantCategories) as any}
            label={getCategoryLabel(item.categorieId, tenantCategories)}
            variant="outlined"
            sx={{ fontSize: "0.75rem" }}
          />
        </Box>
        
        {isRupture && (
          <Typography 
            variant="caption" 
            color="error.main" 
            fontWeight={700}
            sx={{ display: 'block', textAlign: 'center', bgcolor: 'error.50', borderRadius: 1, p: 0.5, lineHeight: 1.2 }}
          >
            ⚠️ Rupture : {missingIngredients.join(', ')}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

export default function RestoMenu() {
  const { data } = useMenuItems();
  const update = useUpdateMenuItem();
  const create = useCreateMenuItem();
  const createFacture = useCreateFacture();
  const fichesQuery = useFichesTechniques();
  const stockQuery = useStockProduits();
  const todayRes = useTodayRestoReservations();
  const clientsQuery = useClients();
  const { data: factures } = useFactures();
  
  const fiches = fichesQuery.data;
  const stockProduits = stockQuery.data;
  
  const { config, publicConfig } = useTenant();
  const tenantCategories = config?.menuCategories || [];

  const topDish = useMemo(() => {
    if (!factures || !data) return null;
    
    const stats: Record<string, number> = {};
    let totalSales = 0;
    
    factures.forEach(f => {
      if (f.source === "Restaurant" && f.statut !== "annulee") {
        f.lignes.forEach(l => {
          if (l.menuItemId) {
            stats[l.menuItemId] = (stats[l.menuItemId] || 0) + l.qte;
            totalSales += l.qte;
          }
        });
      }
    });

    if (totalSales === 0) return null;

    let bestId = "";
    let bestCount = -1;
    for (const [id, count] of Object.entries(stats)) {
      if (count > bestCount) {
        bestCount = count;
        bestId = id;
      }
    }

    if (!bestId) return null;
    const menuItem = data.find(i => i.id === bestId);
    if (!menuItem) return null;

    return {
      nom: menuItem.nom,
      categorieId: menuItem.categorieId,
      count: bestCount,
      percentage: Math.round((bestCount / totalSales) * 100),
    };
  }, [factures, data]);

  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(
    data?.[0]?.id ?? null,
  );
  const selected = (data || []).find((i) => i.id === selectedId) || null;
  const [draftItem, setDraftItem] = useState<Item | null>(null);
  useEffect(() => {
    if (selected) setDraftItem({ ...selected });
    else setDraftItem(null);
  }, [selectedId, data]);

  const categories = useMemo(() => {
    const map: Record<string, number> = {};
    (data || []).forEach((i) => {
      map[i.categorieId] = (map[i.categorieId] || 0) + 1;
    });
    return Object.entries(map)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [data]);

  const [cat, setCat] = useState<string>("all");
  const [avail, setAvail] = useState<"all" | "on" | "off">("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    let list = data || [];
    if (cat !== "all") list = list.filter((i) => i.categorieId === cat);
    if (avail === "on") list = list.filter((i) => i.enabled);
    if (avail === "off") list = list.filter((i) => !i.enabled);
    if (q.trim())
      list = list.filter((i) => i.nom.toLowerCase().includes(q.toLowerCase()));
    return list;
  }, [data, cat, avail, q]);

  const [substitutionModal, setSubstitutionModal] = useState<{ open: boolean; cartItemId: string | null; menuItemId: string | null }>({ open: false, cartItemId: null, menuItemId: null });

  const [cart, setCart] = useState<
    { cartItemId: string; id: string; nom: string; prix: number; qte: number; noteSpeciale: string; substitutions: Substitution[] }[]
  >([]);
  function addToCart(it: Item) {
    setCart((c) => {
      const i = c.findIndex((x) => x.id === it.id && !x.noteSpeciale && x.substitutions.length === 0);
      if (i >= 0) {
        const copy = [...c];
        copy[i] = { ...copy[i], qte: copy[i].qte + 1 };
        return copy;
      }
      return [...c, { cartItemId: Date.now().toString() + Math.random(), id: it.id, nom: it.nom, prix: it.prix, qte: 1, noteSpeciale: "", substitutions: [] }];
    });
  }
  function changeQte(cartItemId: string, delta: number) {
    setCart((c) =>
      c
        .map((x) =>
          x.cartItemId === cartItemId ? { ...x, qte: Math.max(0, x.qte + delta) } : x,
        )
        .filter((x) => x.qte > 0),
    );
  }
  function updateNote(cartItemId: string, text: string) {
    setCart((c) =>
      c.map((x) => (x.cartItemId === cartItemId ? { ...x, noteSpeciale: text } : x))
    );
  }
  
  function addSubstitution(cartItemId: string, sub: Substitution) {
    setCart((c) =>
      c.map((x) => {
        if (x.cartItemId === cartItemId) {
          const newSubs = [...x.substitutions, sub];
          const textNote = x.noteSpeciale ? x.noteSpeciale + `, Remplacé ${sub.removedNom} par ${sub.addedNom} (${sub.quantite}${sub.unite})` : `Remplacé ${sub.removedNom} par ${sub.addedNom} (${sub.quantite}${sub.unite})`;
          return { ...x, substitutions: newSubs, noteSpeciale: textNote };
        }
        return x;
      })
    );
  }

  const total = cart.reduce((a, b) => a + b.prix * b.qte, 0);
  const [billClient, setBillClient] = useState<string>("Client comptoir");
  const clientOptions = useMemo(() => {
    const ids = new Set<string>();
    const names: string[] = [];
    (todayRes.data || []).forEach(r => {
      if (r.clientId && !ids.has(r.clientId)) {
        ids.add(r.clientId);
        const cli = (clientsQuery.data || []).find(c => c.id === r.clientId);
        names.push(cli?.nom || r.clientId);
      }
    });
    return names.sort((a,b)=>a.localeCompare(b));
  }, [todayRes.data, clientsQuery.data]);

  function handlePrint() {
    const rows = cart.map((c) => ({
      Article: c.nom + (c.noteSpeciale ? ` (${c.noteSpeciale})` : ""),
      Quantité: c.qte,
      "Prix unitaire (Ar)": c.prix.toLocaleString(),
      Total: (c.prix * c.qte).toLocaleString() + " Ar",
    }));
    exportToPDF("Commande restaurant", rows as any[], "commande", publicConfig?.nom);
  }

  function handleGenerateInvoice() {
    if (cart.length === 0) {
      alert("Le panier est vide");
      return;
    }
    createFacture.mutate(
      {
        date: new Date().toISOString(),
        clientNom: billClient || "Client comptoir",
        source: "Restaurant",
        lignes: cart.map((c) => ({ description: c.nom + (c.noteSpeciale ? ` (${c.noteSpeciale})` : ""), qte: c.qte, pu: c.prix, menuItemId: c.id, noteSpeciale: c.noteSpeciale, substitutions: c.substitutions })),
        totalTTC: cart.reduce((sum, c) => sum + c.prix * c.qte, 0),
      },
      {
        onSuccess: (f) => {
          setCart([]);
          navigate(`/financier?factureId=${f.id}`);
        },
      },
    );
  }

  const [openNew, setOpenNew] = useState(false);
  const [newForm, setNewForm] = useState({
    nom: "",
    categorieId: "entrees",
    prix: 10000,
    photoUrl: "",
  });

  function saveNew() {
    create.mutate(newForm, {
      onSuccess: (it) => {
        setOpenNew(false);
        setSelectedId(it.id);
      },
    });
  }

  function saveField<K extends keyof Item>(k: K, v: Item[K]) {
    if (!selected) return;
    update.mutate({ id: selected.id, [k]: v } as any);
  }

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Typography variant="h4" fontWeight={800}>
          Menu
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<CloudUploadIcon />}>
            Importer
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenNew(true)}
          >
            Nouveau article
          </Button>
        </Stack>
      </Box>

      {/* Plat le plus pris dynamique */}
      {topDish && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, bgcolor: 'secondary.50', border: '1px solid', borderColor: 'secondary.200' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <RestaurantIcon color="secondary" fontSize="small" />
                <Typography variant="caption" fontWeight={700} color="secondary.main">
                  Plat le plus pris
                </Typography>
              </Stack>
              <Typography variant="h5" fontWeight={800}>
                {topDish.nom}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                {getCategoryLabel(topDish.categorieId, tenantCategories)}
              </Typography>
              <Typography variant="body2" fontWeight={700} color="secondary.main" sx={{ mt: 0.5 }}>
                {topDish.count} commande{topDish.count > 1 ? 's' : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {topDish.percentage}% du total
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Header with categories (left) and filters (right) */}
      <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 1.5 }}>
            <CategoryChips
              categories={categories}
              value={cat}
              onChange={setCat}
              tenantCategories={tenantCategories}
            />
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 1.5 }}>
            <Filters value={avail} onChange={setAvail} />
          </Paper>
        </Grid>
      </Grid>

      {/* Search */}
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Rechercher dans le menu (plats, boissons...)"
          fullWidth
          value={q}
          onChange={(e) => setQ(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      {/* Grid of items + cart aside */}
      <Grid container spacing={1.5}>
        <Grid item xs={12} md={8}>
          <Grid container spacing={2}>
            {filtered.map((i) => (
              <Grid key={i.id} item xs={12} sm={6} md={4}>
                <ItemCard
                  item={i}
                  selected={selected?.id === i.id}
                  tenantCategories={tenantCategories}
                  fiches={fiches}
                  stockProduits={stockProduits}
                  onClick={() => {
                    setSelectedId(i.id);
                    if (i.enabled) {
                      addToCart(i);
                    }
                  }}
                  onToggleEnabled={(id, next)=> update.mutate({ id, enabled: next })}
                />
              </Grid>
            ))}
          </Grid>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, position: "sticky", top: 80 }}>
            <Typography fontWeight={800} mb={1}>
              Commande
            </Typography>
            {cart.length === 0 && (
              <Typography color="text.secondary">Aucun article</Typography>
            )}
            {cart.map((c) => (
              <Stack
                key={c.cartItemId}
                direction="column"
                spacing={0.5}
                sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider" }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ flex: 1, fontWeight: 600 }}>{c.nom}</Box>
                  <Chip size="small" label={`${c.prix.toLocaleString()} Ar`} />
                  <Button size="small" onClick={() => changeQte(c.cartItemId, -1)}>
                    -
                  </Button>
                  <Typography>{c.qte}</Typography>
                  <Button size="small" onClick={() => changeQte(c.cartItemId, 1)}>
                    +
                  </Button>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    variant="outlined"
                    placeholder="Note (Ex: Sans oignons)"
                    value={c.noteSpeciale}
                    onChange={(e) => updateNote(c.cartItemId, e.target.value)}
                    InputProps={{ style: { fontSize: "0.8rem", padding: "4px 8px" } }}
                    sx={{ mt: 0.5, flex: 1 }}
                  />
                  {fiches?.find(f => f.id === data?.find(i => i.id === c.id)?.ficheTechniqueId) && (
                    <Button 
                      size="small" 
                      variant="outlined" 
                      onClick={() => setSubstitutionModal({ open: true, cartItemId: c.cartItemId, menuItemId: c.id })}
                      sx={{ mt: 0.5, py: 0.25, fontSize: "0.7rem", minWidth: 'auto' }}
                      title="Substituer des ingrédients"
                    >
                      Subst.
                    </Button>
                  )}
                </Stack>
              </Stack>
            ))}
            <Divider sx={{ my: 1 }} />
            <Stack
              direction="row"
              justifyContent="space-between"
              sx={{ mb: 1 }}
            >
              <Typography>Total</Typography>
              <Typography fontWeight={800}>
                {total.toLocaleString()} Ar
              </Typography>
            </Stack>
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Autocomplete
                freeSolo
                options={clientOptions}
                value={billClient}
                onChange={(_e, v) => setBillClient(v || "")}
                renderInput={(params) => (
                  <TextField {...params} size="small" label="Client" placeholder="Nom du client" onChange={(e)=>setBillClient(e.target.value)} />
                )}
              />
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={handlePrint}>Imprimer</Button>
                <Button variant="contained" onClick={handleGenerateInvoice} disabled={createFacture.isPending}>
                  Générer la facture
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Details section below */}
      <Box sx={{ mt: 3 }}>
        <Paper sx={{ p: 2 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            mb={1}
          >
            <Typography fontWeight={800}>Détails de l'article</Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => navigate("/resto/fiches-techniques")}>Fiches techniques</Button>
              <Button variant="outlined">Dupliquer</Button>
              <Button
                variant="contained"
                onClick={() => draftItem && update.mutate({ id: draftItem.id, nom: draftItem.nom, categorieId: draftItem.categorieId, prix: draftItem.prix, enabled: draftItem.enabled, photoUrl: draftItem.photoUrl })}
              >
                Enregistrer
              </Button>
            </Stack>
          </Stack>
          {!draftItem && (
            <Typography color="text.secondary">
              Sélectionnez un article
            </Typography>
          )}
          {draftItem && (
            <Stack spacing={1.2}>
              <TextField
                size="small"
                label="Nom"
                value={draftItem.nom}
                onChange={(e) => setDraftItem({ ...draftItem, nom: e.target.value })}
              />
              <FormControl size="small">
                <InputLabel>Catégorie</InputLabel>
                <Select
                  label="Catégorie"
                  value={draftItem.categorieId}
                  onChange={(e) => setDraftItem({ ...draftItem, categorieId: e.target.value as string })}
                >
                  {tenantCategories.length > 0 ? (
                    tenantCategories.map((tc) => (
                      <MItem key={tc.id} value={tc.id}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {getCategoryIcon(tc.id, tenantCategories)}
                          <span>{tc.label}</span>
                        </Stack>
                      </MItem>
                    ))
                  ) : (
                    <>
                      <MItem value="entrees">Entrées</MItem>
                      <MItem value="plats">Plats</MItem>
                      <MItem value="boissons">Boissons</MItem>
                      <MItem value="desserts">Desserts</MItem>
                    </>
                  )}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Prix (Ar)"
                type="number"
                value={draftItem.prix}
                onChange={(e) => setDraftItem({ ...draftItem, prix: parseInt(e.target.value || "0", 10) })}
              />
              <Stack direction="row" gap={1}>
                <Chip
                  label={draftItem.enabled ? "Disponible" : "Indisponible"}
                  color={draftItem.enabled ? "success" : "default"}
                  onClick={() => setDraftItem({ ...draftItem, enabled: !draftItem.enabled })}
                />
              </Stack>
              <TextField
                size="small"
                label="URL photo"
                placeholder="https://..."
                value={draftItem.photoUrl || ""}
                onChange={(e) => setDraftItem({ ...draftItem, photoUrl: e.target.value })}
              />
              <TextField
                size="small"
                label="Description"
                multiline
                minRows={3}
                placeholder="À confirmer"
              />
              <Stack direction="row" gap={1}>
                <Chip label="Détails" variant="outlined" />
                <Chip label="Ingrédients" variant="outlined" />
                <Chip label="Allergènes" variant="outlined" />
              </Stack>
              <Box sx={{ mt: 1 }}>
                <Chip
                  label={`Coût matière: ${draftItem.coutMatiere ? draftItem.coutMatiere.toLocaleString() + ' Ar' : 'N/A'}`}
                  variant="outlined"
                  sx={{ mr: 1 }}
                />
                <Chip label={`Marge: ${draftItem.margePourcent ? draftItem.margePourcent.toFixed(1) + '%' : 'N/A'}`} variant="outlined" sx={{ mr: 1 }} />
                <Chip label={draftItem.ficheTechniqueId ? "Fiche OK" : "Sans Fiche"} color={draftItem.ficheTechniqueId ? "success" : "warning"} variant="outlined" />
              </Box>
            </Stack>
          )}
        </Paper>
      </Box>

      {/* Modal new article */}
      <Dialog
        open={openNew}
        onClose={() => setOpenNew(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Nouveau article</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Nom"
              value={newForm.nom}
              onChange={(e) => setNewForm({ ...newForm, nom: e.target.value })}
            />
            <FormControl size="small">
              <InputLabel>Catégorie</InputLabel>
              <Select
                label="Catégorie"
                value={newForm.categorieId}
                onChange={(e) =>
                  setNewForm({
                    ...newForm,
                    categorieId: e.target.value as string,
                  })
                }
              >
                {tenantCategories.length > 0 ? (
                  tenantCategories.map((tc) => (
                    <MItem key={tc.id} value={tc.id}>
                      {tc.label}
                    </MItem>
                  ))
                ) : (
                  <>
                    <MItem value="entrees">Entrées</MItem>
                    <MItem value="plats">Plats</MItem>
                    <MItem value="boissons">Boissons</MItem>
                    <MItem value="desserts">Desserts</MItem>
                  </>
                )}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Prix (Ar)"
              type="number"
              value={newForm.prix}
              onChange={(e) =>
                setNewForm({
                  ...newForm,
                  prix: parseInt(e.target.value || "0", 10),
                })
              }
            />
            <TextField
              size="small"
              label="URL photo"
              value={newForm.photoUrl}
              onChange={(e) =>
                setNewForm({ ...newForm, photoUrl: e.target.value })
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNew(false)}>Annuler</Button>
          <Button variant="contained" onClick={saveNew}>
            Créer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Substitution Modal */}
      <Dialog
        open={substitutionModal.open}
        onClose={() => setSubstitutionModal({ open: false, cartItemId: null, menuItemId: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Substituer un ingrédient</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Sélectionnez un ingrédient de la recette à retirer, et choisissez l'ingrédient de remplacement. La note de cuisine et la déduction de stock seront mises à jour automatiquement.
          </Typography>
          
          {(() => {
            const mItem = data?.find(i => i.id === substitutionModal.menuItemId);
            const fiche = fiches?.find(f => f.id === mItem?.ficheTechniqueId);
            if (!fiche) return <Typography>Aucune fiche technique trouvée.</Typography>;
            
            return (
              <Stack spacing={2}>
                {fiche.ingredients?.map(ing => {
                  const sp = stockProduits?.find(p => p.id === ing.produitId);
                  const qtyRequired = ing.quantite / (fiche.portions || 1);
                  return (
                    <SubstitutionRow 
                      key={ing.produitId} 
                      ingId={ing.produitId} 
                      ingNom={sp?.nom || 'Inconnu'} 
                      qtyRequired={qtyRequired}
                      unite={sp?.unite || 'U'}
                      stockProduits={stockProduits || []}
                      onSubstitute={(addedId, addedNom, qty) => {
                        if (substitutionModal.cartItemId) {
                          addSubstitution(substitutionModal.cartItemId, {
                            removedProduitId: ing.produitId,
                            addedProduitId: addedId,
                            removedNom: sp?.nom || 'Inconnu',
                            addedNom,
                            quantite: qty,
                            unite: sp?.unite || 'U'
                          });
                          setSubstitutionModal({ open: false, cartItemId: null, menuItemId: null });
                        }
                      }}
                    />
                  );
                })}
              </Stack>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubstitutionModal({ open: false, cartItemId: null, menuItemId: null })}>Fermer</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

function SubstitutionRow({ ingId, ingNom, qtyRequired, unite, stockProduits, onSubstitute }: any) {
  const [replacing, setReplacing] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [qty, setQty] = useState(qtyRequired);

  if (!replacing) {
    return (
      <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography><strong>{ingNom}</strong> ({qtyRequired} {unite})</Typography>
        <Button size="small" variant="outlined" onClick={() => setReplacing(true)}>Remplacer</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'primary.main', borderRadius: 1, bgcolor: 'primary.50' }}>
      <Typography variant="body2" mb={1}>Remplacer <strong>{ingNom}</strong> par :</Typography>
      <Stack spacing={1}>
        <Autocomplete
          size="small"
          options={stockProduits}
          getOptionLabel={(o: any) => `${o.nom} (En stock: ${o.stockTheorique ?? o.stock} ${o.unite})`}
          onChange={(_e, val) => setSelectedStock(val)}
          renderInput={(params) => <TextField {...params} label="Ingrédient de remplacement" />}
        />
        {selectedStock && (
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              label={`Quantité à déduire (${selectedStock.unite})`}
              type="number"
              value={qty}
              onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
              sx={{ width: 150 }}
              inputProps={{ step: "0.01" }}
            />
            <Button 
              variant="contained" 
              size="small"
              onClick={() => onSubstitute(selectedStock.id, selectedStock.nom, qty)}
            >
              Valider
            </Button>
            <Button size="small" onClick={() => setReplacing(false)}>Annuler</Button>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
