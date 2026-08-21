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
  Print,
  Delete,
  Edit,
  CheckCircle,
  FileDownload,
  Autorenew,
  ReceiptLong,
  Payment,
  AccountBalanceWallet,
  AttachMoney,
  PhoneIphone,
  AccountBalance,
} from "@mui/icons-material";
import {
  useEmployes,
  useBulletinsPaie,
  useAvancesSalaire,
  usePointages,
  useGenerateBulletinsBatch,
  useUpdateBulletinPaie,
  useDeleteBulletinPaie,
  useCreateBulletinPaie,
} from "@/services/api";
import { useTenant } from "@/contexts/TenantContext";
import { BulletinPaie, Employe, PrimeItem, ModePaiementSalaire } from "@shared/api";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { printBulletinPaiePro, printLivreDePaie, exportToCSV } from "@/lib/export";

export function PaieView() {
  const { tenantConfig, publicConfig, config } = useTenant() as any;
  const tenantData = { ...publicConfig, ...config };

  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(new Date(), "yyyy-MM")
  );

  const { data: employes = [] } = useEmployes();
  const { data: bulletins = [], isLoading } = useBulletinsPaie(selectedMonth);
  const { data: avances = [] } = useAvancesSalaire(selectedMonth);
  const { data: pointages = [] } = usePointages(selectedMonth);

  const generateBatch = useGenerateBulletinsBatch();
  const updateBulletin = useUpdateBulletinPaie();
  const deleteBulletin = useDeleteBulletinPaie();

  // Edit Modal State
  const [editingBulletin, setEditingBulletin] = useState<BulletinPaie | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredBulletins = useMemo(() => {
    return bulletins.filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (b.employeNom && b.employeNom.toLowerCase().includes(q)) ||
        (b.numero && b.numero.toLowerCase().includes(q)) ||
        (b.employeMatricule && b.employeMatricule.toLowerCase().includes(q)) ||
        (b.poste && b.poste.toLowerCase().includes(q));
      const matchStatus = statusFilter === "all" || b.statut === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [bulletins, searchQuery, statusFilter]);

  // Totals & KPIs
  const totalSalaries = bulletins.length;
  const totalBrut = bulletins.reduce((acc, b) => acc + (b.salaireBrut || 0), 0);
  const totalCotisations = bulletins.reduce((acc, b) => acc + (b.totalCotisationsSalariales || 0), 0);
  const totalIrsa = bulletins.reduce((acc, b) => acc + (b.irsa || 0), 0);
  const totalAvances = bulletins.reduce((acc, b) => acc + (b.avancesDeduites || 0), 0);
  const totalNet = bulletins.reduce((acc, b) => acc + (b.salaireNet || 0), 0);

  function handleBatchGenerate() {
    if (
      window.confirm(
        `Voulez-vous générer automatiquement les fiches de paie pour tous les salariés actifs pour le mois de ${selectedMonth} ?`
      )
    ) {
      generateBatch.mutate(
        {
          periode: selectedMonth,
          employes,
          avances,
          pointages,
        },
        {
          onSuccess: (generated) => {
            alert(`Génération terminée : ${generated.length} fiches de paie générées pour ${selectedMonth}.`);
          },
          onError: (err: any) => {
            alert(err?.message || "Erreur lors de la génération des bulletins.");
          },
        }
      );
    }
  }

  function handlePrintLivreDePaie() {
    printLivreDePaie(selectedMonth, bulletins, tenantData);
  }

  function handleExportCSV() {
    const csvData = bulletins.map((b) => ({
      Référence: b.numero,
      Salarié: b.employeNom,
      Matricule: b.employeMatricule,
      Poste: b.poste,
      Département: b.departement,
      "Salaire Base": b.salaireBase,
      "Heures Sup": b.montantHeuresSup || 0,
      Primes: b.totalPrimes || 0,
      "Salaire Brut": b.salaireBrut,
      Cotisations: b.totalCotisationsSalariales,
      IRSA: b.irsa,
      "Avances Déduites": b.avancesDeduites,
      "Salaire Net": b.salaireNet,
      "Mode Règlement": b.modePaiement,
      Statut: b.statut,
    }));
    exportToCSV(csvData, `Livre_De_Paie_${selectedMonth}`);
  }

  function handlePrintIndividual(b: BulletinPaie) {
    const emp = employes.find((e) => e.id === b.employeId);
    printBulletinPaiePro(b, tenantData, emp);
  }

  function handleMarkAsPaid(b: BulletinPaie) {
    updateBulletin.mutate({
      id: b.id,
      statut: "paye",
      datePaiement: new Date().toISOString(),
    });
  }

  function handleDelete(id: string) {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce bulletin de paie ?")) {
      deleteBulletin.mutate(id);
    }
  }

  function handleOpenEdit(b: BulletinPaie) {
    setEditingBulletin({ ...b });
    setModalOpen(true);
  }

  function handleSaveBulletinEdit() {
    if (!editingBulletin) return;

    // Recalculate Totals
    const totalPrimes = (editingBulletin.primes || []).reduce((acc, p) => acc + (p.montant || 0), 0);
    const salaireBrut = editingBulletin.salaireBase + (editingBulletin.montantHeuresSup || 0) + totalPrimes;
    
    // Recalculate Cotisations
    const cotisations = (editingBulletin.cotisationsSalariales || []).map(c => ({
      ...c,
      base: salaireBrut,
      montant: Math.round(salaireBrut * (c.taux / 100))
    }));
    const totalCotisations = cotisations.reduce((acc, c) => acc + c.montant, 0);

    const totalRetenues = totalCotisations + (editingBulletin.irsa || 0) + (editingBulletin.avancesDeduites || 0) + (editingBulletin.retenuesAbsences || 0) + (editingBulletin.autresRetenues || 0);
    const salaireNet = Math.max(0, salaireBrut - totalRetenues);

    const updatedData: Partial<BulletinPaie> = {
      ...editingBulletin,
      primes: editingBulletin.primes,
      totalPrimes,
      salaireBrut,
      cotisationsSalariales: cotisations,
      totalCotisationsSalariales: totalCotisations,
      totalRetenues,
      salaireNet,
    };

    updateBulletin.mutate(
      { id: editingBulletin.id, ...updatedData },
      {
        onSuccess: () => setModalOpen(false),
      }
    );
  }

  function handleAddPrime() {
    if (!editingBulletin) return;
    const newPrime: PrimeItem = {
      id: String(Date.now()),
      nom: "Prime exceptionnelle",
      montant: 20000,
      type: "variable",
    };
    setEditingBulletin({
      ...editingBulletin,
      primes: [...(editingBulletin.primes || []), newPrime],
    });
  }

  function handleRemovePrime(index: number) {
    if (!editingBulletin) return;
    const nextPrimes = [...(editingBulletin.primes || [])];
    nextPrimes.splice(index, 1);
    setEditingBulletin({ ...editingBulletin, primes: nextPrimes });
  }

  function handlePrimeChange(index: number, field: keyof PrimeItem, value: any) {
    if (!editingBulletin) return;
    const nextPrimes = [...(editingBulletin.primes || [])];
    nextPrimes[index] = { ...nextPrimes[index], [field]: value };
    setEditingBulletin({ ...editingBulletin, primes: nextPrimes });
  }

  return (
    <Box>
      {/* KPI METRIC CARDS */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderLeft: "4px solid #4f46e5" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              SALARIÉS TRAITÉS
            </Typography>
            <Typography variant="h4" fontWeight={800} color="#0f172a" mt={0.5}>
              {totalSalaries}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Pour {selectedMonth}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderLeft: "4px solid #06b6d4" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              MASSE SALARIALE BRUTE
            </Typography>
            <Typography variant="h5" fontWeight={800} color="#0f172a" mt={0.5}>
              {totalBrut.toLocaleString("fr-FR")} Ar
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Base + HS + Primes
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderLeft: "4px solid #f59e0b" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              CHARGES & IRSA
            </Typography>
            <Typography variant="h5" fontWeight={800} color="#92400e" mt={0.5}>
              {(totalCotisations + totalIrsa).toLocaleString("fr-FR")} Ar
            </Typography>
            <Typography variant="caption" color="text.secondary">
              CNaPS, OSTIE & Impôt
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderLeft: "4px solid #ef4444" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              ACOMPTES DÉDUITS
            </Typography>
            <Typography variant="h5" fontWeight={800} color="#991b1b" mt={0.5}>
              {totalAvances.toLocaleString("fr-FR")} Ar
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Avances sur salaire
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Paper sx={{ p: 2, borderLeft: "4px solid #10b981", bgcolor: "#f0fdf4" }}>
            <Typography variant="caption" color="#166534" fontWeight={800}>
              TOTAL NET À PAYER
            </Typography>
            <Typography variant="h5" fontWeight={800} color="#166534" mt={0.5}>
              {totalNet.toLocaleString("fr-FR")} Ar
            </Typography>
            <Typography variant="caption" color="#166534">
              À débourser en trésorerie
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* CONTROLS & ACTIONS TOOLBAR */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          alignItems="center"
          justifyContent="space-between"
        >
          {/* MONTH SELECTOR & SEARCH */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center" flexWrap="wrap" gap={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography fontWeight={800} color="#0f172a">
                Mois :
              </Typography>
              <TextField
                type="month"
                size="small"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                sx={{ width: 170 }}
              />
            </Stack>

            <TextField
              placeholder="Rechercher salarié, réf, matricule..."
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ width: { xs: "100%", sm: 220 } }}
            />

            <Select
              size="small"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ width: 130 }}
            >
              <MenuItem value="all">Tous statuts</MenuItem>
              <MenuItem value="brouillon">Brouillons</MenuItem>
              <MenuItem value="valide">Validés</MenuItem>
              <MenuItem value="paye">Payés</MenuItem>
            </Select>
          </Stack>

          {/* ACTIONS */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
            <Button
              variant="outlined"
              startIcon={<Print />}
              onClick={handlePrintLivreDePaie}
              disabled={bulletins.length === 0}
              sx={{ fontWeight: 700 }}
            >
              Livre de Paie (A4)
            </Button>

            <Button
              variant="outlined"
              startIcon={<FileDownload />}
              onClick={handleExportCSV}
              disabled={bulletins.length === 0}
              sx={{ fontWeight: 700 }}
            >
              Export CSV
            </Button>

            <Button
              variant="contained"
              startIcon={<Autorenew />}
              onClick={handleBatchGenerate}
              disabled={generateBatch.isPending}
              sx={{
                background: "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)",
                fontWeight: 700,
              }}
            >
              {generateBatch.isPending
                ? "Calcul en cours..."
                : "⚡ Générer les bulletins du mois"}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* PAYROLL BULLETINS TABLE */}
      <Paper sx={{ width: "100%", overflow: "hidden", borderRadius: 3 }}>
        <TableContainer sx={{ maxHeight: 650 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Réf Bulletin</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Salarié</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Poste / Dépt</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>
                  Salaire Base
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>
                  HS / Primes
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>
                  Salaire Brut
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>
                  Cotis. + IRSA
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>
                  Acomptes
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, bgcolor: "#f8fafc" }}>
                  Net à Payer (Ar)
                </TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Règlement</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>
                  Statut
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredBulletins.map((b) => {
                const totalHsPrimes = (b.montantHeuresSup || 0) + (b.totalPrimes || 0);
                const totalCharges = (b.totalCotisationsSalariales || 0) + (b.irsa || 0);

                return (
                  <TableRow key={b.id} hover>
                    <TableCell>
                      <Chip
                        size="small"
                        label={b.numero}
                        sx={{ fontWeight: 800, bgcolor: "#f1f5f9", color: "#334155" }}
                      />
                    </TableCell>

                    <TableCell>
                      <Typography fontWeight={700} color="#0f172a">
                        {b.employeNom}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {b.employeMatricule}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" fontWeight={600} color="#334155">
                        {b.poste}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" textTransform="capitalize">
                        {b.departement}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Typography variant="body2">
                        {b.salaireBase.toLocaleString("fr-FR")} Ar
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Typography variant="body2" color={totalHsPrimes > 0 ? "success.main" : "text.secondary"}>
                        {totalHsPrimes > 0 ? `+${totalHsPrimes.toLocaleString("fr-FR")}` : "—"}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Typography fontWeight={700} color="#0f172a">
                        {b.salaireBrut.toLocaleString("fr-FR")} Ar
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Typography variant="body2" color="error.main">
                        -{totalCharges.toLocaleString("fr-FR")}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Typography variant="body2" color={b.avancesDeduites > 0 ? "error.main" : "text.secondary"}>
                        {b.avancesDeduites > 0 ? `-${b.avancesDeduites.toLocaleString("fr-FR")}` : "—"}
                      </Typography>
                    </TableCell>

                    <TableCell align="right" sx={{ bgcolor: "#f0fdf4" }}>
                      <Typography fontWeight={800} color="#166534" fontSize="0.95rem">
                        {b.salaireNet.toLocaleString("fr-FR")} Ar
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {b.modePaiement === "mobile_money" ? (
                          <PhoneIphone sx={{ fontSize: 16, color: "#0284c7" }} />
                        ) : b.modePaiement === "virement" ? (
                          <AccountBalance sx={{ fontSize: 16, color: "#4f46e5" }} />
                        ) : (
                          <Payment sx={{ fontSize: 16, color: "#16a34a" }} />
                        )}
                        <Typography variant="caption" fontWeight={600} textTransform="capitalize">
                          {b.modePaiement.replace("_", " ")}
                        </Typography>
                      </Stack>
                    </TableCell>

                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={b.statut === "paye" ? "✓ Payé" : "Brouillon"}
                        sx={{
                          fontWeight: 700,
                          bgcolor: b.statut === "paye" ? "#dcfce7" : "#fef3c7",
                          color: b.statut === "paye" ? "#166534" : "#92400e",
                        }}
                      />
                    </TableCell>

                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Tooltip title="Imprimer le Bulletin de Paie officiel (A4)">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handlePrintIndividual(b)}
                          >
                            <Print fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Modifier primes / ajustements">
                          <IconButton size="small" onClick={() => handleOpenEdit(b)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        {b.statut !== "paye" && (
                          <Tooltip title="Marquer comme payé">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleMarkAsPaid(b)}
                            >
                              <CheckCircle fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}

                        <Tooltip title="Supprimer">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(b.id)}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}

              {bulletins.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary" fontWeight={600} mb={1}>
                      Aucun bulletin de paie généré pour ce mois.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Autorenew />}
                      onClick={handleBatchGenerate}
                      disabled={generateBatch.isPending || employes.length === 0}
                    >
                      Générer les bulletins de paie maintenant
                    </Button>
                  </TableCell>
                </TableRow>
              )}

              {bulletins.length > 0 && filteredBulletins.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary" fontWeight={600}>
                      Aucun bulletin ne correspond à vos critères de recherche.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* EDIT BULLETIN MODAL */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          Ajustement du Bulletin : {editingBulletin?.numero} — {editingBulletin?.employeNom}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          {editingBulletin && (
            <Stack spacing={3}>
              {/* SALAIRE DE BASE & HEURES SUP */}
              <Box>
                <Typography variant="subtitle2" fontWeight={800} color="primary" mb={1.5}>
                  1. SALAIRE DE BASE & HEURES SUPPLÉMENTAIRES
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Salaire de Base (Ar)"
                      type="number"
                      size="small"
                      fullWidth
                      value={editingBulletin.salaireBase}
                      onChange={(e) =>
                        setEditingBulletin({
                          ...editingBulletin,
                          salaireBase: Number(e.target.value),
                        })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Montant Heures Sup (Ar)"
                      type="number"
                      size="small"
                      fullWidth
                      value={editingBulletin.montantHeuresSup || 0}
                      onChange={(e) =>
                        setEditingBulletin({
                          ...editingBulletin,
                          montantHeuresSup: Number(e.target.value),
                        })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Impôt IRSA (Ar)"
                      type="number"
                      size="small"
                      fullWidth
                      value={editingBulletin.irsa || 0}
                      onChange={(e) =>
                        setEditingBulletin({
                          ...editingBulletin,
                          irsa: Number(e.target.value),
                        })
                      }
                    />
                  </Grid>
                </Grid>
              </Box>

              <Divider />

              {/* PRIMES & INDEMNITÉS */}
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                  <Typography variant="subtitle2" fontWeight={800} color="primary">
                    2. PRIMES & INDEMNITÉS
                  </Typography>
                  <Button size="small" startIcon={<Add />} onClick={handleAddPrime}>
                    Ajouter une prime
                  </Button>
                </Stack>

                {(editingBulletin.primes || []).map((prime, idx) => (
                  <Grid container spacing={2} key={prime.id || idx} mb={1.5} alignItems="center">
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Nom de la prime"
                        placeholder="Ex: Prime assiduité, Prime panier, Pourboire"
                        size="small"
                        fullWidth
                        value={prime.nom}
                        onChange={(e) => handlePrimeChange(idx, "nom", e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={5}>
                      <TextField
                        label="Montant (Ar)"
                        type="number"
                        size="small"
                        fullWidth
                        value={prime.montant}
                        onChange={(e) => handlePrimeChange(idx, "montant", Number(e.target.value))}
                      />
                    </Grid>
                    <Grid item xs={12} sm={1}>
                      <IconButton size="small" color="error" onClick={() => handleRemovePrime(idx)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Grid>
                  </Grid>
                ))}

                {(editingBulletin.primes || []).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Aucune prime attribuée sur ce bulletin.
                  </Typography>
                )}
              </Box>

              <Divider />

              {/* DÉDUCTIONS D'ACOMPTES & AUTRES RETENUES */}
              <Box>
                <Typography variant="subtitle2" fontWeight={800} color="primary" mb={1.5}>
                  3. RETENUES & ACOMPTES
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Avances déduites sur ce mois (Ar)"
                      type="number"
                      size="small"
                      fullWidth
                      value={editingBulletin.avancesDeduites || 0}
                      onChange={(e) =>
                        setEditingBulletin({
                          ...editingBulletin,
                          avancesDeduites: Number(e.target.value),
                        })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Retenues pour absences / retards (Ar)"
                      type="number"
                      size="small"
                      fullWidth
                      value={editingBulletin.retenuesAbsences || 0}
                      onChange={(e) =>
                        setEditingBulletin({
                          ...editingBulletin,
                          retenuesAbsences: Number(e.target.value),
                        })
                      }
                    />
                  </Grid>
                </Grid>
              </Box>

              <Divider />

              {/* MODALITÉS & STATUT */}
              <Box>
                <Typography variant="subtitle2" fontWeight={800} color="primary" mb={1.5}>
                  4. STATUT & RÈGLEMENT
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      label="Statut du paiement"
                      size="small"
                      fullWidth
                      value={editingBulletin.statut}
                      onChange={(e) =>
                        setEditingBulletin({
                          ...editingBulletin,
                          statut: e.target.value as BulletinPaie["statut"],
                        })
                      }
                    >
                      <MenuItem value="brouillon">Brouillon (Non réglé)</MenuItem>
                      <MenuItem value="valide">Validé (Prêt à payer)</MenuItem>
                      <MenuItem value="paye">Payé (Règlement effectué)</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      label="Mode de paiement"
                      size="small"
                      fullWidth
                      value={editingBulletin.modePaiement}
                      onChange={(e) =>
                        setEditingBulletin({
                          ...editingBulletin,
                          modePaiement: e.target.value as ModePaiementSalaire,
                        })
                      }
                    >
                      <MenuItem value="mobile_money">Mobile Money (MVola / Orange / Airtel)</MenuItem>
                      <MenuItem value="especes">Espèces (Contre décharge)</MenuItem>
                      <MenuItem value="virement">Virement Bancaire</MenuItem>
                      <MenuItem value="cheque">Chèque bancaire</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setModalOpen(false)} color="inherit">
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveBulletinEdit}
            disabled={updateBulletin.isPending}
            sx={{ fontWeight: 700 }}
          >
            Enregistrer les ajustements
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
