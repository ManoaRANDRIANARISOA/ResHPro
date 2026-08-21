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
  AccessTime,
  CheckCircle,
  Warning,
  Cancel,
  Today,
  Save,
  ChevronLeft,
  ChevronRight,
  FilterList,
} from "@mui/icons-material";
import {
  useEmployes,
  usePlanningShifts,
  usePointages,
  useSavePointage,
} from "@/services/api";
import { PointagePresence, Employe, PlanningShift } from "@shared/api";
import { format, parseISO, addDays, subDays } from "date-fns";
import { fr } from "date-fns/locale";

export function PointagesView() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const currentDateStr = format(currentDate, "yyyy-MM-dd");
  const currentMonth = format(currentDate, "yyyy-MM");

  const { data: employes = [] } = useEmployes();
  const { data: pointages = [], isLoading: isPointagesLoading } = usePointages(currentMonth);
  const { data: shifts = [] } = usePlanningShifts({
    dateDebut: currentDateStr,
    dateFin: currentDateStr,
  });

  const savePointage = useSavePointage();

  const [deptFilter, setDeptFilter] = useState<string>("all");

  // Local state for edits in the daily table
  const [dailyEntries, setDailyEntries] = useState<Record<string, Partial<PointagePresence>>>({});

  const activeEmployes = useMemo(() => {
    return employes.filter((e) => {
      const matchStatus = e.statut === "actif" || e.statut === "conge";
      const matchDept = deptFilter === "all" || e.departement === deptFilter;
      return matchStatus && matchDept;
    });
  }, [employes, deptFilter]);

  // Merge planned shifts and recorded pointages
  const pointageRows = useMemo(() => {
    return activeEmployes.map((emp) => {
      const recorded = pointages.find(
        (p) => p.employeId === emp.id && p.date === currentDateStr
      );
      const plannedShift = shifts.find(
        (s) => s.employeId === emp.id && s.date === currentDateStr
      );
      const local = dailyEntries[emp.id] || {};

      const heureArrivee = local.heureArriveeReelle ?? recorded?.heureArriveeReelle ?? plannedShift?.heureDebut ?? "08:00";
      const heureDepart = local.heureDepartReelle ?? recorded?.heureDepartReelle ?? plannedShift?.heureFin ?? "16:30";
      const statut = local.statut ?? recorded?.statut ?? (plannedShift?.type === "repos" ? "repos" : plannedShift?.type === "conge_paye" ? "en_conge" : "present");

      // Calculate hours
      let heuresNormales = 0;
      let heuresSup = 0;
      let retardMinutes = 0;

      if (heureArrivee && heureDepart && (statut === "present" || statut === "retard")) {
        const [h1, m1] = heureArrivee.split(":").map(Number);
        const [h2, m2] = heureDepart.split(":").map(Number);
        let start = h1 * 60 + m1;
        let end = h2 * 60 + m2;
        if (end < start) end += 24 * 60;
        const pauseMin = plannedShift?.pauseMinutes ?? 30;
        const workedHours = Math.max(0, (end - start - pauseMin) / 60);

        heuresNormales = Math.min(8, Math.round(workedHours * 10) / 10);
        heuresSup = Math.max(0, Math.round((workedHours - 8) * 10) / 10);

        if (plannedShift?.heureDebut && plannedShift.heureDebut !== "00:00") {
          const [ph1, pm1] = plannedShift.heureDebut.split(":").map(Number);
          const plannedStart = ph1 * 60 + pm1;
          if (start > plannedStart) {
            retardMinutes = start - plannedStart;
          }
        }
      }

      return {
        employe: emp,
        plannedShift,
        recorded,
        heureArrivee,
        heureDepart,
        heuresNormales,
        heuresSup,
        retardMinutes,
        statut,
      };
    });
  }, [activeEmployes, pointages, shifts, currentDateStr, dailyEntries]);

  function handleFieldChange(empId: string, field: keyof PointagePresence, value: any) {
    setDailyEntries((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: value,
      },
    }));
  }

  function handleSaveRow(row: any) {
    const payload: Partial<PointagePresence> & { employeId: string; date: string } = {
      employeId: row.employe.id,
      employeNom: `${row.employe.nom} ${row.employe.prenom}`.trim(),
      date: currentDateStr,
      heureArriveeReelle: row.heureArrivee,
      heureDepartReelle: row.heureDepart,
      heuresNormales: row.heuresNormales,
      heuresSup: row.heuresSup,
      retardMinutes: row.retardMinutes,
      statut: row.statut,
    };

    savePointage.mutate(payload, {
      onSuccess: () => {
        setDailyEntries((prev) => {
          const next = { ...prev };
          delete next[row.employe.id];
          return next;
        });
      },
    });
  }

  function handleSaveAll() {
    pointageRows.forEach((row) => {
      handleSaveRow(row);
    });
  }

  // Monthly stats
  const totalHsMois = pointages.reduce((acc, p) => acc + (p.heuresSup || 0), 0);
  const totalRetardsMois = pointages.filter((p) => (p.retardMinutes || 0) > 0).length;

  return (
    <Box>
      {/* HEADER & DATE SELECTOR */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems="center"
          justifyContent="space-between"
        >
          {/* NAVIGATION JOUR */}
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              onClick={() => setCurrentDate((prev) => subDays(prev, 1))}
              size="small"
              sx={{ bgcolor: "#f1f5f9" }}
            >
              <ChevronLeft />
            </IconButton>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Today />}
              onClick={() => setCurrentDate(new Date())}
              sx={{ fontWeight: 700 }}
            >
              Aujourd'hui
            </Button>
            <IconButton
              onClick={() => setCurrentDate((prev) => addDays(prev, 1))}
              size="small"
              sx={{ bgcolor: "#f1f5f9" }}
            >
              <ChevronRight />
            </IconButton>

            <Box sx={{ ml: 1 }}>
              <Typography variant="h6" fontWeight={800} color="#0f172a" textTransform="capitalize">
                {format(currentDate, "EEEE d MMMM yyyy", { locale: fr })}
              </Typography>
            </Box>
          </Stack>

          {/* ACTIONS & SAVE ALL */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSaveAll}
              disabled={savePointage.isPending}
              sx={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                fontWeight: 700,
              }}
            >
              {savePointage.isPending ? "Enregistrement..." : "Enregistrer la feuille du jour"}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* MONTHLY RECAP BADGES */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderLeft: "4px solid #10b981" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              PRÉSENTS AUJOURD'HUI
            </Typography>
            <Typography variant="h4" fontWeight={800} color="#0f172a" mt={0.5}>
              {pointageRows.filter((r) => r.statut === "present").length} / {activeEmployes.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderLeft: "4px solid #f59e0b" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              HEURES SUP CE MOIS ({format(currentDate, "MMMM", { locale: fr })})
            </Typography>
            <Typography variant="h4" fontWeight={800} color="#0f172a" mt={0.5}>
              {totalHsMois} h
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderLeft: "4px solid #ef4444" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              RETARDS SIGNALÉS CE MOIS
            </Typography>
            <Typography variant="h4" fontWeight={800} color="#0f172a" mt={0.5}>
              {totalRetardsMois}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* POINTAGES TABLE */}
      <Paper sx={{ width: "100%", overflow: "hidden", borderRadius: 3 }}>
        <TableContainer sx={{ maxHeight: 650 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Salarié</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Shift Planifié</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Arrivée Réelle</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Départ Réel</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>
                  Heures Effectives
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>
                  Heures Sup (HS)
                </TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Statut Pointage</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>
                  Action
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pointageRows.map((row) => (
                <TableRow key={row.employe.id} hover>
                  <TableCell>
                    <Typography fontWeight={700} color="#0f172a">
                      {row.employe.nom} {row.employe.prenom}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.employe.poste}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    {row.plannedShift ? (
                      <Chip
                        size="small"
                        label={
                          row.plannedShift.type === "repos"
                            ? "Repos"
                            : `${row.plannedShift.heureDebut} - ${row.plannedShift.heureFin}`
                        }
                        sx={{
                          fontWeight: 700,
                          bgcolor: row.plannedShift.type === "repos" ? "#f1f5f9" : "#e0e7ff",
                          color: row.plannedShift.type === "repos" ? "#64748b" : "#3730a3",
                        }}
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Non planifié
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <TextField
                      type="time"
                      size="small"
                      value={row.heureArrivee}
                      onChange={(e) =>
                        handleFieldChange(row.employe.id, "heureArriveeReelle", e.target.value)
                      }
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: 120 }}
                    />
                  </TableCell>

                  <TableCell>
                    <TextField
                      type="time"
                      size="small"
                      value={row.heureDepart}
                      onChange={(e) =>
                        handleFieldChange(row.employe.id, "heureDepartReelle", e.target.value)
                      }
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: 120 }}
                    />
                  </TableCell>

                  <TableCell align="center">
                    <Typography fontWeight={800} color="#0f172a">
                      {row.heuresNormales} h
                    </Typography>
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={`+${row.heuresSup} h`}
                      sx={{
                        fontWeight: 700,
                        bgcolor: row.heuresSup > 0 ? "#fef3c7" : "#f1f5f9",
                        color: row.heuresSup > 0 ? "#92400e" : "#94a3b8",
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    <Select
                      size="small"
                      value={row.statut}
                      onChange={(e) =>
                        handleFieldChange(row.employe.id, "statut", e.target.value)
                      }
                      sx={{ minWidth: 140, fontSize: "0.85rem" }}
                    >
                      <MenuItem value="present">✓ Présent</MenuItem>
                      <MenuItem value="retard">⚠️ Retard</MenuItem>
                      <MenuItem value="absent_justifie">Absent (Justifié)</MenuItem>
                      <MenuItem value="absent_injustifie">Absent (Injustifié)</MenuItem>
                      <MenuItem value="en_conge">En congé</MenuItem>
                      <MenuItem value="repos">Repos</MenuItem>
                    </Select>
                  </TableCell>

                  <TableCell align="center">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleSaveRow(row)}
                      sx={{ minWidth: 80, fontWeight: 700 }}
                    >
                      Sauver
                    </Button>
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
