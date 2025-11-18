import { Box, Button, Paper, Stack, TextField, Typography, Select, MenuItem } from "@mui/material";
import { useEffect, useState } from "react";
import { useChambres, useCreateChambre, useUpdateChambre, useDeleteChambre } from "@/services/api";
import type { Chambre } from "@shared/api";

export default function HebergementTarifs() {
  const { data: rooms } = useChambres();
  const createChambre = useCreateChambre();
  const updateChambre = useUpdateChambre();
  const deleteChambre = useDeleteChambre();

  const [rows, setRows] = useState<Array<{ id?: string; numero: string; categorie: Chambre["categorie"]; capacite: number; tarif: number; isNew?: boolean }>>([]);

  useEffect(() => {
    setRows((rooms || []).map((c) => ({
      id: c.id,
      numero: c.numero,
      categorie: c.categorie,
      capacite: c.capacite,
      tarif: c.tarif_base,
    })));
  }, [rooms]);

  function update<K extends keyof (typeof rows)[number]>(id: string, key: K, value: any) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }

  function updateByIndex(idx: number, key: keyof (typeof rows)[number], value: any) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }

  function addRow() {
    setRows((rs) => [
      ...rs,
      { numero: "", categorie: "standard", capacite: 2, tarif: 0, isNew: true },
    ]);
  }

  function removeRow(idx: number) {
    const r = rows[idx];
    if (r.id) {
      deleteChambre.mutate({ id: r.id });
    }
    setRows((rs) => rs.filter((_, i) => i !== idx));
  }

  async function handleValidate() {
    // Persist creations and updates
    for (const r of rows) {
      if (r.isNew) {
        if (!r.numero || !r.categorie) continue;
        await createChambre.mutateAsync({
          numero: r.numero,
          categorie: r.categorie,
          capacite: r.capacite,
          tarif_base: r.tarif,
          statut: "libre",
        });
      } else if (r.id) {
        await updateChambre.mutateAsync({
          id: r.id,
          numero: r.numero,
          categorie: r.categorie,
          capacite: r.capacite,
          tarif_base: r.tarif,
        });
      }
    }
  }
  return (
    <Box>
      <Typography variant="h4" fontWeight={800} mb={2}>
        Hébergement — Tarifs
      </Typography>
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography fontWeight={700}>Chambres et tarifs</Typography>
          <Button size="small" variant="outlined" onClick={addRow}>Ajouter une chambre</Button>
        </Stack>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "120px 1fr 120px 160px 120px",
            px: 1,
            py: 1,
            color: "text.secondary",
            fontWeight: 700,
          }}
        >
          <Box>Chambre</Box>
          <Box>Catégorie</Box>
          <Box>Capacité</Box>
          <Box>Tarif base (Ar)</Box>
          <Box>Actions</Box>
        </Box>
        {rows.map((r, idx) => (
          <Box
            key={r.id ?? `new-${idx}`}
            sx={{
              display: "grid",
              gridTemplateColumns: "120px 1fr 120px 160px 120px",
              px: 1,
              py: 1,
              borderTop: "1px solid",
              borderColor: "divider",
              alignItems: "center",
            }}
          >
            <TextField
              size="small"
              value={r.numero}
              placeholder="N°"
              onChange={(e) => updateByIndex(idx, "numero", e.target.value)}
            />
            <Select
              size="small"
              value={r.categorie}
              onChange={(e) => {
                const v = e.target.value as Chambre["categorie"];
                if (r.id) update(r.id!, "categorie", v); else updateByIndex(idx, "categorie", v);
              }}
            >
              <MenuItem value="standard">standard</MenuItem>
              <MenuItem value="suite">suite</MenuItem>
              <MenuItem value="familiale">familiale</MenuItem>
            </Select>
            <TextField
              size="small"
              type="number"
              value={r.capacite}
              onChange={(e) => {
                const v = parseInt(e.target.value || "0", 10);
                if (r.id) update(r.id, "capacite", v); else updateByIndex(idx, "capacite", v);
              }}
            />
            <TextField
              size="small"
              type="number"
              value={r.tarif}
              onChange={(e) => {
                const v = parseInt(e.target.value || "0", 10);
                if (r.id) update(r.id, "tarif", v); else updateByIndex(idx, "tarif", v);
              }}
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button size="small" color="error" variant="outlined" onClick={() => removeRow(idx)}>Supprimer</Button>
            </Stack>
          </Box>
        ))}
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
          <Button variant="contained" onClick={handleValidate}>Valider</Button>
        </Stack>
      </Paper>
    </Box>
  );
}
