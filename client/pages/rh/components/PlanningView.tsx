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
  Card,
  CardContent,
  Avatar,
} from "@mui/material";
import {
  Add,
  ChevronLeft,
  ChevronRight,
  Today,
  ContentCopy,
  Print,
  Delete,
  Edit,
  FilterList,
  Assignment,
  Schedule,
  Bed,
  Restaurant,
  LocalBar,
  RoomService,
  Kitchen,
  CalendarViewMonth,
  CalendarViewWeek,
  CalendarViewDay,
  Person,
  CheckCircle,
  Warning,
  Info,
} from "@mui/icons-material";
import {
  useEmployes,
  usePlanningShifts,
  useCreatePlanningShift,
  useUpdatePlanningShift,
  useDeletePlanningShift,
  useCopyWeekPlanning,
} from "@/services/api";
import { useTenant } from "@/contexts/TenantContext";
import {
  Employe,
  PlanningShift,
  DepartementPersonnel,
  TypeShift,
} from "@shared/api";
import {
  addDays,
  format,
  getISOWeek,
  parseISO,
  startOfWeek,
  endOfWeek,
  subWeeks,
  addWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  subDays,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import { printPlanningHebdo } from "@/lib/export";

const DEPARTEMENTS: { value: DepartementPersonnel; label: string }[] = [
  { value: "hebergement", label: "Hébergement / Étages" },
  { value: "restaurant", label: "Restaurant / Salle" },
  { value: "cuisine", label: "Cuisine" },
  { value: "bar", label: "Bar" },
  { value: "reception", label: "Réception & Accueil" },
  { value: "economat", label: "Économat & Stock" },
  { value: "direction", label: "Direction & Admin" },
  { value: "technique", label: "Maintenance & Technique" },
];

const SHIFT_TYPES: { value: TypeShift; label: string; color: string; bg: string }[] = [
  { value: "travail", label: "Travail Continu", color: "#3730a3", bg: "#e0e7ff" },
  { value: "coupure", label: "Shift Coupure", color: "#6b21a8", bg: "#f3e8ff" },
  { value: "repos", label: "Repos Hebdomadaire", color: "#475569", bg: "#f1f5f9" },
  { value: "conge_paye", label: "Congé Payé", color: "#92400e", bg: "#fef3c7" },
  { value: "conge_maladie", label: "Congé Maladie", color: "#991b1b", bg: "#fee2e2" },
  { value: "absence_justifiee", label: "Absence Autorisée", color: "#9a3412", bg: "#ffedd5" },
  { value: "absence_injustifiee", label: "Absence Injustifiée", color: "#991b1b", bg: "#fecaca" },
  { value: "formation", label: "Formation / Briefing", color: "#065f46", bg: "#d1fae5" },
  { value: "recuperation", label: "Récupération", color: "#0369a1", bg: "#e0f2fe" },
];

const POSTE_PRESETS = [
  "Service Matin & Buffet",
  "Service Déjeuner Terrasse",
  "Service Soir & Caisse",
  "Cuisine Chaude",
  "Cuisine Froide / Entrées",
  "Plonge & Entretien",
  "Bar & Cocktails",
  "Réception & Check-in",
  "Veille de Nuit",
  "Housekeeping / Étages 1-4",
  "Blanchisserie & Lingerie",
  "Maintenance & Jardin",
];

export function PlanningView() {
  const { tenantConfig, publicConfig, config } = useTenant() as any;
  const tenantData = { ...publicConfig, ...config };

  const { data: employes = [] } = useEmployes();

  // Mode de Vue : "month" | "week" | "day"
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("week");

  // Date de référence actuelle
  const [dateRef, setDateRef] = useState<Date>(new Date());

  // Calcul des dates selon le mode
  const { startDateStr, endDateStr, titleLabel } = useMemo(() => {
    if (viewMode === "month") {
      const mStart = startOfMonth(dateRef);
      const mEnd = endOfMonth(dateRef);
      return {
        startDateStr: format(mStart, "yyyy-MM-dd"),
        endDateStr: format(mEnd, "yyyy-MM-dd"),
        titleLabel: format(dateRef, "MMMM yyyy", { locale: fr }),
      };
    } else if (viewMode === "day") {
      const dStr = format(dateRef, "yyyy-MM-dd");
      return {
        startDateStr: dStr,
        endDateStr: dStr,
        titleLabel: format(dateRef, "EEEE d MMMM yyyy", { locale: fr }),
      };
    } else {
      // Week
      const monday = startOfWeek(dateRef, { weekStartsOn: 1 });
      const sunday = addDays(monday, 6);
      const weekNum = getISOWeek(monday);
      return {
        startDateStr: format(monday, "yyyy-MM-dd"),
        endDateStr: format(sunday, "yyyy-MM-dd"),
        titleLabel: `Semaine ${weekNum} : ${format(monday, "d MMM", { locale: fr })} – ${format(sunday, "d MMM yyyy", { locale: fr })}`,
      };
    }
  }, [viewMode, dateRef]);

  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [employeFilter, setEmployeFilter] = useState<string>("all");

  const { data: shifts = [], isLoading } = usePlanningShifts({
    dateDebut: startDateStr,
    dateFin: endDateStr,
    departement: deptFilter,
    employeId: employeFilter,
  });

  const createShift = useCreatePlanningShift();
  const updateShift = useUpdatePlanningShift();
  const deleteShift = useDeletePlanningShift();
  const copyWeek = useCopyWeekPlanning();

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);

  const initialShiftForm: Omit<PlanningShift, "id"> = {
    employeId: "",
    employeNom: "",
    departement: "restaurant",
    date: startDateStr,
    heureDebut: "07:00",
    heureFin: "15:30",
    pauseMinutes: 30,
    type: "travail",
    posteAffecte: "Service Matin & Buffet",
    tache: "",
    notes: "",
    statut: "planifie",
  };

  const [shiftForm, setShiftForm] = useState<Omit<PlanningShift, "id">>(initialShiftForm);

  // Active Employees Filtered
  const activeEmployes = useMemo(() => {
    return employes.filter((emp) => {
      const matchStatus = emp.statut === "actif" || emp.statut === "conge";
      const matchDept = deptFilter === "all" || emp.departement === deptFilter;
      const matchEmp = employeFilter === "all" || emp.id === employeFilter;
      return matchStatus && matchDept && matchEmp;
    });
  }, [employes, deptFilter, employeFilter]);

  // Jours de la semaine pour vue Semaine
  const daysOfWeek = useMemo(() => {
    const monday = startOfWeek(dateRef, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i);
      return {
        date: d,
        dateStr: format(d, "yyyy-MM-dd"),
        dayName: format(d, "EEEE", { locale: fr }),
        dayShort: format(d, "EEE", { locale: fr }).toUpperCase(),
        dayNum: format(d, "d MMM", { locale: fr }),
        isToday: format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"),
      };
    });
  }, [dateRef]);

  // Jours du mois pour vue Mois
  const daysOfMonth = useMemo(() => {
    const mStart = startOfMonth(dateRef);
    const mEnd = endOfMonth(dateRef);
    const days = eachDayOfInterval({ start: mStart, end: mEnd });
    return days.map((d) => ({
      date: d,
      dateStr: format(d, "yyyy-MM-dd"),
      dayNumber: format(d, "d"),
      dayShort: format(d, "EEEEE", { locale: fr }).toUpperCase(),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"),
    }));
  }, [dateRef]);

  // Navigation handlers
  function handlePrev() {
    if (viewMode === "month") setDateRef((prev) => subMonths(prev, 1));
    else if (viewMode === "day") setDateRef((prev) => subDays(prev, 1));
    else setDateRef((prev) => subWeeks(prev, 1));
  }

  function handleNext() {
    if (viewMode === "month") setDateRef((prev) => addMonths(prev, 1));
    else if (viewMode === "day") setDateRef((prev) => addDays(prev, 1));
    else setDateRef((prev) => addWeeks(prev, 1));
  }

  function handleToday() {
    setDateRef(new Date());
  }

  // Quick Open Modal
  function handleOpenCreate(empId?: string, dateStr?: string) {
    setEditingShiftId(null);
    const selectedEmp = employes.find((e) => e.id === empId) || activeEmployes[0] || employes[0];
    setShiftForm({
      ...initialShiftForm,
      employeId: selectedEmp?.id || "",
      employeNom: selectedEmp ? `${selectedEmp.nom} ${selectedEmp.prenom}`.trim() : "",
      departement: selectedEmp?.departement || "restaurant",
      date: dateStr || (viewMode === "day" ? format(dateRef, "yyyy-MM-dd") : startDateStr),
    });
    setModalOpen(true);
  }

  function handleOpenEdit(s: PlanningShift) {
    setEditingShiftId(s.id);
    const { id, createdAt, updatedAt, ...rest } = s;
    setShiftForm(rest);
    setModalOpen(true);
  }

  function handleSaveShift() {
    if (!shiftForm.employeId || !shiftForm.date) return;

    if (editingShiftId) {
      updateShift.mutate(
        { id: editingShiftId, ...shiftForm },
        {
          onSuccess: () => setModalOpen(false),
        }
      );
    } else {
      createShift.mutate(shiftForm, {
        onSuccess: () => setModalOpen(false),
      });
    }
  }

  function handleDeleteShift(id: string) {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce créneau ?")) {
      deleteShift.mutate(id);
      setModalOpen(false);
    }
  }

  function handleCopyPreviousWeek() {
    const monday = startOfWeek(dateRef, { weekStartsOn: 1 });
    const prevMonday = subWeeks(monday, 1);
    const prevMondayStr = format(prevMonday, "yyyy-MM-dd");
    const mondayStr = format(monday, "yyyy-MM-dd");

    if (
      window.confirm(
        `Voulez-vous dupliquer les plannings de la semaine précédente (${format(prevMonday, "dd/MM")} - ${format(addDays(prevMonday, 6), "dd/MM")}) vers cette semaine ?`
      )
    ) {
      copyWeek.mutate(
        {
          sourceStart: prevMondayStr,
          targetStart: mondayStr,
        },
        {
          onSuccess: (count) => {
            alert(`Succès : ${count} créneaux ont été dupliqués.`);
          },
          onError: (err: any) => {
            alert(err?.message || "Erreur lors de la duplication.");
          },
        }
      );
    }
  }

  function handlePrintPlanning() {
    printPlanningHebdo(startDateStr, shifts, activeEmployes, tenantData);
  }

  function getShiftTypeStyle(type: TypeShift) {
    return (
      SHIFT_TYPES.find((t) => t.value === type) || {
        color: "#3730a3",
        bg: "#e0e7ff",
        label: type,
      }
    );
  }

  // Calculate planned hours for an employee
  function getPlannedHours(empId: string): number {
    const empShifts = shifts.filter(
      (s) => s.employeId === empId && s.type !== "repos" && s.type !== "conge_paye"
    );
    let totalMinutes = 0;
    empShifts.forEach((s) => {
      if (s.heureDebut && s.heureFin) {
        const [h1, m1] = s.heureDebut.split(":").map(Number);
        const [h2, m2] = s.heureFin.split(":").map(Number);
        let start = h1 * 60 + m1;
        let end = h2 * 60 + m2;
        if (end < start) end += 24 * 60; // Nuit
        let duration = end - start - (s.pauseMinutes || 0);
        if (duration > 0) totalMinutes += duration;
      }
    });
    return Math.round((totalMinutes / 60) * 10) / 10;
  }

  return (
    <Box>
      {/* HEADER TOOLBAR */}
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3, border: "1px solid #e2e8f0" }}>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          alignItems={{ xs: "flex-start", lg: "center" }}
          justifyContent="space-between"
        >
          {/* SÉLECTEUR DE VUE & NAVIGATION TEMPORELLE */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center" flexWrap="wrap">
            {/* TOGGLE VUES */}
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, next) => next && setViewMode(next)}
              size="small"
              sx={{ bgcolor: "#f1f5f9", p: 0.3, borderRadius: 2 }}
            >
              <ToggleButton value="month" sx={{ fontWeight: 700, textTransform: "none", px: 1.5 }}>
                <CalendarViewMonth fontSize="small" sx={{ mr: 0.5 }} /> Mois
              </ToggleButton>
              <ToggleButton value="week" sx={{ fontWeight: 700, textTransform: "none", px: 1.5 }}>
                <CalendarViewWeek fontSize="small" sx={{ mr: 0.5 }} /> Semaine
              </ToggleButton>
              <ToggleButton value="day" sx={{ fontWeight: 700, textTransform: "none", px: 1.5 }}>
                <CalendarViewDay fontSize="small" sx={{ mr: 0.5 }} /> Jour
              </ToggleButton>
            </ToggleButtonGroup>

            {/* NAVIGATEUR DATE */}
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

          {/* FILTRES & ACTIONS RAPIDES */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <Select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                displayEmpty
              >
                <MenuItem value="all">Tous départements</MenuItem>
                {DEPARTEMENTS.map((d) => (
                  <MenuItem key={d.value} value={d.value}>
                    {d.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 170 }}>
              <Select
                value={employeFilter}
                onChange={(e) => setEmployeFilter(e.target.value)}
                displayEmpty
              >
                <MenuItem value="all">Tous salariés</MenuItem>
                {employes.map((e) => (
                  <MenuItem key={e.id} value={e.id}>
                    {e.nom} {e.prenom}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {viewMode === "week" && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ContentCopy />}
                  onClick={handleCopyPreviousWeek}
                  disabled={copyWeek.isPending}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  Dupliquer S-1
                </Button>

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Print />}
                  onClick={handlePrintPlanning}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  Imprimer
                </Button>
              </>
            )}

            <Button
              variant="contained"
              size="small"
              startIcon={<Add />}
              onClick={() => handleOpenCreate()}
              sx={{
                bgcolor: "#4f46e5",
                fontWeight: 700,
                textTransform: "none",
                "&:hover": { bgcolor: "#4338ca" },
              }}
            >
              Nouveau créneau
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* ========================================================================= */}
      {/* 1. VUE SEMAINE (HEBDOMADAIRE - MATRICE 7 JOURS) */}
      {/* ========================================================================= */}
      {viewMode === "week" && (
        <TableContainer component={Paper} sx={{ borderRadius: 3, border: "1px solid #e2e8f0", overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 1100 }}>
            <TableHead sx={{ bgcolor: "#f8fafc" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, width: 220, borderRight: "1px solid #e2e8f0" }}>
                  Salarié & Département
                </TableCell>
                {daysOfWeek.map((day) => (
                  <TableCell
                    key={day.dateStr}
                    align="center"
                    sx={{
                      fontWeight: 800,
                      bgcolor: day.isToday ? "#eff6ff" : "inherit",
                      borderRight: "1px solid #e2e8f0",
                      width: 130,
                    }}
                  >
                    <Typography variant="caption" fontWeight={800} color={day.isToday ? "#1d4ed8" : "text.secondary"} display="block">
                      {day.dayShort}
                    </Typography>
                    <Typography variant="subtitle2" fontWeight={800} color={day.isToday ? "#1d4ed8" : "#0f172a"}>
                      {day.dayNum}
                    </Typography>
                  </TableCell>
                ))}
                <TableCell align="center" sx={{ fontWeight: 800, width: 90 }}>
                  Total Hebdo
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {activeEmployes.map((emp) => {
                const totalHours = getPlannedHours(emp.id);
                return (
                  <TableRow key={emp.id} hover>
                    <TableCell sx={{ borderRight: "1px solid #e2e8f0", py: 1.5 }}>
                      <Stack direction="row" spacing={1.2} alignItems="center">
                        <Avatar sx={{ width: 32, height: 32, bgcolor: "#e0e7ff", color: "#3730a3", fontSize: 13, fontWeight: 700 }}>
                          {emp.nom?.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={700} color="#0f172a">
                            {emp.nom} {emp.prenom}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" textTransform="capitalize">
                            {emp.poste}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>

                    {daysOfWeek.map((day) => {
                      const dayShifts = shifts.filter(
                        (s) => s.employeId === emp.id && s.date === day.dateStr
                      );

                      return (
                        <TableCell
                          key={day.dateStr}
                          align="center"
                          sx={{
                            borderRight: "1px solid #e2e8f0",
                            bgcolor: day.isToday ? "#f8faff" : "inherit",
                            p: 1,
                            verticalAlign: "top",
                            position: "relative",
                            "&:hover .add-btn": { opacity: 1 },
                          }}
                        >
                          {dayShifts.map((s) => {
                            const style = getShiftTypeStyle(s.type);
                            return (
                              <Paper
                                key={s.id}
                                onClick={() => handleOpenEdit(s)}
                                elevation={0}
                                sx={{
                                  p: 1,
                                  mb: 0.8,
                                  borderRadius: 2,
                                  bgcolor: style.bg,
                                  border: `1px solid ${style.color}30`,
                                  cursor: "pointer",
                                  textAlign: "left",
                                  transition: "transform 0.1s",
                                  "&:hover": { transform: "scale(1.02)" },
                                }}
                              >
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                  <Typography variant="caption" fontWeight={800} sx={{ color: style.color }}>
                                    {s.type === "repos" ? "REPOS" : s.type === "conge_paye" ? "CONGÉ" : `${s.heureDebut} - ${s.heureFin}`}
                                  </Typography>
                                </Stack>

                                {s.posteAffecte && s.type !== "repos" && s.type !== "conge_paye" && (
                                  <Typography variant="caption" display="block" fontWeight={600} color="#334155" noWrap>
                                    {s.posteAffecte}
                                  </Typography>
                                )}

                                {s.tache && (
                                  <Chip
                                    size="small"
                                    icon={<Assignment sx={{ fontSize: "11px !important" }} />}
                                    label={s.tache}
                                    sx={{ height: 18, fontSize: "9.5px", mt: 0.5, bgcolor: "#ffffff" }}
                                  />
                                )}
                              </Paper>
                            );
                          })}

                          {dayShifts.length === 0 && (
                            <IconButton
                              className="add-btn"
                              size="small"
                              onClick={() => handleOpenCreate(emp.id, day.dateStr)}
                              sx={{
                                opacity: 0,
                                transition: "opacity 0.2s",
                                bgcolor: "#f1f5f9",
                                width: 28,
                                height: 28,
                              }}
                            >
                              <Add fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                      );
                    })}

                    <TableCell align="center">
                      <Typography variant="subtitle2" fontWeight={800} color={totalHours > 40 ? "#b45309" : "#0f172a"}>
                        {totalHours} h
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
      {/* 2. VUE MOIS (MENSUELLE - MATRICE GLOBALE DU MOIS) */}
      {/* ========================================================================= */}
      {viewMode === "month" && (
        <TableContainer component={Paper} sx={{ borderRadius: 3, border: "1px solid #e2e8f0", overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 1400 }}>
            <TableHead sx={{ bgcolor: "#f8fafc" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, width: 200, position: "sticky", left: 0, bgcolor: "#f8fafc", zIndex: 2, borderRight: "2px solid #cbd5e1" }}>
                  Salarié ({activeEmployes.length})
                </TableCell>
                {daysOfMonth.map((d) => (
                  <TableCell
                    key={d.dateStr}
                    align="center"
                    sx={{
                      fontWeight: 800,
                      width: 38,
                      minWidth: 38,
                      p: 0.5,
                      bgcolor: d.isToday ? "#eff6ff" : d.isWeekend ? "#f1f5f9" : "inherit",
                      borderRight: "1px solid #e2e8f0",
                    }}
                  >
                    <Typography variant="caption" sx={{ fontSize: "9px", color: d.isToday ? "#1d4ed8" : "#64748b" }} display="block">
                      {d.dayShort}
                    </Typography>
                    <Typography variant="caption" fontWeight={800} sx={{ color: d.isToday ? "#1d4ed8" : "#0f172a" }}>
                      {d.dayNumber}
                    </Typography>
                  </TableCell>
                ))}
                <TableCell align="center" sx={{ fontWeight: 800, width: 80 }}>
                  Total Mois
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {activeEmployes.map((emp) => {
                const totalHoursMonth = getPlannedHours(emp.id);

                return (
                  <TableRow key={emp.id} hover>
                    <TableCell sx={{ position: "sticky", left: 0, bgcolor: "#ffffff", zIndex: 1, borderRight: "2px solid #cbd5e1", py: 1 }}>
                      <Typography variant="body2" fontWeight={700} color="#0f172a" noWrap>
                        {emp.nom} {emp.prenom?.charAt(0)}.
                      </Typography>
                      <Typography variant="caption" color="text.secondary" textTransform="capitalize" noWrap display="block">
                        {emp.departement}
                      </Typography>
                    </TableCell>

                    {daysOfMonth.map((d) => {
                      const dayShifts = shifts.filter(
                        (s) => s.employeId === emp.id && s.date === d.dateStr
                      );
                      const shift = dayShifts[0];

                      return (
                        <TableCell
                          key={d.dateStr}
                          align="center"
                          onClick={() => (shift ? handleOpenEdit(shift) : handleOpenCreate(emp.id, d.dateStr))}
                          sx={{
                            p: 0.3,
                            borderRight: "1px solid #e2e8f0",
                            bgcolor: d.isToday ? "#f8faff" : d.isWeekend ? "#fafafa" : "inherit",
                            cursor: "pointer",
                            "&:hover": { bgcolor: "#f1f5f9" },
                          }}
                        >
                          {shift ? (
                            <Tooltip title={`${shift.type === "repos" ? "Repos" : `${shift.heureDebut} - ${shift.heureFin}`} (${shift.posteAffecte || ""})`}>
                              <Box
                                sx={{
                                  width: "100%",
                                  height: 26,
                                  borderRadius: 1,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "10px",
                                  fontWeight: 800,
                                  bgcolor: shift.type === "repos" ? "#f1f5f9" : shift.type === "conge_paye" ? "#fef3c7" : "#e0e7ff",
                                  color: shift.type === "repos" ? "#64748b" : shift.type === "conge_paye" ? "#92400e" : "#3730a3",
                                  border: `1px solid ${shift.type === "repos" ? "#cbd5e1" : "#818cf8"}`,
                                }}
                              >
                                {shift.type === "repos" ? "R" : shift.type === "conge_paye" ? "C" : shift.heureDebut?.split(":")[0]}
                              </Box>
                            </Tooltip>
                          ) : (
                            <Box sx={{ width: "100%", height: 26 }} />
                          )}
                        </TableCell>
                      );
                    })}

                    <TableCell align="center">
                      <Typography variant="caption" fontWeight={800} color="#0f172a">
                        {totalHoursMonth} h
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
      {/* 3. VUE JOUR (JOURNALIÈRE - DÉTAIL DES OPÉRATIONS & POSTES) */}
      {/* ========================================================================= */}
      {viewMode === "day" && (
        <Stack spacing={3}>
          {/* STATS DE LA JOURNÉE */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, borderRadius: 2.5, borderLeft: "4px solid #4f46e5", bgcolor: "#ffffff" }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">
                  Salariés en Service Aujourd'hui
                </Typography>
                <Typography variant="h4" fontWeight={900} color="#4338ca" mt={0.5}>
                  {shifts.filter((s) => s.type !== "repos" && s.type !== "conge_paye").length}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, borderRadius: 2.5, borderLeft: "4px solid #64748b", bgcolor: "#ffffff" }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">
                  En Repos Hebdomadaire
                </Typography>
                <Typography variant="h4" fontWeight={900} color="#475569" mt={0.5}>
                  {shifts.filter((s) => s.type === "repos").length}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, borderRadius: 2.5, borderLeft: "4px solid #f59e0b", bgcolor: "#ffffff" }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">
                  En Congé / Absence
                </Typography>
                <Typography variant="h4" fontWeight={900} color="#b45309" mt={0.5}>
                  {shifts.filter((s) => s.type.includes("conge") || s.type.includes("absence")).length}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* LISTE DES SHIFTS DU JOUR PAR DÉPARTEMENT */}
          <Grid container spacing={3}>
            {DEPARTEMENTS.map((dept) => {
              const deptShifts = shifts.filter((s) => s.departement === dept.value);
              if (deptFilter !== "all" && deptFilter !== dept.value) return null;

              return (
                <Grid item xs={12} md={6} key={dept.value}>
                  <Paper sx={{ p: 2.5, borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#ffffff", height: "100%" }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="subtitle1" fontWeight={800} color="#0f172a">
                        {dept.label} ({deptShifts.length})
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<Add />}
                        onClick={() => {
                          setShiftForm({
                            ...initialShiftForm,
                            departement: dept.value,
                            date: format(dateRef, "yyyy-MM-dd"),
                          });
                          setEditingShiftId(null);
                          setModalOpen(true);
                        }}
                        sx={{ textTransform: "none", fontWeight: 700 }}
                      >
                        Ajouter
                      </Button>
                    </Stack>

                    {deptShifts.length === 0 ? (
                      <Typography variant="caption" color="text.secondary" sx={{ py: 2, display: "block", textAlign: "center" }}>
                        Aucun créneau planifié pour ce département.
                      </Typography>
                    ) : (
                      <Stack spacing={1.5}>
                        {deptShifts.map((s) => {
                          const style = getShiftTypeStyle(s.type);
                          return (
                            <Paper
                              key={s.id}
                              elevation={0}
                              sx={{
                                p: 1.5,
                                borderRadius: 2,
                                bgcolor: style.bg,
                                border: `1px solid ${style.color}30`,
                              }}
                            >
                              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                <Box>
                                  <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
                                    {s.employeNom}
                                  </Typography>
                                  <Typography variant="caption" fontWeight={700} sx={{ color: style.color }}>
                                    ⏰ {s.type === "repos" ? "REPOS" : `${s.heureDebut} – ${s.heureFin}`}
                                    {s.pauseMinutes ? ` (Pause: ${s.pauseMinutes}m)` : ""}
                                  </Typography>
                                  {s.posteAffecte && (
                                    <Typography variant="caption" display="block" color="#334155" fontWeight={600} mt={0.3}>
                                      📍 Poste : {s.posteAffecte}
                                    </Typography>
                                  )}
                                  {s.tache && (
                                    <Chip
                                      size="small"
                                      icon={<Assignment sx={{ fontSize: "12px !important" }} />}
                                      label={`Tâche : ${s.tache}`}
                                      sx={{ mt: 0.8, bgcolor: "#ffffff", fontWeight: 600 }}
                                    />
                                  )}
                                </Box>

                                <Stack direction="row" spacing={0.5}>
                                  <IconButton size="small" onClick={() => handleOpenEdit(s)}>
                                    <Edit fontSize="small" />
                                  </IconButton>
                                  <IconButton size="small" color="error" onClick={() => handleDeleteShift(s.id)}>
                                    <Delete fontSize="small" />
                                  </IconButton>
                                </Stack>
                              </Stack>
                            </Paper>
                          );
                        })}
                      </Stack>
                    )}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Stack>
      )}

      {/* ========================================================================= */}
      {/* MODAL CRÉATION / MODIFICATION DE SHIFT & TÂCHE */}
      {/* ========================================================================= */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          {editingShiftId ? "Modifier le Créneau" : "Planifier un Shift & Tâche"}
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.2}>
            {/* SALARIÉ */}
            <FormControl size="small" fullWidth required>
              <Select
                value={shiftForm.employeId}
                onChange={(e) => {
                  const emp = employes.find((em) => em.id === e.target.value);
                  setShiftForm({
                    ...shiftForm,
                    employeId: e.target.value,
                    employeNom: emp ? `${emp.nom} ${emp.prenom}`.trim() : "",
                    departement: emp?.departement || shiftForm.departement,
                  });
                }}
                displayEmpty
              >
                <MenuItem value="" disabled><em>Sélectionner un collaborateur *</em></MenuItem>
                {employes.map((emp) => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.nom} {emp.prenom} ({emp.departement})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* DATE & TYPE DE SHIFT */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Date du Shift *"
                  type="date"
                  size="small"
                  fullWidth
                  value={shiftForm.date}
                  onChange={(e) => setShiftForm({ ...shiftForm, date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <Select
                    value={shiftForm.type}
                    onChange={(e) => setShiftForm({ ...shiftForm, type: e.target.value as any })}
                  >
                    {SHIFT_TYPES.map((t) => (
                      <MenuItem key={t.value} value={t.value}>
                        {t.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* HORAIRES (si pas repos/congé) */}
            {shiftForm.type !== "repos" && !shiftForm.type.includes("conge") && (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Heure Début"
                    type="time"
                    size="small"
                    fullWidth
                    value={shiftForm.heureDebut}
                    onChange={(e) => setShiftForm({ ...shiftForm, heureDebut: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Heure Fin"
                    type="time"
                    size="small"
                    fullWidth
                    value={shiftForm.heureFin}
                    onChange={(e) => setShiftForm({ ...shiftForm, heureFin: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Pause (min)"
                    type="number"
                    size="small"
                    fullWidth
                    value={shiftForm.pauseMinutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, pauseMinutes: Number(e.target.value) })}
                  />
                </Grid>
              </Grid>
            )}

            {/* POSTE AFFECTÉ */}
            <FormControl size="small" fullWidth>
              <Select
                value={shiftForm.posteAffecte}
                onChange={(e) => setShiftForm({ ...shiftForm, posteAffecte: e.target.value })}
                displayEmpty
              >
                <MenuItem value=""><em>-- Poste affecté --</em></MenuItem>
                {POSTE_PRESETS.map((p) => (
                  <MenuItem key={p} value={p}>{p}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* TÂCHE SPÉCIFIQUE */}
            <TextField
              label="Tâche spécifique assignée"
              placeholder="Ex: Mise en place terrasse 40 couverts, Inventaire stock bar..."
              size="small"
              fullWidth
              value={shiftForm.tache}
              onChange={(e) => setShiftForm({ ...shiftForm, tache: e.target.value })}
            />

            {/* NOTES / CONSIGNES */}
            <TextField
              label="Notes & Consignes particulières"
              placeholder="Consignes particulières pour ce shift..."
              size="small"
              multiline
              rows={2}
              fullWidth
              value={shiftForm.notes}
              onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          {editingShiftId && (
            <Button
              color="error"
              onClick={() => handleDeleteShift(editingShiftId)}
              sx={{ mr: "auto", textTransform: "none" }}
            >
              Supprimer
            </Button>
          )}
          <Button onClick={() => setModalOpen(false)} sx={{ textTransform: "none" }}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveShift}
            disabled={createShift.isPending || updateShift.isPending}
            sx={{ bgcolor: "#4f46e5", fontWeight: 700, textTransform: "none" }}
          >
            {createShift.isPending || updateShift.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
