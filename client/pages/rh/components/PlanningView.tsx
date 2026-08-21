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
  const [currentMonday, setCurrentMonday] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const startDateStr = format(currentMonday, "yyyy-MM-dd");
  const endDateStr = format(addDays(currentMonday, 6), "yyyy-MM-dd");

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

  // 7 Days of the Week
  const daysOfWeek = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(currentMonday, i);
      return {
        date: d,
        dateStr: format(d, "yyyy-MM-dd"),
        dayName: format(d, "EEEE", { locale: fr }),
        dayShort: format(d, "EEE", { locale: fr }).toUpperCase(),
        dayNum: format(d, "d MMM", { locale: fr }),
        isToday: format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"),
      };
    });
  }, [currentMonday]);

  // Filter Active Employees
  const activeEmployes = useMemo(() => {
    return employes.filter((emp) => {
      const matchStatus = emp.statut === "actif" || emp.statut === "conge";
      const matchDept = deptFilter === "all" || emp.departement === deptFilter;
      const matchEmp = employeFilter === "all" || emp.id === employeFilter;
      return matchStatus && matchDept && matchEmp;
    });
  }, [employes, deptFilter, employeFilter]);

  // Calculate planned hours for an employee on this week
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

  // Navigation handlers
  function handlePrevWeek() {
    setCurrentMonday((prev) => subWeeks(prev, 1));
  }

  function handleNextWeek() {
    setCurrentMonday((prev) => addWeeks(prev, 1));
  }

  function handleToday() {
    setCurrentMonday(startOfWeek(new Date(), { weekStartsOn: 1 }));
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
      date: dateStr || startDateStr,
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
    const prevMonday = subWeeks(currentMonday, 1);
    const prevMondayStr = format(prevMonday, "yyyy-MM-dd");
    if (
      window.confirm(
        `Voulez-vous dupliquer les plannings de la semaine précédente (${format(prevMonday, "dd/MM")} - ${format(addDays(prevMonday, 6), "dd/MM")}) vers cette semaine ?`
      )
    ) {
      copyWeek.mutate(
        {
          sourceStart: prevMondayStr,
          targetStart: startDateStr,
        },
        {
          onSuccess: (count) => {
            alert(`Succès : ${count} créneaux ont été dupliqués sur cette semaine.`);
          },
          onError: (err: any) => {
            alert(err?.message || "Erreur lors de la duplication des créneaux.");
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

  const weekNumber = getISOWeek(currentMonday);

  return (
    <Box>
      {/* HEADER TOOLBAR */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems="center"
          justifyContent="space-between"
        >
          {/* WEEK SELECTOR & NAV */}
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton onClick={handlePrevWeek} size="small" sx={{ bgcolor: "#f1f5f9" }}>
              <ChevronLeft />
            </IconButton>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Today />}
              onClick={handleToday}
              sx={{ fontWeight: 700 }}
            >
              Aujourd'hui
            </Button>
            <IconButton onClick={handleNextWeek} size="small" sx={{ bgcolor: "#f1f5f9" }}>
              <ChevronRight />
            </IconButton>

            <Box sx={{ ml: 1 }}>
              <Typography variant="h6" fontWeight={800} color="#0f172a" lineHeight={1.2}>
                Semaine {weekNumber} : {format(currentMonday, "d MMMM", { locale: fr })} –{" "}
                {format(addDays(currentMonday, 6), "d MMMM yyyy", { locale: fr })}
              </Typography>
            </Box>
          </Stack>

          {/* FILTERS & ACTIONS */}
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

            <Tooltip title="Copier tous les shifts de la semaine précédente">
              <Button
                variant="outlined"
                startIcon={<ContentCopy />}
                onClick={handleCopyPreviousWeek}
                disabled={copyWeek.isPending}
                sx={{ fontWeight: 700 }}
              >
                {copyWeek.isPending ? "Duplication..." : "Dupliquer S-1"}
              </Button>
            </Tooltip>

            <Tooltip title="Imprimer le planning format A4 paysage pour affichage">
              <Button
                variant="outlined"
                startIcon={<Print />}
                onClick={handlePrintPlanning}
                sx={{ fontWeight: 700 }}
              >
                Imprimer (A4)
              </Button>
            </Tooltip>

            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenCreate()}
              sx={{
                background: "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)",
                fontWeight: 700,
              }}
            >
              Nouveau shift
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* PLANNING SCHEDULE GRID */}
      <Paper sx={{ width: "100%", overflow: "hidden", borderRadius: 3 }}>
        <TableContainer sx={{ maxHeight: 720 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1100 }}>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    width: 220,
                    fontWeight: 800,
                    bgcolor: "#0f172a",
                    color: "#ffffff",
                    zIndex: 3,
                  }}
                >
                  Salarié / Poste
                </TableCell>

                {daysOfWeek.map((day) => (
                  <TableCell
                    key={day.dateStr}
                    align="center"
                    sx={{
                      fontWeight: 800,
                      bgcolor: day.isToday ? "#312e81" : "#1e293b",
                      color: "#ffffff",
                      borderLeft: "1px solid #334155",
                      minWidth: 140,
                    }}
                  >
                    <Typography variant="body2" fontWeight={800} textTransform="capitalize">
                      {day.dayName}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: day.isToday ? "#38bdf8" : "#94a3b8",
                        fontWeight: 700,
                      }}
                    >
                      {day.dayNum}
                    </Typography>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {activeEmployes.map((emp) => {
                const totalH = getPlannedHours(emp.id);

                return (
                  <TableRow key={emp.id} hover>
                    {/* EMPLOYEE INFO COLUMN */}
                    <TableCell
                      sx={{
                        bgcolor: "#f8fafc",
                        borderRight: "2px solid #e2e8f0",
                        position: "sticky",
                        left: 0,
                        zIndex: 2,
                      }}
                    >
                      <Typography fontWeight={800} color="#0f172a" fontSize="0.875rem">
                        {emp.nom} {emp.prenom}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {emp.poste}
                      </Typography>
                      <Stack direction="row" spacing={0.8} alignItems="center" mt={0.5}>
                        <Chip
                          size="small"
                          label={`${totalH}h planifiées`}
                          sx={{
                            height: 19,
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            bgcolor: totalH > 40 ? "#fee2e2" : "#e0e7ff",
                            color: totalH > 40 ? "#991b1b" : "#3730a3",
                          }}
                        />
                      </Stack>
                    </TableCell>

                    {/* 7 DAYS CELLS */}
                    {daysOfWeek.map((day) => {
                      const empDayShifts = shifts.filter(
                        (s) => s.employeId === emp.id && s.date === day.dateStr
                      );

                      return (
                        <TableCell
                          key={day.dateStr}
                          sx={{
                            p: 1,
                            verticalAlign: "top",
                            borderLeft: "1px solid #f1f5f9",
                            bgcolor: day.isToday ? "#f0fdfa" : "inherit",
                            "&:hover .quick-add-btn": { opacity: 1 },
                          }}
                        >
                          <Stack spacing={1}>
                            {empDayShifts.map((shift) => {
                              const style = getShiftTypeStyle(shift.type);

                              if (shift.type === "repos") {
                                return (
                                  <Box
                                    key={shift.id}
                                    onClick={() => handleOpenEdit(shift)}
                                    sx={{
                                      p: 1,
                                      borderRadius: 2,
                                      bgcolor: "#f1f5f9",
                                      border: "1px dashed #cbd5e1",
                                      textAlign: "center",
                                      cursor: "pointer",
                                      transition: "all 0.15s ease",
                                      "&:hover": { bgcolor: "#e2e8f0" },
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      fontWeight={800}
                                      color="#64748b"
                                      letterSpacing={0.5}
                                    >
                                      REPOS
                                    </Typography>
                                  </Box>
                                );
                              }

                              if (shift.type === "conge_paye" || shift.type === "conge_maladie") {
                                return (
                                  <Box
                                    key={shift.id}
                                    onClick={() => handleOpenEdit(shift)}
                                    sx={{
                                      p: 1,
                                      borderRadius: 2,
                                      bgcolor: style.bg,
                                      border: `1px solid ${style.color}30`,
                                      cursor: "pointer",
                                      textAlign: "center",
                                      "&:hover": { opacity: 0.9 },
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      fontWeight={800}
                                      sx={{ color: style.color }}
                                    >
                                      {shift.type === "conge_paye" ? "🌴 CONGÉ PAYÉ" : "🏥 MALADIE"}
                                    </Typography>
                                  </Box>
                                );
                              }

                              return (
                                <Box
                                  key={shift.id}
                                  onClick={() => handleOpenEdit(shift)}
                                  sx={{
                                    p: 1,
                                    borderRadius: 2,
                                    bgcolor: style.bg,
                                    border: `1px solid ${style.color}30`,
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                    "&:hover": {
                                      transform: "translateY(-1px)",
                                      boxShadow: "0 3px 6px rgba(0,0,0,0.08)",
                                    },
                                  }}
                                >
                                  {/* HOURS */}
                                  <Stack
                                    direction="row"
                                    justifyContent="space-between"
                                    alignItems="center"
                                  >
                                    <Typography
                                      variant="caption"
                                      fontWeight={800}
                                      sx={{ color: style.color }}
                                    >
                                      ⏰ {shift.heureDebut} - {shift.heureFin}
                                    </Typography>
                                    {shift.pauseMinutes && shift.pauseMinutes > 0 && (
                                      <Typography variant="caption" color="text.secondary" fontSize="0.65rem">
                                        ({shift.pauseMinutes}m pause)
                                      </Typography>
                                    )}
                                  </Stack>

                                  {/* POSTE / STATION */}
                                  {shift.posteAffecte && (
                                    <Typography
                                      variant="body2"
                                      fontWeight={700}
                                      color="#0f172a"
                                      fontSize="0.75rem"
                                      mt={0.3}
                                    >
                                      {shift.posteAffecte}
                                    </Typography>
                                  )}

                                  {/* TASK / TÂCHE ASSIGNÉE */}
                                  {shift.tache && (
                                    <Box
                                      sx={{
                                        mt: 0.5,
                                        p: 0.4,
                                        px: 0.8,
                                        bgcolor: "rgba(255,255,255,0.7)",
                                        borderRadius: 1,
                                        border: "1px dashed rgba(0,0,0,0.1)",
                                      }}
                                    >
                                      <Typography
                                        variant="caption"
                                        color="#334155"
                                        fontSize="0.7rem"
                                        display="flex"
                                        alignItems="center"
                                        gap={0.3}
                                      >
                                        <Assignment sx={{ fontSize: 11, color: "#64748b" }} />
                                        {shift.tache}
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              );
                            })}

                            {/* QUICK ADD BUTTON ON EMPTY / ADD MORE */}
                            <Button
                              className="quick-add-btn"
                              size="small"
                              variant="text"
                              onClick={() => handleOpenCreate(emp.id, day.dateStr)}
                              sx={{
                                opacity: 0.2,
                                py: 0.3,
                                fontSize: "0.7rem",
                                borderRadius: 1.5,
                                border: "1px dashed #cbd5e1",
                                "&:hover": { opacity: 1, bgcolor: "#f1f5f9" },
                              }}
                            >
                              + Shift
                            </Button>
                          </Stack>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}

              {activeEmployes.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary" fontWeight={600}>
                      Aucun salarié à afficher dans ce département.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* SHIFT CREATION / EDITION MODAL */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          {editingShiftId ? "Modifier le créneau de shift" : "Planifier un nouveau shift"}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.5}>
            {/* EMPLOYE SELECTOR */}
            <FormControl fullWidth size="small">
              <TextField
                select
                label="Salarié concerné"
                required
                size="small"
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
              >
                {employes.map((emp) => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.nom} {emp.prenom} ({emp.poste} - {emp.departement})
                  </MenuItem>
                ))}
              </TextField>
            </FormControl>

            {/* DATE & TYPE */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Date du shift"
                  type="date"
                  required
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={shiftForm.date}
                  onChange={(e) => setShiftForm({ ...shiftForm, date: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Type de créneau"
                  required
                  fullWidth
                  size="small"
                  value={shiftForm.type}
                  onChange={(e) =>
                    setShiftForm({ ...shiftForm, type: e.target.value as TypeShift })
                  }
                >
                  {SHIFT_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            {/* HOURS (IF NOT REPOS / CONGE) */}
            {shiftForm.type !== "repos" &&
              shiftForm.type !== "conge_paye" &&
              shiftForm.type !== "conge_maladie" && (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Heure de début"
                      type="time"
                      required
                      fullWidth
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      value={shiftForm.heureDebut}
                      onChange={(e) =>
                        setShiftForm({ ...shiftForm, heureDebut: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Heure de fin"
                      type="time"
                      required
                      fullWidth
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      value={shiftForm.heureFin}
                      onChange={(e) =>
                        setShiftForm({ ...shiftForm, heureFin: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Pause (minutes)"
                      type="number"
                      fullWidth
                      size="small"
                      value={shiftForm.pauseMinutes || 0}
                      onChange={(e) =>
                        setShiftForm({
                          ...shiftForm,
                          pauseMinutes: Number(e.target.value),
                        })
                      }
                    />
                  </Grid>
                </Grid>
              )}

            {/* POSTE AFFECTÉ & PRESETS */}
            {shiftForm.type !== "repos" &&
              shiftForm.type !== "conge_paye" &&
              shiftForm.type !== "conge_maladie" && (
                <Box>
                  <TextField
                    label="Poste ou secteur affecté"
                    placeholder="Ex: Service Terrasse Déjeuner, Cuisine Chaud, Chambre 1-8"
                    fullWidth
                    size="small"
                    value={shiftForm.posteAffecte || ""}
                    onChange={(e) =>
                      setShiftForm({ ...shiftForm, posteAffecte: e.target.value })
                    }
                  />
                  <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap" gap={0.5}>
                    {POSTE_PRESETS.slice(0, 5).map((preset) => (
                      <Chip
                        key={preset}
                        size="small"
                        label={preset}
                        onClick={() =>
                          setShiftForm({ ...shiftForm, posteAffecte: preset })
                        }
                        sx={{ fontSize: "0.7rem", cursor: "pointer" }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

            {/* TÂCHES SPÉCIFIQUES ET CONSIGNES */}
            {shiftForm.type !== "repos" && (
              <TextField
                label="Tâche(s) spécifique(s) ou consignes"
                placeholder="Ex: Mise en place buffet petit-déjeuner, contrôle inventaire boissons bar..."
                multiline
                rows={2}
                fullWidth
                size="small"
                value={shiftForm.tache || ""}
                onChange={(e) => setShiftForm({ ...shiftForm, tache: e.target.value })}
              />
            )}

            <TextField
              label="Notes internes (optionnel)"
              fullWidth
              size="small"
              value={shiftForm.notes || ""}
              onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
          {editingShiftId ? (
            <Button
              color="error"
              startIcon={<Delete />}
              onClick={() => handleDeleteShift(editingShiftId)}
            >
              Supprimer le shift
            </Button>
          ) : (
            <div />
          )}

          <Stack direction="row" spacing={1.5}>
            <Button onClick={() => setModalOpen(false)} color="inherit">
              Annuler
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveShift}
              disabled={!shiftForm.employeId || !shiftForm.date}
              sx={{ fontWeight: 700 }}
            >
              Enregistrer
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
