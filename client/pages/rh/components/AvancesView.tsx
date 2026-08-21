import React, { useState, useMemo } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add,
  CheckCircle,
  Cancel,
  Delete,
  Payment,
  AccountBalanceWallet,
  PhoneIphone,
  AccountBalance,
} from "@mui/icons-material";
import {
  useEmployes,
  useAvancesSalaire,
  useCreateAvanceSalaire,
  useUpdateAvanceSalaire,
  useDeleteAvanceSalaire,
} from "@/services/api";
import { AvanceSalaire, Employe, ModePaiementSalaire } from "@shared/api";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function AvancesView() {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(new Date(), "yyyy-MM")
  );

  const { data: employes = [] } = useEmployes();
  const { data: avances = [], isLoading } = useAvancesSalaire(selectedMonth);

  const createAvance = useCreateAvanceSalaire();
  const updateAvance = useUpdateAvanceSalaire();
  const deleteAvance = useDeleteAvanceSalaire();

  const [modalOpen, setModalOpen] = useState(false);

  const initialForm: Omit<AvanceSalaire, "id"> = {
    employeId: "",
    employeNom: "",
    moisConcerne: selectedMonth,
    dateDemande: new Date().toISOString().split("T")[0],
    dateVersement: new Date().toISOString().split("T")[0],
    montant: 50000,
    motif: "Avance fête / besoin personnel",
    statut: "approuve",
    modeVersement: "mobile_money",
    referencePaiement: "",
    notes: "",
  };

  const [form, setForm] = useState<Omit<AvanceSalaire, "id">>(initialForm);

  // Totals
  const totalDemande = avances.reduce((acc, a) => acc + (a.montant || 0), 0);
  const totalApprouve = avances
    .filter((a) => a.statut === "approuve" || a.statut === "deduit")
    .reduce((acc, a) => acc + (a.montant || 0), 0);
  const totalDeduit = avances
    .filter((a) => a.statut === "deduit")
    .reduce((acc, a) => acc + (a.montant || 0), 0);

  function handleOpenCreate() {
    const firstEmp = employes[0];
    setForm({
      ...initialForm,
      employeId: firstEmp?.id || "",
      employeNom: firstEmp ? `${firstEmp.nom} ${firstEmp.prenom}`.trim() : "",
      modeVersement: firstEmp?.modePaiement || "mobile_money",
      moisConcerne: selectedMonth,
    });
    setModalOpen(true);
  }

  function handleCreate() {
    if (!form.employeId || !form.montant) return;
    createAvance.mutate(form, {
      onSuccess: () => setModalOpen(false),
    });
  }

  function handleUpdateStatut(id: string, statut: AvanceSalaire["statut"]) {
    updateAvance.mutate({ id, statut });
  }

  function handleDelete(id: string) {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette demande d'avance ?")) {
      deleteAvance.mutate(id);
    }
  }

  return (
    <Box>
      {/* KPI STATS */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderLeft: "4px solid #4f46e5" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              TOTAL DEMANDES CE MOIS
            </Typography>
            <Typography variant="h4" fontWeight={800} color="#0f172a" mt={0.5}>
              {totalDemande.toLocaleString("fr-FR")} Ar
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {avances.length} demandes enregistrées
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderLeft: "4px solid #10b981" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              AVANCES VALIDÉES / VERSÉES
            </Typography>
            <Typography variant="h4" fontWeight={800} color="#166534" mt={0.5}>
              {totalApprouve.toLocaleString("fr-FR")} Ar
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Montant total déboursé
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderLeft: "4px solid #0284c7" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              DÉDUIT SUR LES FICHES DE PAIE
            </Typography>
            <Typography variant="h4" fontWeight={800} color="#0369a1" mt={0.5}>
              {totalDeduit.toLocaleString("fr-FR")} Ar
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Imputé sur les bulletins émis
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* CONTROLS */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography fontWeight={700} color="#0f172a">
              Mois concerné :
            </Typography>
            <TextField
              type="month"
              size="small"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              sx={{ width: 180 }}
            />
          </Stack>

          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpenCreate}
            sx={{
              background: "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)",
              fontWeight: 700,
            }}
          >
            Nouvelle demande d'avance
          </Button>
        </Stack>
      </Paper>

      {/* AVANCES TABLE */}
      <Paper sx={{ width: "100%", overflow: "hidden", borderRadius: 3 }}>
        <TableContainer sx={{ maxHeight: 620 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Salarié</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>
                  Montant (Ar)
                </TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Motif</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Date Demande</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Mode Versement</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Réf / Reçu</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>
                  Statut
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {avances.map((av) => (
                <TableRow key={av.id} hover>
                  <TableCell>
                    <Typography fontWeight={700} color="#0f172a">
                      {av.employeNom}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">
                    <Typography fontWeight={800} color="#4f46e5" fontSize="0.95rem">
                      {av.montant.toLocaleString("fr-FR")} Ar
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" color="#334155">
                      {av.motif}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {av.dateDemande}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {av.modeVersement === "mobile_money" ? (
                        <PhoneIphone sx={{ fontSize: 16, color: "#0284c7" }} />
                      ) : av.modeVersement === "virement" ? (
                        <AccountBalance sx={{ fontSize: 16, color: "#4f46e5" }} />
                      ) : (
                        <Payment sx={{ fontSize: 16, color: "#16a34a" }} />
                      )}
                      <Typography variant="body2" textTransform="capitalize" fontWeight={600}>
                        {av.modeVersement.replace("_", " ")}
                      </Typography>
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {av.referencePaiement || "—"}
                    </Typography>
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={
                        av.statut === "deduit"
                          ? "✓ Déduit en paie"
                          : av.statut === "approuve"
                          ? "✓ Approuvé"
                          : av.statut === "refuse"
                          ? "Refusé"
                          : "En attente"
                      }
                      sx={{
                        fontWeight: 700,
                        bgcolor:
                          av.statut === "deduit"
                            ? "#e0f2fe"
                            : av.statut === "approuve"
                            ? "#dcfce7"
                            : av.statut === "refuse"
                            ? "#fee2e2"
                            : "#fef3c7",
                        color:
                          av.statut === "deduit"
                            ? "#0369a1"
                            : av.statut === "approuve"
                            ? "#166534"
                            : av.statut === "refuse"
                            ? "#991b1b"
                            : "#92400e",
                      }}
                    />
                  </TableCell>

                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      {av.statut === "en_attente" && (
                        <>
                          <Tooltip title="Approuver l'acompte">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleUpdateStatut(av.id, "approuve")}
                            >
                              <CheckCircle fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Refuser">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleUpdateStatut(av.id, "refuse")}
                            >
                              <Cancel fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}

                      <Tooltip title="Supprimer">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(av.id)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}

              {avances.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary" fontWeight={600}>
                      Aucune avance sur salaire enregistrée pour ce mois.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* CREATE MODAL */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          Demande d'avance sur salaire
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.5}>
            <TextField
              select
              label="Salarié bénéficiaire"
              required
              fullWidth
              size="small"
              value={form.employeId}
              onChange={(e) => {
                const emp = employes.find((em) => em.id === e.target.value);
                setForm({
                  ...form,
                  employeId: e.target.value,
                  employeNom: emp ? `${emp.nom} ${emp.prenom}`.trim() : "",
                  modeVersement: emp?.modePaiement || form.modeVersement,
                });
              }}
            >
              {employes.map((emp) => (
                <MenuItem key={emp.id} value={emp.id}>
                  {emp.nom} {emp.prenom} (Salaire Base: {emp.salaireBase.toLocaleString()} Ar)
                </MenuItem>
              ))}
            </TextField>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Montant de l'avance (Ar)"
                  type="number"
                  required
                  fullWidth
                  size="small"
                  value={form.montant}
                  onChange={(e) => setForm({ ...form, montant: Number(e.target.value) })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Mois d'imputation"
                  type="month"
                  required
                  fullWidth
                  size="small"
                  value={form.moisConcerne}
                  onChange={(e) => setForm({ ...form, moisConcerne: e.target.value })}
                />
              </Grid>
            </Grid>

            <TextField
              label="Motif / Justification"
              required
              fullWidth
              size="small"
              value={form.motif}
              onChange={(e) => setForm({ ...form, motif: e.target.value })}
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Mode de versement"
                  fullWidth
                  size="small"
                  value={form.modeVersement}
                  onChange={(e) =>
                    setForm({ ...form, modeVersement: e.target.value as ModePaiementSalaire })
                  }
                >
                  <MenuItem value="mobile_money">Mobile Money (MVola / Orange / Airtel)</MenuItem>
                  <MenuItem value="especes">Espèces (Contre décharge)</MenuItem>
                  <MenuItem value="virement">Virement Bancaire</MenuItem>
                  <MenuItem value="cheque">Chèque bancaire</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Référence du transfert / Reçu"
                  placeholder="Ex: Réf MVola #987654"
                  fullWidth
                  size="small"
                  value={form.referencePaiement || ""}
                  onChange={(e) => setForm({ ...form, referencePaiement: e.target.value })}
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setModalOpen(false)} color="inherit">
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!form.employeId || !form.montant || createAvance.isPending}
            sx={{ fontWeight: 700 }}
          >
            Enregistrer l'avance
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
