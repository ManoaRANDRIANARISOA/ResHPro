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
} from "@mui/material";
import { useStock, useUpdateStockProduit } from "@/services/api";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function AnalyseEcarts() {
  const { data: stockProduits } = useStock();
  const updateStock = useUpdateStockProduit();
  const [searchTerm, setSearchTerm] = useState("");

  const data = useMemo(() => {
    if (!stockProduits) return [];
    return stockProduits
      .filter((p) => p.nom.toLowerCase().includes(searchTerm.toLowerCase()))
      .map((p) => {
        const theorique = p.stockTheorique ?? p.stock;
        const ecart = p.stock - theorique;
        const perte = ecart < 0 ? Math.abs(ecart) * (p.prixUnitaire || 0) : 0;
        return {
          ...p,
          theorique,
          ecart,
          perte,
        };
      })
      .sort((a, b) => b.perte - a.perte);
  }, [stockProduits, searchTerm]);

  const totalPerte = data.reduce((sum, item) => sum + item.perte, 0);

  const topPertes = data.slice(0, 5).filter(d => d.perte > 0).map(d => ({
    name: d.nom,
    Perte: d.perte,
  }));

  const handleUpdateReel = (id: string, newReel: string) => {
    const val = parseFloat(newReel);
    if (!isNaN(val)) {
      updateStock.mutate({ id, stock: val });
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={800}>
          Analyse des Écarts (Fin de journée)
        </Typography>
      </Box>

      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, bgcolor: "error.light", color: "error.contrastText" }}>
            <Typography variant="h6" fontWeight={700}>
              Perte Financière Totale
            </Typography>
            <Typography variant="h3" fontWeight={800} mt={1}>
              {totalPerte.toLocaleString()} Ar
            </Typography>
            <Typography variant="body2" mt={1}>
              Basé sur la différence entre le stock physique et théorique.
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: "100%" }}>
            <Typography variant="h6" fontWeight={700} mb={2}>
              Top 5 des Ingrédients en Perte
            </Typography>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={topPertes}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(val: number) => `${val.toLocaleString()} Ar`} />
                <Bar dataKey="Perte" radius={[4, 4, 0, 0]}>
                  {topPertes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#ef5350" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {topPertes.length === 0 && (
              <Typography color="text.secondary" textAlign="center">Aucune perte détectée.</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={700}>
            Inventaire & Comparaison
          </Typography>
          <TextField
            size="small"
            placeholder="Rechercher un ingrédient..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Ingrédient</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Stock Théorique (Système)</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Stock Réel (Physique)</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Écart</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Perte Financière</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.nom}
                    <Typography variant="caption" color="text.secondary" display="block">
                      {row.prixUnitaire} Ar / {row.unite}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {row.theorique.toFixed(2)} {row.unite}
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
                  </TableCell>
                  <TableCell>
                    {row.ecart < 0 ? (
                      <Chip size="small" label={`${row.ecart.toFixed(2)} ${row.unite}`} color="error" />
                    ) : row.ecart > 0 ? (
                      <Chip size="small" label={`+${row.ecart.toFixed(2)} ${row.unite}`} color="success" />
                    ) : (
                      <Chip size="small" label="0" color="default" />
                    )}
                  </TableCell>
                  <TableCell sx={{ fontWeight: row.perte > 0 ? 700 : 400, color: row.perte > 0 ? "error.main" : "inherit" }}>
                    {row.perte > 0 ? `${row.perte.toLocaleString()} Ar` : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    Aucun produit trouvé.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
