import { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  Button,
  Stack,
  TextField,
  Autocomplete,
  Chip,
  IconButton,
  Alert,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import {
  useMenuItems,
  useUpdateMenuItem,
  useStock,
  useFicheTechnique,
  useCreateFicheTechnique,
  useUpdateFicheTechnique,
} from "@/services/api";
import { FicheTechniqueIngredient } from "@shared/fiche-technique";
import { exportToPDF } from "@/lib/export";
import { useTenant } from "@/contexts/TenantContext";

export default function FichesTechniques() {
  const { data: menuItems } = useMenuItems();
  const { data: stockProduits } = useStock();
  const updateMenu = useUpdateMenuItem();
  const createFiche = useCreateFicheTechnique();
  const updateFiche = useUpdateFicheTechnique();
  const { publicConfig } = useTenant();

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedItem = menuItems?.find((m) => m.id === selectedItemId);

  const { data: fiche, isLoading: ficheLoading } = useFicheTechnique(selectedItemId);

  // Pour ajouter un ingrédient
  const [ingProduitId, setIngProduitId] = useState<string | null>(null);
  const [ingQuantite, setIngQuantite] = useState<number>(0);

  const stockOptions = useMemo(() => {
    if (!stockProduits) return [];
    return stockProduits.map((p) => ({
      id: p.id,
      label: `${p.nom} (${p.unite}) - ${p.prixUnitaire || 0} Ar/${p.unite}`,
      prixUnitaire: p.prixUnitaire || 0,
      unite: p.unite,
    }));
  }, [stockProduits]);

  // Calcul du coût matière
  const coutMatiere = useMemo(() => {
    if (!fiche || !stockProduits) return 0;
    return fiche.ingredients.reduce((acc, ing) => {
      const prod = stockProduits.find((p) => p.id === ing.produitId);
      const prixU = prod?.prixUnitaire || 0;
      return acc + (ing.quantite * prixU);
    }, 0);
  }, [fiche, stockProduits]);

  const prixVente = selectedItem?.prix || 0;
  const margeReelle = prixVente - coutMatiere;
  const margePourcent = prixVente > 0 ? (margeReelle / prixVente) * 100 : 0;

  let margeColor: "success" | "warning" | "error" = "success";
  if (margePourcent < 40) margeColor = "error";
  else if (margePourcent < 60) margeColor = "warning";

  function handleCreateFiche() {
    if (!selectedItemId) return;
    createFiche.mutate({
      menuItemId: selectedItemId,
      portions: 1,
      ingredients: [],
    });
  }

  function handleAddIngredient() {
    if (!fiche || !ingProduitId || ingQuantite <= 0) return;
    const prod = stockOptions.find((p) => p.id === ingProduitId);
    if (!prod) return;

    const newIng: FicheTechniqueIngredient = {
      produitId: ingProduitId,
      quantite: ingQuantite,
      unite: prod.unite,
    };

    updateFiche.mutate({
      id: fiche.id,
      ingredients: [...fiche.ingredients, newIng],
    });

    setIngProduitId(null);
    setIngQuantite(0);
  }

  function handleRemoveIngredient(idx: number) {
    if (!fiche) return;
    const next = [...fiche.ingredients];
    next.splice(idx, 1);
    updateFiche.mutate({
      id: fiche.id,
      ingredients: next,
    });
  }

  function handleUpdateIngredientQty(idx: number, newQty: number) {
    if (!fiche || newQty <= 0) return;
    const next = [...fiche.ingredients];
    next[idx] = { ...next[idx], quantite: newQty };
    updateFiche.mutate({
      id: fiche.id,
      ingredients: next,
    });
  }

  function handleSaveMenuSync() {
    if (!selectedItemId) return;
    updateMenu.mutate({
      id: selectedItemId,
      ficheTechniqueId: fiche?.id,
      coutMatiere,
      margePourcent,
    });
  }

  function handleExportPDF() {
    if (!selectedItem || !fiche) return;
    const data = fiche.ingredients.map((ing) => {
      const prod = stockProduits?.find((p) => p.id === ing.produitId);
      const prixU = prod?.prixUnitaire || 0;
      const cout = ing.quantite * prixU;
      return {
        Ingrédient: prod?.nom || "Inconnu",
        Quantité: `${ing.quantite} ${ing.unite}`,
        "Prix Unitaire": `${prixU} Ar`,
        "Coût": `${cout} Ar`,
      };
    });
    
    data.push({ Ingrédient: "COÛT MATIÈRE TOTAL", Quantité: "", "Prix Unitaire": "", Coût: `${coutMatiere} Ar` });
    data.push({ Ingrédient: "PRIX DE VENTE", Quantité: "", "Prix Unitaire": "", Coût: `${prixVente} Ar` });
    data.push({ Ingrédient: "MARGE", Quantité: "", "Prix Unitaire": "", Coût: `${margePourcent.toFixed(1)}%` });

    exportToPDF(`Fiche Technique : ${selectedItem.nom}`, data, `fiche_${selectedItem.nom}`, publicConfig?.nom);
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} mb={3}>
        Fiches Techniques
      </Typography>

      {/* Liste des plats en horizontal */}
      <Box 
        sx={{ 
          display: 'flex', 
          overflowX: 'auto', 
          pb: 2, 
          mb: 3, 
          gap: 2,
          '&::-webkit-scrollbar': { height: 8 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 4 }
        }}
      >
        {menuItems?.map((item) => (
          <Paper
            key={item.id}
            onClick={() => setSelectedItemId(item.id)}
            variant="outlined"
            sx={{
              p: 2,
              minWidth: 200,
              flexShrink: 0,
              cursor: "pointer",
              borderColor: selectedItemId === item.id ? "primary.main" : "divider",
              bgcolor: selectedItemId === item.id ? "primary.50" : "background.paper",
              transition: "all 0.2s",
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <Box>
              <Typography fontWeight={700} noWrap title={item.nom}>{item.nom}</Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>{item.prix.toLocaleString()} Ar</Typography>
            </Box>
            <Box>
              {item.ficheTechniqueId ? (
                <Chip size="small" label="Fiche OK" color="success" />
              ) : (
                <Chip size="small" label="Manquante" color="error" />
              )}
            </Box>
          </Paper>
        ))}
        {menuItems?.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 2 }}>Aucun plat dans le menu.</Typography>
        )}
      </Box>

      {/* Détails de la fiche */}
      <Box>
        {!selectedItem ? (
          <Paper sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
            Sélectionnez un plat ci-dessus pour gérer sa fiche technique.
          </Paper>
        ) : (
          <Paper sx={{ p: 3, minHeight: "500px" }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h5" fontWeight={800}>
                {selectedItem.nom}
              </Typography>
              <Button startIcon={<PictureAsPdfIcon />} variant="outlined" onClick={handleExportPDF} disabled={!fiche}>
                Exporter
              </Button>
            </Box>

            {ficheLoading ? (
              <Typography>Chargement...</Typography>
            ) : !fiche ? (
              <Box textAlign="center" py={4}>
                <Typography mb={2}>Ce plat n'a pas encore de fiche technique.</Typography>
                <Button variant="contained" onClick={handleCreateFiche}>
                  Créer la fiche technique
                </Button>
              </Box>
            ) : (
              <Grid container spacing={4}>
                <Grid item xs={12} md={8}>
                    <Typography variant="h6" fontWeight={700} mb={2}>
                      Ingrédients ({fiche.portions} portion{fiche.portions > 1 && "s"})
                    </Typography>

                    <Stack direction="row" spacing={1} mb={3}>
                      <Autocomplete
                        size="small"
                        options={stockOptions}
                        value={stockOptions.find((o) => o.id === ingProduitId) || null}
                        onChange={(_, v) => setIngProduitId(v?.id || null)}
                        sx={{ flex: 1 }}
                        renderInput={(params) => <TextField {...params} label="Ajouter un ingrédient du stock" />}
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Qté"
                        sx={{ width: 100 }}
                        value={ingQuantite}
                        onChange={(e) => setIngQuantite(parseFloat(e.target.value) || 0)}
                        inputProps={{ step: "0.001", min: "0" }}
                      />
                      <Button variant="contained" onClick={handleAddIngredient}>
                        <AddIcon />
                      </Button>
                    </Stack>

                    <List>
                      {fiche.ingredients.map((ing, idx) => {
                        const prod = stockProduits?.find((p) => p.id === ing.produitId);
                        const prixU = prod?.prixUnitaire || 0;
                        const cout = ing.quantite * prixU;
                        return (
                          <Paper key={idx} variant="outlined" sx={{ mb: 1, p: 2, display: "flex", alignItems: "center" }}>
                            <Box flex={1}>
                              <Typography fontWeight={600}>{prod?.nom || "Inconnu"}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {prixU} Ar / {ing.unite}
                              </Typography>
                            </Box>
                            <Box width={150} mr={2}>
                              <TextField
                                size="small"
                                type="number"
                                label="Quantité"
                                value={ing.quantite}
                                onChange={(e) => handleUpdateIngredientQty(idx, parseFloat(e.target.value) || 0)}
                                inputProps={{ step: "0.001", min: "0" }}
                                InputProps={{ endAdornment: <Typography variant="caption" sx={{ml:1, color: 'text.secondary'}}>{ing.unite}</Typography> }}
                              />
                            </Box>
                            <Box width={120} textAlign="right" mr={2}>
                              <Typography variant="caption" color="text.secondary" display="block">Coût</Typography>
                              <Typography fontWeight={700} color="error.main">{cout.toLocaleString()} Ar</Typography>
                            </Box>
                            <IconButton color="error" onClick={() => handleRemoveIngredient(idx)}>
                              <DeleteIcon />
                            </IconButton>
                          </Paper>
                        );
                      })}
                      {fiche.ingredients.length === 0 && (
                        <Typography color="text.secondary">Aucun ingrédient ajouté.</Typography>
                      )}
                    </List>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, bgcolor: "grey.50" }} variant="outlined">
                      <Typography variant="h6" fontWeight={700} mb={2}>
                        Rentabilité
                      </Typography>
                      
                      <Stack spacing={2}>
                        <Box display="flex" justifyContent="space-between">
                          <Typography color="text.secondary">Prix de vente</Typography>
                          <Typography fontWeight={700}>{prixVente.toLocaleString()} Ar</Typography>
                        </Box>
                        
                        <Box display="flex" justifyContent="space-between">
                          <Typography color="text.secondary">Coût matière</Typography>
                          <Typography fontWeight={700} color="error.main">{coutMatiere.toLocaleString()} Ar</Typography>
                        </Box>
                        
                        <Divider />
                        
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography color="text.secondary">Marge Brute</Typography>
                          <Typography fontWeight={800}>{margeReelle.toLocaleString()} Ar</Typography>
                        </Box>

                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography color="text.secondary">Taux de Marge</Typography>
                          <Chip 
                            label={`${margePourcent.toFixed(1)}%`} 
                            color={margeColor} 
                            sx={{ fontWeight: 800, fontSize: "1.1rem", height: 32 }}
                          />
                        </Box>
                      </Stack>

                      <Button 
                        fullWidth 
                        variant="contained" 
                        color="primary" 
                        sx={{ mt: 4 }}
                        onClick={handleSaveMenuSync}
                      >
                        Synchroniser avec le Menu
                      </Button>
                      <Typography variant="caption" color="text.secondary" display="block" mt={1} textAlign="center">
                        Mets à jour la marge du plat dans le menu
                      </Typography>
                    </Paper>

                    {margeColor === "error" && (
                      <Alert severity="error" sx={{ mt: 2 }}>
                        La marge est trop faible (&lt;40%). Augmentez le prix ou réduisez les coûts.
                      </Alert>
                    )}
                  </Grid>
                </Grid>
              )}
            </Paper>
          )}
        </Box>
    </Box>
  );
}
