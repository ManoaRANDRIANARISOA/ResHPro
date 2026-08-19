import { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Stack,
  TextField,
  IconButton,
  Tooltip as MuiTooltip
} from "@mui/material";
import { InfoOutlined, ReportProblemOutlined } from "@mui/icons-material";
import { useStock, useUpdateStockProduit, useAddJustification } from "@/services/api";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useRBAC } from "@/hooks/useRBAC";
import { PerteDialog } from "@/components/PerteDialog";

export default function AnalyseEcarts() {
  const { role } = useRBAC();
  const { data: stockProduits } = useStock();
  const updateStock = useUpdateStockProduit();
  const addJustification = useAddJustification();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduit, setSelectedProduit] = useState<any>(null);

  const isAdminOrDir = role === "admin" || role === "direction";

  const data = useMemo(() => {
    if (!stockProduits) return [];
    return stockProduits
      .filter((p) => p.nom.toLowerCase().includes(searchTerm.toLowerCase()))
      .map((p) => {
        const theorique = p.stockTheorique ?? p.stock;
        
        // Calcul des pertes justifiées totales pour ce produit
        const qteJustifiee = (p.pertesJustifiees || []).reduce((sum: number, j: any) => sum + j.quantite, 0);
        
        const ecartBrut = p.stock - theorique; 
        // L'écart brut est négatif si on a moins en vrai que la théorie. 
        // Ex: théorique 10, vrai 7 => ecart = -3. (On a perdu 3).
        
        // Perte inexpliquée : on prend l'écart brut (en valeur absolue si perte), et on soustrait ce qui est justifié
        let perteInexpliqueeQte = 0;
        if (ecartBrut < 0) {
          perteInexpliqueeQte = Math.abs(ecartBrut) - qteJustifiee;
          if (perteInexpliqueeQte < 0) perteInexpliqueeQte = 0; // Sécurité
        }

        const perteFinanciereInexpliquee = perteInexpliqueeQte * (p.prixUnitaire || 0);

        return {
          ...p,
          theorique,
          ecartBrut,
          qteJustifiee,
          perteInexpliqueeQte,
          perteFinanciereInexpliquee,
        };
      })
      .sort((a, b) => b.perteFinanciereInexpliquee - a.perteFinanciereInexpliquee);
  }, [stockProduits, searchTerm]);

  const totalPerteInexpliquee = data.reduce((sum, item) => sum + item.perteFinanciereInexpliquee, 0);

  const topPertes = data.slice(0, 5).filter(d => d.perteFinanciereInexpliquee > 0).map(d => ({
    name: d.nom,
    Perte: d.perteFinanciereInexpliquee,
  }));

  const handleUpdateReel = (id: string, newReel: string) => {
    const val = parseFloat(newReel);
    if (!isNaN(val)) {
      updateStock.mutate({ id, stock: val });
    }
  };

  const handleOpenDialog = (produit: any) => {
    setSelectedProduit(produit);
    setDialogOpen(true);
  };

  const handleJustifyLoss = (quantite: number, motif: string) => {
    if (selectedProduit) {
      addJustification.mutate({
        id: selectedProduit.id,
        justification: {
          quantite,
          motif,
          date: new Date().toISOString()
        },
        currentPertes: selectedProduit.pertesJustifiees || []
      });
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={800}>
          {isAdminOrDir ? "Qualité & Rentabilité (Contrôle des Écarts)" : "Inventaire Physique"}
        </Typography>
      </Box>

      {isAdminOrDir && (
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, bgcolor: "error.light", color: "error.contrastText", height: "100%" }}>
              <Typography variant="h6" fontWeight={700}>
                Perte Financière Inexpliquée
              </Typography>
              <Typography variant="h3" fontWeight={800} mt={1}>
                {totalPerteInexpliquee.toLocaleString()} Ar
              </Typography>
              <Typography variant="body2" mt={1}>
                Ce montant déduit automatiquement les casses et avaries justifiées. Il représente les fuites potentielles.
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2, height: "100%" }}>
              <Typography variant="h6" fontWeight={700} mb={2}>
                Top 5 des Ingrédients Critiques (Pertes)
              </Typography>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={topPertes}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(val: number) => `${val.toLocaleString()} Ar`} />
                  <Bar dataKey="Perte" radius={[4, 4, 0, 0]}>
                    {topPertes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#d32f2f" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {topPertes.length === 0 && (
                <Typography color="text.secondary" textAlign="center">Aucune perte inexpliquée détectée.</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={700}>
            Saisie des stocks
          </Typography>
          <TextField
            size="small"
            placeholder="Rechercher un produit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Produit</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Stock Réel (Compté)</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                {isAdminOrDir && (
                  <>
                    <TableCell sx={{ fontWeight: 700 }}>Stock Théorique</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Écart Brut</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Pertes Justifiées</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Perte Inexpliquée</TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.nom}
                    {isAdminOrDir && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {row.prixUnitaire} Ar / {row.unite}
                      </Typography>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      defaultValue={row.stock}
                      onBlur={(e) => handleUpdateReel(row.id, e.target.value)}
                      sx={{ width: 100 }}
                      inputProps={{ step: "0.1" }}
                    />
                    <Typography variant="caption" sx={{ ml: 1 }}>{row.unite}</Typography>
                  </TableCell>

                  <TableCell>
                    <Button 
                      size="small" 
                      color="warning" 
                      variant="outlined" 
                      onClick={() => handleOpenDialog(row)}
                      startIcon={<ReportProblemOutlined />}
                    >
                      Casse/Avarie
                    </Button>
                  </TableCell>

                  {isAdminOrDir && (
                    <>
                      <TableCell>
                        {row.theorique.toFixed(2)} {row.unite}
                      </TableCell>
                      <TableCell>
                        {row.ecartBrut < 0 ? (
                          <Chip size="small" label={`${row.ecartBrut.toFixed(2)}`} color="error" variant="outlined" />
                        ) : row.ecartBrut > 0 ? (
                          <Chip size="small" label={`+${row.ecartBrut.toFixed(2)}`} color="success" variant="outlined" />
                        ) : (
                          "0"
                        )}
                      </TableCell>
                      <TableCell>
                        {row.qteJustifiee > 0 ? (
                          <MuiTooltip title={(row.pertesJustifiees || []).map((j:any) => `${j.quantite} - ${j.motif}`).join('\n')}>
                            <Chip size="small" label={`${row.qteJustifiee} justifié(s)`} color="warning" />
                          </MuiTooltip>
                        ) : "—"}
                      </TableCell>
                      <TableCell sx={{ fontWeight: row.perteFinanciereInexpliquee > 0 ? 700 : 400, color: row.perteFinanciereInexpliquee > 0 ? "error.main" : "inherit" }}>
                        {row.perteFinanciereInexpliquee > 0 ? (
                          <Stack direction="row" alignItems="center" gap={1}>
                            <span>{row.perteFinanciereInexpliquee.toLocaleString()} Ar</span>
                            <MuiTooltip title={`Il manque ${row.perteInexpliqueeQte} ${row.unite} de manière inexpliquée.`}>
                              <InfoOutlined fontSize="small" color="error" />
                            </MuiTooltip>
                          </Stack>
                        ) : "—"}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdminOrDir ? 7 : 3} align="center">
                    Aucun produit trouvé.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {selectedProduit && (
        <PerteDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          produitNom={selectedProduit.nom}
          unite={selectedProduit.unite}
          onSubmit={handleJustifyLoss}
        />
      )}
    </Box>
  );
}
