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
  ToggleButton,
  ToggleButtonGroup,
  Avatar,
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
  CalendarViewMonth,
  CalendarViewWeek,
  CalendarViewDay,
  EventBusy,
  Timer,
  AssignmentTurnedIn,
} from "@mui/icons-material";
import {
  useEmployes,
  usePlanningShifts,
  usePointages,
  useSavePointage,
} from "@/services/api";
import { PointagePresence, Employe, PlanningShift } from "@shared/api";
import {
  format,
  parseISO,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  subWeeks,
  addWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  eachDayOfInterval,
} from "date-fns";
import { fr } from "date-fns/locale";

export function PointagesView() {
  // Mode de Vue : "day" | "week" | "month"
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");

  // Date de référence
  const [dateRef, setDateRef] = useState<Date>(new Date());

  const currentMonthStr = format(dateRef, "yyyy-MM");
  const currentDateStr = format(dateRef, "yyyy-MM-dd");

  const { data: employes = [] } = useEmployes();
  const { data: pointages = [], isLoading: isPointagesLoading } = usePointages(currentMonthStr);

  // Shifts selon le mode
  const { startDateStr, endDateStr, titleLabel } = useMemo(() => {
    if (viewMode === "month") {
      const mStart = startOfMonth(dateRef);
      const mEnd = endOfMonth(dateRef);
      return {
        startDateStr: format(mStart, "yyyy-MM-dd"),
        endDateStr: format(mEnd, "yyyy-MM-dd"),
        titleLabel: format(dateRef, "MMMM yyyy", { locale: fr }),
      };
    } else if (viewMode === "week") {
      const monday = startOfWeek(dateRef, { weekStartsOn: 1 });
      const sunday = addDays(monday, 6);
      return {
        startDateStr: format(monday, "yyyy-MM-dd"),
        endDateStr: format(sunday, "yyyy-MM-dd"),
        titleLabel: `Semaine du ${format(monday, "d MMMM", { locale: fr })} au ${format(sunday, "d MMMM yyyy", { locale: fr })}`,
      };
    } else {
      // Day
      return {
        startDateStr: currentDateStr,
        endDateStr: currentDateStr,
        titleLabel: format(dateRef, "EEEE d MMMM yyyy", { locale: fr }),
      };
    }
  }, [viewMode, dateRef, currentDateStr]);

  const { data: shifts = [] } = usePlanningShifts({
    dateDebut: startDateStr,
    dateFin: endDateStr,
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

  // Jours de la semaine pour la vue Semaine
  const daysOfWeek = useMemo(() => {
    const monday = startOfWeek(dateRef, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i);
      return {
        date: d,
        dateStr: format(d, "yyyy-MM-dd"),
        dayShort: format(d, "EEE", { locale: fr }).toUpperCase(),
        dayNum: format(d, "d MMM", { locale: fr }),
        isToday: format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"),
      };
    });
  }, [dateRef]);

  // Navigation temporelle
  function handlePrev() {
    if (viewMode === "month") setDateRef((prev) => subMonths(prev, 1));
    else if (viewMode === "week") setDateRef((prev) => subWeeks(prev, 1));
    else setDateRef((prev) => subDays(prev, 1));
  }

  function handleNext() {
    if (viewMode === "month") setDateRef((prev) => addMonths(prev, 1));
    else if (viewMode === "week") setDateRef((prev) => addWeeks(prev, 1));
    else setDateRef((prev) => addDays(prev, 1));
  }

  function handleToday() {
    setDateRef(new Date());
  }

  // Merge planned shifts and recorded pointages for Daily View
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
      {/* HEADER & CONTROLS */}
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3, border: "1px solid #e2e8f0" }}>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          alignItems={{ xs: "flex-start", lg: "center" }}
          justifyContent="space-between"
        >
          {/* SÉLECTEUR DE VUE & NAVIGATION */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center" flexWrap="wrap">
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, next) => next && setViewMode(next)}
              size="small"
              sx={{ bgcolor: "#f1f5f9", p: 0.3, borderRadius: 2 }}
            >
              <ToggleButton value="day" sx={{ fontWeight: 700, textTransform: "none", px: 1.5 }}>
                <CalendarViewDay fontSize="small" sx={{ mr: 0.5 }} /> Jour
              </ToggleButton>
              <ToggleButton value="week" sx={{ fontWeight: 700, textTransform: "none", px: 1.5 }}>
                <CalendarViewWeek fontSize="small" sx={{ mr: 0.5 }} /> Semaine
              </ToggleButton>
              <ToggleButton value="month" sx={{ fontWeight: 700, textTransform: "none", px: 1.5 }}>
                <CalendarViewMonth fontSize="small" sx={{ mr: 0.5 }} /> Mois
              </ToggleButton>
            </ToggleButtonGroup>

            <Stack direction="row" spacing={0.8} alignItems="center">
              <IconButton onClick={handlePrev} size="small" sx={{ bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <ChevronLeft />
              </IconButton>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Today />}
                onClick={handleToday}
                sx={{ fontWeight: 700, textTransform: "none" }}
              >
                Aujourd'hui
              </Button>
              <IconButton onClick={handleNext} size="small" sx={{ bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <ChevronRight />
              </IconButton>

              <Typography variant="subtitle1" fontWeight={800} color="#0f172a" textTransform="capitalize" sx={{ pl: 1 }}>
                {titleLabel}
              </Typography>
            </Stack>
          </Stack>

          {/* ACTIONS */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <Select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                displayEmpty
              >
                <MenuItem value="all">Tous départements</MenuItem>
                <MenuItem value="restaurant">Restaurant & Salle</MenuItem>
                <MenuItem value="cuisine">Cuisine</MenuItem>
                <MenuItem value="hebergement">Hébergement</MenuItem>
                <MenuItem value="bar">Bar</MenuItem>
                <MenuItem value="reception">Réception</MenuItem>
                <MenuItem value="economat">Économat</MenuItem>
                <MenuItem value="direction">Direction</MenuItem>
              </Select>
            </FormControl>

            {viewMode === "day" && (
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSaveAll}
                disabled={savePointage.isPending}
                sx={{
                  bgcolor: "#10b981",
                  fontWeight: 700,
                  textTransform: "none",
                  "&:hover": { bgcolor: "#059669" },
                }}
              >
                {savePointage.isPending ? "Enregistrement..." : "Enregistrer la feuille du jour"}
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* STATS RECAP */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderRadius: 2.5, borderLeft: "4px solid #10b981", bgcolor: "#ffffff" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
              {viewMode === "day" ? "Présents Aujourd'hui" : "Collaborateurs Actifs"}
            </Typography>
            <Typography variant="h4" fontWeight={900} color="#0f172a" mt={0.5}>
              {viewMode === "day" ? `${pointageRows.filter((r) => r.statut === "present").length} / ${activeEmployes.length}` : activeEmployes.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderRadius: 2.5, borderLeft: "4px solid #f59e0b", bgcolor: "#ffffff" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
              Heures Supplémentaires (Mois)
            </Typography>
            <Typography variant="h4" fontWeight={900} color="#b45309" mt={0.5}>
              {totalHsMois} h
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, borderRadius: 2.5, borderLeft: "4px solid #ef4444", bgcolor: "#ffffff" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase">
              Retards Constatés (Mois)
            </Typography>
            <Typography variant="h4" fontWeight={900} color="#b91c1c" mt={0.5}>
              {totalRetardsMois}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* ========================================================================= */}
      {/* 1. VUE JOUR (FEUILLE D'ÉMARGEMENT QUOTIDIENNE) */}
      {/* ========================================================================= */}
      {viewMode === "day" && (
        <TableContainer component={Paper} sx={{ borderRadius: 3, border: "1px solid #e2e8f0" }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: "#f8fafc" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Salarié</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Département</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Shift Prévu</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Arrivée Réelle</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Départ Réel</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>Heures Normales</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>Heures Sup</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>Retard</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Statut</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>Action</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {pointageRows.map((row) => (
                <TableRow key={row.employe.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700} color="#0f172a">
                      {row.employe.nom} {row.employe.prenom}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.employe.poste}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Chip size="small" label={row.employe.departement} sx={{ textTransform: "capitalize" }} />
                  </TableCell>

                  <TableCell>
                    {row.plannedShift ? (
                      <Typography variant="caption" fontWeight={700} color="#4f46e5">
                        {row.plannedShift.type === "repos" ? "Repos" : `${row.plannedShift.heureDebut} - ${row.plannedShift.heureFin}`}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Non planifié</Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <TextField
                      type="time"
                      size="small"
                      value={row.heureArrivee}
                      onChange={(e) => handleFieldChange(row.employe.id, "heureArriveeReelle", e.target.value)}
                      disabled={row.statut === "repos" || row.statut === "en_conge" || row.statut.includes("absent")}
                      sx={{ width: 120 }}
                    />
                  </TableCell>

                  <TableCell>
                    <TextField
                      type="time"
                      size="small"
                      value={row.heureDepart}
                      onChange={(e) => handleFieldChange(row.employe.id, "heureDepartReelle", e.target.value)}
                      disabled={row.statut === "repos" || row.statut === "en_conge" || row.statut.includes("absent")}
                      sx={{ width: 120 }}
                    />
                  </TableCell>

                  <TableCell align="center">
                    <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
                      {row.heuresNormales} h
                    </Typography>
                  </TableCell>

                  <TableCell align="center">
                    <Typography variant="subtitle2" fontWeight={800} color={row.heuresSup > 0 ? "#15803d" : "text.secondary"}>
                      {row.heuresSup > 0 ? `+${row.heuresSup} h` : "0 h"}
                    </Typography>
                  </TableCell>

                  <TableCell align="center">
                    {row.retardMinutes > 0 ? (
                      <Chip size="small" color="error" label={`${row.retardMinutes} min`} />
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <FormControl size="small">
                      <Select
                        value={row.statut}
                        onChange={(e) => handleFieldChange(row.employe.id, "statut", e.target.value)}
                      >
                        <MenuItem value="present">Présent</MenuItem>
                        <MenuItem value="retard">Retard</MenuItem>
                        <MenuItem value="repos">Repos</MenuItem>
                        <MenuItem value="en_conge">En Congé</MenuItem>
                        <MenuItem value="absent_justifie">Absence Justifiée</MenuItem>
                        <MenuItem value="absent_injustifie">Absence Injustifiée</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>

                  <TableCell align="right">
                    <IconButton size="small" color="primary" onClick={() => handleSaveRow(row)}>
                      <CheckCircle />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ========================================================================= */}
      {/* 2. VUE SEMAINE (RÉCAPITULATIF HEBDOMADAIRE 7 JOURS) */}
      {/* ========================================================================= */}
      {viewMode === "week" && (
        <TableContainer component={Paper} sx={{ borderRadius: 3, border: "1px solid #e2e8f0", overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead sx={{ bgcolor: "#f8fafc" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, width: 220 }}>Salarié</TableCell>
                {daysOfWeek.map((d) => (
                  <TableCell key={d.dateStr} align="center" sx={{ fontWeight: 800, bgcolor: d.isToday ? "#eff6ff" : "inherit" }}>
                    <Typography variant="caption" display="block" color={d.isToday ? "#1d4ed8" : "text.secondary"}>
                      {d.dayShort}
                    </Typography>
                    <Typography variant="subtitle2" fontWeight={800} color={d.isToday ? "#1d4ed8" : "#0f172a"}>
                      {d.dayNum}
                    </Typography>
                  </TableCell>
                ))}
                <TableCell align="center" sx={{ fontWeight: 800 }}>Total Heures</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>Heures Sup</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {activeEmployes.map((emp) => {
                let totalWeekHours = 0;
                let totalWeekHS = 0;

                return (
                  <TableRow key={emp.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} color="#0f172a">
                        {emp.nom} {emp.prenom}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {emp.poste}
                      </Typography>
                    </TableCell>

                    {daysOfWeek.map((d) => {
                      const pt = pointages.find((p) => p.employeId === emp.id && p.date === d.dateStr);
                      const worked = (pt?.heuresNormales || 0) + (pt?.heuresSup || 0);
                      totalWeekHours += worked;
                      totalWeekHS += (pt?.heuresSup || 0);

                      return (
                        <TableCell key={d.dateStr} align="center">
                          {pt ? (
                            <Box
                              sx={{
                                py: 0.5,
                                px: 1,
                                borderRadius: 1.5,
                                bgcolor: pt.statut === "repos" ? "#f1f5f9" : pt.statut === "en_conge" ? "#fef3c7" : "#f0fdf4",
                                color: pt.statut === "repos" ? "#64748b" : pt.statut === "en_conge" ? "#92400e" : "#166534",
                                fontWeight: 700,
                                fontSize: "0.78rem",
                              }}
                            >
                              {pt.statut === "repos" ? "Repos" : pt.statut === "en_conge" ? "Congé" : `${worked} h`}
                            </Box>
                          ) : (
                            <Typography variant="caption" color="#94a3b8">—</Typography>
                          )}
                        </TableCell>
                      );
                    })}

                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
                        {totalWeekHours} h
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight={800} color={totalWeekHS > 0 ? "#15803d" : "text.secondary"}>
                        {totalWeekHS > 0 ? `+${totalWeekHS} h` : "0 h"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ========================================================================= */}
      {/* 3. VUE MOIS (REGISTRE MENSUEL DE PRÉSENCE & ASSIDUITÉ) */}
      {/* ========================================================================= */}
      {viewMode === "month" && (
        <TableContainer component={Paper} sx={{ borderRadius: 3, border: "1px solid #e2e8f0" }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: "#f8fafc" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Salarié</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Département</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>Jours Travaillés</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>Heures Normales</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>Heures Supplémentaires</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>Retards Cumulés</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>Jours Repos / Congés</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>Taux d'Assiduité</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {activeEmployes.map((emp) => {
                const empPointages = pointages.filter((p) => p.employeId === emp.id);
                const workedDays = empPointages.filter((p) => p.statut === "present" || p.statut === "retard").length;
                const totalHNorm = empPointages.reduce((sum, p) => sum + (p.heuresNormales || 0), 0);
                const totalHS = empPointages.reduce((sum, p) => sum + (p.heuresSup || 0), 0);
                const totalRetards = empPointages.filter((p) => (p.retardMinutes || 0) > 0).length;
                const restDays = empPointages.filter((p) => p.statut === "repos" || p.statut === "en_conge").length;
                const assiduity = workedDays > 0 ? Math.min(100, Math.round(((workedDays - totalRetards * 0.2) / workedDays) * 100)) : 100;

                return (
                  <TableRow key={emp.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} color="#0f172a">
                        {emp.nom} {emp.prenom}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {emp.poste}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Chip size="small" label={emp.departement} sx={{ textTransform: "capitalize" }} />
                    </TableCell>

                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight={800}>
                        {workedDays} j
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
                        {totalHNorm} h
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight={800} color={totalHS > 0 ? "#15803d" : "text.secondary"}>
                        {totalHS > 0 ? `+${totalHS} h` : "0 h"}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      {totalRetards > 0 ? (
                        <Chip size="small" color="warning" label={`${totalRetards} retard${totalRetards > 1 ? "s" : ""}`} />
                      ) : (
                        <Typography variant="caption" color="#16a34a" fontWeight={700}>✓ Aucun</Typography>
                      )}
                    </TableCell>

                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                        {restDays} j
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={`${assiduity}%`}
                        sx={{
                          fontWeight: 800,
                          bgcolor: assiduity >= 90 ? "#f0fdf4" : assiduity >= 75 ? "#fffbeb" : "#fef2f2",
                          color: assiduity >= 90 ? "#166534" : assiduity >= 75 ? "#b45309" : "#b91c1c",
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
