import { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
} from "@mui/material";
import { useStock } from "@/services/api";

export default function StockDashboard() {
  const { data: stockProduits } = useStock();

  // Mock d'analyse d'écarts (En production, on stockerait ces données lors des inventaires)
  const rows = useMemo(() => {
    if (!stockProduits) return [];
    return stockProduits.map((p) => {
      const theo = p.stock;
      // Simulation d'un stock réel légèrement différent du théorique
      const diff = Math.floor(Math.random() * 5) - 2; 
      const reel = Math.max(0, theo + diff);
      const ecart = reel - theo;
      const coutEcart = ecart * (p.prixUnitaire || 0);

      return {
        id: p.id,
        nom: p.nom,
        theo,
        reel,
        ecart,
        coutEcart,
        unite: p.unite,
      };
    });
  }, [stockProduits]);

  const totalPerte = rows.reduce((acc, r) => acc + (r.coutEcart < 0 ? Math.abs(r.coutEcart) : 0), 0);

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} mb={3}>
        Tableau de Bord Stock & Analyse des Écarts
      </Typography>

      <Box display="flex" gap={2} mb={3}>
        <Paper sx={{ p: 3, flex: 1, bgcolor: "error.50", border: "1px solid", borderColor: "error.200" }}>
          <Typography color="error.main" fontWeight={700}>Perte Financière (Écarts Négatifs)</Typography>
          <Typography variant="h4" fontWeight={800} color="error.main">{totalPerte.toLocaleString()} Ar</Typography>
        </Paper>
        <Paper sx={{ p: 3, flex: 1 }}>
          <Typography color="text.secondary" fontWeight={700}>Dernier Inventaire</Typography>
          <Typography variant="h5" fontWeight={800}>Aujourd'hui, 08:00</Typography>
        </Paper>
      </Box>

      <Paper sx={{ width: "100%", overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Produit</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>Stock Théorique</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>Stock Réel</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>Écart</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>Impact Financier</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.nom}</TableCell>
                  <TableCell align="right">{row.theo} {row.unite}</TableCell>
                  <TableCell align="right">{row.reel} {row.unite}</TableCell>
                  <TableCell align="right">
                    <Chip 
                      size="small"
                      label={`${row.ecart > 0 ? "+" : ""}${row.ecart} ${row.unite}`}
                      color={row.ecart === 0 ? "default" : row.ecart < 0 ? "error" : "success"}
                      variant={row.ecart === 0 ? "outlined" : "filled"}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ color: row.coutEcart < 0 ? "error.main" : "inherit", fontWeight: 700 }}>
                    {row.coutEcart.toLocaleString()} Ar
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
