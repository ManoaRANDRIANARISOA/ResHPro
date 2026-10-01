import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
  Divider,
  Select,
  MenuItem,
  TextField,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  IconButton,
  Checkbox,
  FormControlLabel,
  Alert,
  Tooltip,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CloseIcon from "@mui/icons-material/Close";
import {
  addDays,
  format,
  getISOWeek,
  startOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  endOfMonth,
  isBefore,
  isAfter,
  isSameDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useMemo, useState, useEffect, Fragment, useRef } from "react";
import {
  useChambres,
  useCreateChambre,
  useDeleteChambre,
  useHebergementReservations,
  useUpdateHebergementReservation,
  useUpdateChambre,
  useAddRoomMaintenance,
  useRemoveRoomMaintenance,
  useRoomMaintenance,
  useCreateFacture,
  useClients,
  useCreateClient,
  useCreateHebergementReservation,
  useGenerateHebergementInvoice,
  useFactures,
  useUpdateClient,
  useDeleteHebergementReservation,
  useValidateProforma,
  sortChambres,
  getReservationRoomInterval,
  isRoomReservedDuring,
} from "@/services/api";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSelector } from "@/store";
import { useRBAC } from "@/hooks/useRBAC";
import {
  Reservation,
  Chambre,
  ChambreMaintenance,
  HebergementPack,
  Client,
  ReservationChambreDetail,
  Stay,
  getReservationStays,
  isProformaDocument,
} from "@shared/api";
import { DEFAULT_HEBERGEMENT_TAXES, HebergementTaxe } from "@shared/tenant";
import { RoomCalendar } from "@/components/RoomCalendar";
import { exportToCSV, exportToPDF } from "@/lib/export";
import { useSearchParams, useNavigate } from "react-router-dom";

const DEFAULT_PACKS: HebergementPack[] = [
  {
    id: "chambre_seule",
    nom: "Chambre Seule (Logement Simple)",
    description: "Nuitée standard sans repas inclus.",
    typeCalcul: "par_chambre_nuit",
    prix: 0,
    isDefault: true,
  },
  {
    id: "pdj_inclus",
    nom: "Formule Petit-Déjeuner (B&B)",
    description: "Nuitée avec petit-déjeuner complet par personne.",
    typeCalcul: "par_personne_nuit",
    prix: 15000,
  },
  {
    id: "demi_pension",
    nom: "Formule Demi-Pension",
    description: "Nuitée avec Petit-déjeuner et Dîner (hors boissons).",
    typeCalcul: "par_personne_nuit",
    prix: 45000,
  },
  {
    id: "pension_complete",
    nom: "Formule Pension Complète",
    description: "Nuitée avec Petit-déjeuner, Déjeuner et Dîner.",
    typeCalcul: "par_personne_nuit",
    prix: 75000,
  },
];

type View = "month" | "week" | "day";

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          bgcolor: color,
          border: color === "#FFFFFF" ? "1px solid #ccc" : "none",
        }}
      />
      <Typography variant="caption">{label}</Typography>
    </Stack>
  );
}

export default function GestionChambres() {
  const { data: list } = useHebergementReservations();
  const { data: factures } = useFactures();
  const createFacture = useCreateFacture();
  const generateInvoiceMutation = useGenerateHebergementInvoice();
  const { data: maintenance } = useRoomMaintenance();
  const addMaint = useAddRoomMaintenance();
  const removeMaint = useRemoveRoomMaintenance();
  const updateRoom = useUpdateChambre();
  const update = useUpdateHebergementReservation();
  const create = useCreateHebergementReservation();
  const { data: clients } = useClients();
  const { data: rawRooms } = useChambres();
  const { role, isDircom } = useRBAC();
  const { user } = useAuth();
  const userEmail = (user?.email || "").toLowerCase();
  const [open, setOpen] = useState<Reservation | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { publicConfig, tenantId } = useTenant();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("month");
  const [dateRef, setDateRef] = useState<Date>(startOfMonth(new Date()));
  const [searchParams] = useSearchParams();
  const [maintRoomId, setMaintRoomId] = useState<string>("");
  const [maintStart, setMaintStart] = useState<string>("");
  const [maintEnd, setMaintEnd] = useState<string>("");

  const rooms = useMemo(() => sortChambres(rawRooms || []), [rawRooms]);

  // Ouvrir automatiquement le modal de création si demandé via l’URL
  useEffect(() => {
    if (searchParams.get("newReservation") === "1") {
      setCreateModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const rid = rooms?.[0]?.id || "";
    setMaintRoomId((v) => v || rid);
    const s = format(dateRef, "yyyy-MM-dd");
    const e = format(addDays(dateRef, 1), "yyyy-MM-dd");
    setMaintStart((v) => v || s);
    setMaintEnd((v) => v || e);
  }, [rooms, dateRef]);

  function deriveReservationStatus(r: Reservation) {
    const now = new Date();
    const dStart = new Date(r.dateDebut);
    const dEnd = new Date(r.dateFin || r.dateDebut);
    if (r.statut === "annulee") return "annulee";
    const hasAcompte = Number((r as any).accompte || 0) > 0;
    if (r.statut === "en_attente") return hasAcompte ? "confirmee" : "en_attente";
    if (now < dStart) {
      return r.statut === "arrivee" ? "confirmee" : r.statut;
    }
    if (now >= dStart && now < dEnd) {
      return r.statut === "arrivee" ? "arrivee" : "confirmee";
    }
    return "terminee";
  }

  // Calcul dynamique de la chambre la plus occupée du mois courant
  const chambresStats = useMemo(() => {
    const start = startOfMonth(dateRef);
    const end = endOfMonth(dateRef);
    const daysInMonth = eachDayOfInterval({ start, end }).length;
    const stats = (rooms || []).map((ch) => {
      const occupiedDays = (list || [])
        .filter((r) => {
          if (r.type !== "hebergement" || r.statut === "annulee") return false;
          const roomIds =
            r.chambreIds && r.chambreIds.length > 0
              ? r.chambreIds
              : r.chambreId
                ? [r.chambreId]
                : [];
          return roomIds.includes(ch.id);
        })
        .reduce((sum, r) => {
          const { resDebut: dStart, resFin: dEnd } = getReservationRoomInterval(r, ch.id);
          const overlapStart = dStart < start ? start : dStart;
          const overlapEnd = dEnd > end ? end : dEnd;
          if (overlapEnd <= overlapStart) return sum;
          const overlapDays = eachDayOfInterval({ start: overlapStart, end: addDays(overlapEnd, -1) }).length;
          return sum + Math.max(0, overlapDays);
        }, 0);
      const taux = Math.min(100, Math.round((occupiedDays / daysInMonth) * 100));
      return {
        chambre: ch.numero,
        categorie: ch.categorie,
        totalReservations: occupiedDays,
        tauxOccupation: taux,
      };
    });
    return stats.sort((a, b) => b.totalReservations - a.totalReservations);
  }, [list, dateRef, rooms]);

  function label() {
    if (view === "month") {
      const formatted = format(dateRef, "LLLL yyyy", { locale: fr });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
    if (view === "week") return `Semaine ${getISOWeek(dateRef)}`;
    const formatted = format(dateRef, "dd LLLL yyyy", { locale: fr });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  function getReservationRooms(r: Reservation) {
    const ids =
      r.chambreIds && r.chambreIds.length > 0
        ? r.chambreIds
        : r.chambreId
          ? [r.chambreId]
          : [];
    const matchingRooms = (rooms || []).filter((c) => ids.includes(c.id));
    if (matchingRooms.length > 0) {
      return matchingRooms.map((c) => c.numero).join(", ");
    }
    return ids.join(", ") || "-";
  }

  function handleExportReservations() {
    const exportData = (list || []).map((r) => ({
      Client: clients?.find((c) => c.id === r.clientId)?.nom || r.clientId,
      Arrivée: format(new Date(r.dateDebut), "dd/MM/yyyy"),
      Départ: r.dateFin ? format(new Date(r.dateFin), "dd/MM/yyyy") : "-",
      "Chambre(s)": getReservationRooms(r),
      Statut: r.statut,
      Personnes: r.nbPersonnes || "-",
    }));

    exportToCSV(exportData, "reservations_hebergement");
  }

  function handleExportPDF() {
    const exportData = (list || []).map((r) => ({
      Client: clients?.find((c) => c.id === r.clientId)?.nom || r.clientId,
      Arrivée: format(new Date(r.dateDebut), "dd/MM/yyyy"),
      Départ: r.dateFin ? format(new Date(r.dateFin), "dd/MM/yyyy") : "-",
      "Chambre(s)": getReservationRooms(r),
      Statut: r.statut,
      Personnes: r.nbPersonnes || "-",
    }));

    exportToPDF("Liste des réservations - Hébergement", exportData, "reservations_hebergement", publicConfig?.nom);
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} mb={2}>
        Hébergement — Gestion des chambres
      </Typography>

      {/* Statistique chambre la plus occupée */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: "primary.50", border: "1px solid", borderColor: "primary.200" }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <TrendingUpIcon color="primary" fontSize="small" />
                <Typography variant="caption" fontWeight={700} color="primary.main">
                  Chambre la plus occupée
                </Typography>
              </Stack>
              {chambresStats[0] && (
                <>
                  <Typography variant="h4" fontWeight={800}>
                    {chambresStats[0].chambre}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {chambresStats[0].categorie}
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="primary.main" sx={{ mt: 0.5 }}>
                    {chambresStats[0].tauxOccupation}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Taux d'occupation
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Calendrier */}
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              justifyContent="space-between"
              sx={{ mb: 1 }}
            >
              <Stack direction="row" spacing={1}>
                <Chip
                  size="small"
                  label="Mensuel"
                  color={view === "month" ? "primary" : "default"}
                  variant={view === "month" ? "filled" : "outlined"}
                  onClick={() => setView("month")}
                />
                <Chip
                  size="small"
                  label="Hebdo"
                  color={view === "week" ? "primary" : "default"}
                  variant={view === "week" ? "filled" : "outlined"}
                  onClick={() => setView("week")}
                />
                <Chip
                  size="small"
                  label="Jour"
                  color={view === "day" ? "primary" : "default"}
                  variant={view === "day" ? "filled" : "outlined"}
                  onClick={() => setView("day")}
                />
                <Chip size="small" label="Aujourd'hui" variant="outlined" onClick={() => setDateRef(new Date())} />
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={label()} />
                <Chip
                  size="small"
                  label="◀"
                  onClick={() =>
                    setDateRef((d) =>
                      view === "month" ? addDays(d, -30) : view === "week" ? addDays(d, -7) : addDays(d, -1)
                    )
                  }
                />
                <Chip
                  size="small"
                  label="▶"
                  onClick={() =>
                    setDateRef((d) =>
                      view === "month" ? addDays(d, 30) : view === "week" ? addDays(d, 7) : addDays(d, 1)
                    )
                  }
                />
              </Stack>
            </Stack>
            <RoomCalendar
              view={view}
              dateRef={dateRef}
              statusFilter={"all"}
              reservations={list || []}
              chambres={rooms || []}
              maintenance={maintenance || []}
              onSelectReservation={(r) => setOpen(r)}
              onCellClick={(_chambreId, _date, r) => {
                if (r) setOpen(r);
              }}
            />
            <Stack direction="row" spacing={2} sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }} flexWrap="wrap" rowGap={1}>
              <Legend color="#FFFFFF" label="Libre" />
              <Legend color="#F59E0B" label="En attente / Devis" />
              <Legend color="#66BB6A" label="Réservée" />
              <Legend color="#EF5350" label="Occupée" />
              <Legend color="#9E9E9E" label="Hors service" />
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography fontWeight={800}>Réservations — Liste</Typography>
              <Stack direction="row" spacing={1}>
                {!isDircom && (
                  <>
                    <Button variant="outlined" onClick={handleExportReservations}>
                      Export CSV
                    </Button>
                    <Button variant="outlined" onClick={handleExportPDF}>
                      Export PDF
                    </Button>
                  </>
                )}
                <Button variant="contained" onClick={() => setCreateModalOpen(true)}>
                  Nouvelle réservation
                </Button>
              </Stack>
            </Stack>
            {!isDircom && (
              <Paper sx={{ p: 1, mb: 1 }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    Hors service (période)
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Select
                      size="small"
                      value={maintRoomId}
                      onChange={(e) => setMaintRoomId(e.target.value)}
                      sx={{ minWidth: 160 }}
                    >
                      {(rooms || []).map((r) => (
                        <MenuItem key={r.id} value={r.id}>
                          {r.numero}
                        </MenuItem>
                      ))}
                    </Select>
                    <TextField
                      size="small"
                      type="date"
                      label="Début"
                      value={maintStart}
                      onChange={(e) => setMaintStart(e.target.value)}
                      sx={{ minWidth: 160 }}
                    />
                    <TextField
                      size="small"
                      type="date"
                      label="Fin"
                      value={maintEnd}
                      onChange={(e) => setMaintEnd(e.target.value)}
                      sx={{ minWidth: 160 }}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        if (!maintRoomId || !maintStart || !maintEnd) return;
                        const maintToDelete = (maintenance || []).find(
                          (m) =>
                            m.chambreId === maintRoomId &&
                            (m.dateDebut === maintStart || (m as any).start === maintStart) &&
                            (m.dateFin === maintEnd || (m as any).end === maintEnd)
                        );
                        if (maintToDelete) {
                          removeMaint.mutate(maintToDelete.id, {
                            onSuccess: () => updateRoom.mutate({ id: maintRoomId, statut: "libre" } as any),
                          });
                        }
                      }}
                    >
                      Réactiver
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => {
                        if (!maintRoomId || !maintStart || !maintEnd) return;
                        addMaint.mutate({ chambreId: maintRoomId, dateDebut: maintStart, dateFin: maintEnd });
                      }}
                    >
                      Marquer HS
                    </Button>
                  </Box>
                </Stack>
              </Paper>
            )}
            <Box sx={{ overflowX: "auto", width: "100%", pb: 1 }}>
              <Box sx={{ minWidth: 920 }}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1.25fr 115px 115px 145px 165px 125px 175px",
                    px: 1.5,
                    py: 1,
                    color: "text.secondary",
                    fontWeight: 700,
                  }}
                >
                  <Box>Client</Box>
                  <Box>Arrivée</Box>
                  <Box>Départ</Box>
                  <Box>Chambre(s)</Box>
                  <Box sx={{ pr: 1 }}>Montant & Acompte</Box>
                  <Box sx={{ px: 0.5 }}>Statut</Box>
                  <Box>Actions</Box>
                </Box>
                {(list || []).map((r) => {
                  const allF = (factures || []).filter((x) => x.reservationId === r.id && x.source === "Hebergement");
                  const f = allF.find((x) => !isProformaDocument(x) && x.statut !== "annulee") || allF.find((x) => x.statut !== "annulee") || allF[0];
                  const stays = getReservationStays(r);
                  const isMultiStay = stays.length > 1;
                  const accompteVal = Number(f?.accompte || (r as any).accompte || 0);
                  const methodeAccompte = f?.methodePaiementAccompte || (r as any).methodePaiementAccompte || "especes";
                  const estimatedStayCost = stays.reduce((sum, st) => {
                    const ch = (rooms || []).find((c) => c.id === st.chambreId);
                    const s = new Date(st.dateDebut);
                    const e = st.dateFin ? new Date(st.dateFin) : addDays(s, 1);
                    const nuits = Math.max(1, eachDayOfInterval({ start: s, end: addDays(e, -1) }).length);
                    return sum + (ch?.tarif_base || 0) * nuits;
                  }, 0);
                  
                  // Détection stricte : appartient à la commerciale connectée UNIQUEMENT si createdBy correspond
                  const isMyReservation = Boolean(
                    userEmail && r.createdBy && r.createdBy.toLowerCase() === userEmail.toLowerCase()
                  );
                  const isOtherStaffReservation = Boolean(isDircom && !isMyReservation);

                  const clientNom =
                    clients?.find((c) => c.id === r.clientId)?.nom ??
                    (r as any).clientNom ??
                    r.clientId ??
                    "Client";

                  return (
                    <Box
                      key={r.id}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "1.25fr 115px 115px 145px 165px 125px 175px",
                        px: 1.5,
                        py: 1.2,
                        alignItems: "center",
                        borderTop: "1px solid",
                        borderColor: "divider",
                        cursor: "pointer",
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                      onClick={() => setOpen(r)}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={700} sx={{ color: isOtherStaffReservation ? "text.secondary" : "inherit" }}>
                          {clientNom}
                        </Typography>
                        {isMultiStay && (
                          <Chip
                            size="small"
                            label={`${stays.length} séjours distincts`}
                            color={isOtherStaffReservation ? "default" : "primary"}
                            sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700, mt: 0.3 }}
                          />
                        )}
                      </Box>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {format(new Date(r.dateDebut), "dd/MM/yyyy")}
                        </Typography>
                        {isMultiStay && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            (1er séjour)
                          </Typography>
                        )}
                      </Box>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {r.dateFin ? format(new Date(r.dateFin), "dd/MM/yyyy") : "-"}
                        </Typography>
                        {isMultiStay && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            (Dernier départ)
                          </Typography>
                        )}
                      </Box>
                      <Box fontWeight={600} color={isOtherStaffReservation ? "text.secondary" : "primary.main"}>
                        {getReservationRooms(r)}
                        {isMultiStay && (
                          <Box sx={{ fontSize: "0.68rem", color: "text.secondary", mt: 0.3 }}>
                            {stays.map((s, idx) => {
                              const ch = rooms?.find((c) => c.id === s.chambreId);
                              const chNum = ch?.numero || s.chambreId;
                              const dDeb = format(new Date(s.dateDebut), "dd/MM");
                              const dFin = s.dateFin ? format(new Date(s.dateFin), "dd/MM") : "";
                              return (
                                <div key={s.id || idx}>
                                  • {chNum} : {dDeb} → {dFin} ({s.nuits || 1}n)
                                </div>
                              );
                            })}
                          </Box>
                        )}
                      </Box>
                      <Box onClick={(e) => e.stopPropagation()}>
                        {f ? (
                          <Box>
                            {isOtherStaffReservation ? (
                              <Typography variant="body2" fontWeight={800} sx={{ fontSize: "0.88rem", color: "#1e293b" }}>
                                {f.totalTTC.toLocaleString("fr-FR")} Ar
                              </Typography>
                            ) : (
                              <Button
                                size="small"
                                variant="text"
                                sx={{ fontWeight: 800, p: 0, minWidth: 0, textTransform: "none", fontSize: "0.88rem" }}
                                onClick={() => navigate(`/${tenantId}/financier?factureId=${f.id}`)}
                              >
                                {f.totalTTC.toLocaleString("fr-FR")} Ar
                              </Button>
                            )}
                            {accompteVal > 0 && (
                              <Box sx={{ mt: 0.2 }}>
                                <Chip
                                  size="small"
                                  label={`Acompte: ${accompteVal.toLocaleString("fr-FR")} Ar`}
                                  sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700, bgcolor: "#dcfce7", color: "#166534" }}
                                />
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: "0.68rem", mt: 0.1 }}>
                                  Reste: {Math.max(0, f.totalTTC - accompteVal).toLocaleString("fr-FR")} Ar
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        ) : estimatedStayCost > 0 ? (
                          <Box>
                            <Typography variant="body2" fontWeight={700} sx={{ fontSize: "0.85rem", color: "#334155" }}>
                              {estimatedStayCost.toLocaleString("fr-FR")} Ar
                            </Typography>
                            {accompteVal > 0 ? (
                              <Box sx={{ mt: 0.2 }}>
                                <Chip
                                  size="small"
                                  label={`Acompte: ${accompteVal.toLocaleString("fr-FR")} Ar`}
                                  sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700, bgcolor: "#dcfce7", color: "#166534" }}
                                />
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: "0.68rem", mt: 0.1 }}>
                                  Reste: {Math.max(0, estimatedStayCost - accompteVal).toLocaleString("fr-FR")} Ar
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: "0.65rem" }}>
                                (Non facturée)
                              </Typography>
                            )}
                          </Box>
                        ) : accompteVal > 0 ? (
                          <Box>
                            <Chip
                              size="small"
                              label={`Acompte: ${accompteVal.toLocaleString("fr-FR")} Ar`}
                              sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: "#dcfce7", color: "#166534" }}
                            />
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: "0.68rem", mt: 0.2 }}>
                              ({methodeAccompte === "mobile_money" ? "Mobile Money" : methodeAccompte === "virement" ? "Virement" : methodeAccompte === "carte" ? "Carte" : "Espèces"})
                            </Typography>
                          </Box>
                        ) : (
                          <Chip size="small" label="—" variant="outlined" />
                        )}
                      </Box>
                      <Box>
                        {(() => {
                          const st = deriveReservationStatus(r);
                          const labelMap: Record<string, string> = {
                            en_attente: "En attente / Devis",
                            confirmee: "Confirmée",
                            arrivee: "Occupée",
                            terminee: "Terminée",
                            annulee: "Annulée",
                          };
                          const colorMap: Record<string, "warning" | "success" | "error" | "default"> = {
                            en_attente: "warning",
                            confirmee: "success",
                            arrivee: "error",
                            terminee: "default",
                            annulee: "default",
                          };
                          return (
                            <Chip
                              size="small"
                              label={labelMap[st] || st}
                              color={colorMap[st] || "default"}
                              variant={st === "en_attente" ? "filled" : "outlined"}
                              sx={st === "en_attente" ? { bgcolor: "#fef3c7", color: "#92400e", fontWeight: 700 } : undefined}
                            />
                          );
                        })()}
                      </Box>
                      <Box sx={{ display: "flex", gap: 0.8, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                        <Button size="small" variant="outlined" onClick={() => setOpen(r)}>
                          {isOtherStaffReservation ? "Consulter" : "Voir / Gérer"}
                        </Button>
                        {!isOtherStaffReservation && (!f || f.statut === "annulee" || isProformaDocument(f)) && (
                          <Button
                            size="small"
                            variant="contained"
                            color={isProformaDocument(f) ? "warning" : "primary"}
                            disabled={generateInvoiceMutation.isPending}
                            onClick={() => {
                              generateInvoiceMutation.mutate(
                                { reservation: r, typeDocument: "facture" },
                                {
                                  onSuccess: (newDoc: any) => {
                                    if (newDoc?.id) {
                                      navigate(`/${tenantId}/financier?factureId=${newDoc.id}`);
                                    }
                                  },
                                  onError: (err) => {
                                    console.error("Facturation error:", err);
                                    alert("Erreur lors de la génération de la facture.");
                                  },
                                }
                              );
                            }}
                          >
                            {isProformaDocument(f) ? "Valider Facture" : "Facturer"}
                          </Button>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={!!open} onClose={() => setOpen(null)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={800}>
          {open && Boolean(isDircom && (!open.createdBy || open.createdBy.toLowerCase() !== userEmail.toLowerCase()))
            ? "Détails de la réservation (Consultation — Lecture seule)"
            : "Détails de la réservation"}
        </DialogTitle>
        <DialogContent>
          {!open && <Typography color="text.secondary">Sélectionnez une réservation</Typography>}
          {open && (
            <EditReservation
              r={open}
              reservations={list || []}
              rooms={rooms || []}
              maintenance={maintenance || []}
              onClose={() => setOpen(null)}
              onSave={(p) => update.mutate(p as any, { onSuccess: () => setOpen(null) })}
              isDircom={isDircom}
              userEmail={userEmail}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal pour créer une nouvelle réservation */}
      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={800}>Nouvelle réservation</DialogTitle>
        <DialogContent>
          <CreateReservationForm
            reservations={list || []}
            rooms={rooms || []}
            maintenance={maintenance || []}
            onClose={() => setCreateModalOpen(false)}
            initialClientId={searchParams.get("clientId") || undefined}
            isDircom={isDircom}
            userEmail={userEmail}
            onCreate={(payload) => {
              create.mutate(
                { ...payload, ...(isDircom && userEmail ? { createdBy: userEmail } : {}) },
                {
                  onSuccess: () => setCreateModalOpen(false),
                }
              );
            }}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}

function Ariary({ value }: { value: number }) {
  return <>{value.toLocaleString("fr-MG")} Ar</>;
}

// Composant de style pour le menu déroulant Autocomplete
const autocompletePaperProps = {
  elevation: 8,
  sx: {
    borderRadius: 2,
    border: "1px solid",
    borderColor: "divider",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
    mt: 0.5,
    overflow: "hidden",
    "& .MuiAutocomplete-listbox": {
      p: 0.5,
      maxHeight: 280,
      "& li": {
        borderRadius: 1,
        mb: 0.3,
        px: 1.5,
        py: 1,
        borderBottom: "1px solid #f1f5f9",
        "&:last-child": { borderBottom: "none" },
        "&:hover": {
          bgcolor: "action.hover",
        },
        '&[aria-selected="true"]': {
          bgcolor: "primary.50",
          fontWeight: 700,
        },
      },
    },
  },
};

interface RoomRange {
  start: Date;
  end: Date;
}

function CreateReservationForm({
  reservations,
  rooms,
  maintenance,
  onClose,
  onCreate,
  initialClientId,
  isDircom,
  userEmail,
}: {
  reservations: Reservation[];
  rooms: Chambre[];
  maintenance: ChambreMaintenance[];
  onClose: () => void;
  onCreate: (payload: any) => void;
  initialClientId?: string;
  isDircom?: boolean;
  userEmail?: string;
}) {
  const { data: clients } = useClients();
  const visibleClients = useMemo(() => {
    return clients || [];
  }, [clients]);
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const { config } = useTenant();

  const sortedRooms = useMemo(() => sortChambres(rooms || []), [rooms]);

  const availablePacks = useMemo(() => {
    return config?.hebergementPacks && config.hebergementPacks.length > 0
      ? config.hebergementPacks
      : DEFAULT_PACKS;
  }, [config]);

  const [selectedPackId, setSelectedPackId] = useState<string>(availablePacks[0]?.id || "chambre_seule");
  const selectedPack = availablePacks.find((p) => p.id === selectedPackId) || availablePacks[0];

  const today = new Date();
  const [modalDateRef, setModalDateRef] = useState<Date>(today);

  // Gestion indépendante des plages de dates par chambre
  // Multi-séjours : plusieurs plages de dates par chambre
  // Ctrl+Clic = nouveau séjour indépendant pour la même chambre
  const [selectedRoomsMap, setSelectedRoomsMap] = useState<Record<string, RoomRange[]>>({});
  // Index de la plage "en cours d'édition" par chambre (le dernier segment actif)
  const activeSegmentRef = useRef<Record<string, number>>({});

  const initialClient = (clients || []).find((c) => c.id === initialClientId);

  const [form, setForm] = useState({
    clientId: initialClientId ?? "",
    clientNom: initialClient?.nom || "",
    clientTelephone: initialClient?.telephone || "",
    clientAgenceVoyage: initialClient?.agenceVoyage || "",
    clientOrigine: initialClient?.origine || "",
    nbPersonnes: 2,
    statut: "confirmee" as "confirmee" | "en_attente",
    accompte: "",
    methodePaiementAccompte: "especes",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const weekStart = startOfWeek(modalDateRef, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 13) });

  function isRoomAvailable(chambreId: string, date: Date) {
    const nextDay = addDays(date, 1);
    const inMaint = maintenance.some(
      (m) =>
        m.chambreId === chambreId &&
        new Date(m.dateDebut || (m as any).start) < nextDay &&
        new Date(m.dateFin || (m as any).end) > date
    );
    if (inMaint) return false;
    const hasConflict = reservations.some((r) => isRoomReservedDuring(r, chambreId, date, nextDay));
    return !hasConflict;
  }

  // Clic direct et fluide sur une cellule de chambre
  // Ctrl+Clic => nouveau séjour indépendant sur la même chambre
  function handleCellClick(chambreId: string, date: Date, ctrlKey = false) {
    if (!isRoomAvailable(chambreId, date)) return;

    setSelectedRoomsMap((prev) => {
      const ranges = prev[chambreId] || [];

      // --- Ctrl+Clic ou chambre vide : démarre un nouveau segment ---
      if (ctrlKey || ranges.length === 0) {
        // Vérifie que la date ne chevauche pas un segment existant
        const alreadyInRange = ranges.some((r) => date >= r.start && date < r.end);
        if (alreadyInRange) return prev;
        const newRanges = [...ranges, { start: date, end: addDays(date, 1) }];
        activeSegmentRef.current[chambreId] = newRanges.length - 1;
        return { ...prev, [chambreId]: newRanges };
      }

      // --- Clic normal : édite le segment actif (le dernier) ---
      const activeIdx = activeSegmentRef.current[chambreId] ?? ranges.length - 1;
      const current = ranges[activeIdx];
      const newRanges = [...ranges];

      if (isSameDay(date, current.start)) {
        const nights = eachDayOfInterval({ start: current.start, end: addDays(current.end, -1) }).length;
        if (nights <= 1 && ranges.length === 1) {
          // Seul segment d'1 nuit : on désélectionne toute la chambre
          const next = { ...prev };
          delete next[chambreId];
          delete activeSegmentRef.current[chambreId];
          return next;
        } else if (nights <= 1) {
          // Plusieurs segments : on supprime ce segment
          newRanges.splice(activeIdx, 1);
          activeSegmentRef.current[chambreId] = Math.max(0, newRanges.length - 1);
          return { ...prev, [chambreId]: newRanges };
        } else {
          // Réduire à 1 nuit
          newRanges[activeIdx] = { start: date, end: addDays(date, 1) };
          return { ...prev, [chambreId]: newRanges };
        }
      }

      if (date > current.start) {
        const targetEnd = addDays(date, 1);
        const days = eachDayOfInterval({ start: current.start, end: date });
        const allFree = days.every((d) => isRoomAvailable(chambreId, d));
        // Vérifie aussi qu'on ne chevauche pas un autre segment
        const overlapOther = ranges.some((r, i) => {
          if (i === activeIdx) return false;
          return date >= r.start && date < r.end;
        });
        if (allFree && !overlapOther) {
          newRanges[activeIdx] = { start: current.start, end: targetEnd };
        } else {
          // Conflit : nouveau segment
          const alreadyIn = ranges.some((r) => date >= r.start && date < r.end);
          if (!alreadyIn) {
            newRanges.push({ start: date, end: addDays(date, 1) });
            activeSegmentRef.current[chambreId] = newRanges.length - 1;
          }
        }
        return { ...prev, [chambreId]: newRanges };
      } else {
        // Clic avant le début : étend le début du segment actif
        const currentLastDay = addDays(current.end, -1);
        const days = eachDayOfInterval({ start: date, end: currentLastDay });
        const allFree = days.every((d) => isRoomAvailable(chambreId, d));
        if (allFree) {
          newRanges[activeIdx] = { start: date, end: current.end };
        } else {
          const alreadyIn = ranges.some((r) => date >= r.start && date < r.end);
          if (!alreadyIn) {
            newRanges.push({ start: date, end: addDays(date, 1) });
            activeSegmentRef.current[chambreId] = newRanges.length - 1;
          }
        }
        return { ...prev, [chambreId]: newRanges };
      }
    });
  }

  function getCellColor(chambreId: string, date: Date) {
    const chambre = rooms.find((c) => c.id === chambreId);
    if (chambre?.statut === "maintenance") return "#9E9E9E";

    // Multi-séjours : vérifie si la date est dans l'une des plages sélectionnées
    const ranges = selectedRoomsMap[chambreId];
    if (ranges && ranges.length > 0) {
      const activeIdx = activeSegmentRef.current[chambreId] ?? ranges.length - 1;
      const matchedIdx = ranges.findIndex((r) => date >= r.start && date < r.end);
      if (matchedIdx !== -1) {
        // Segment actif = vert vif, autres segments = vert foncé
        return matchedIdx === activeIdx ? "#66BB6A" : "#2E7D32";
      }
    }

    const nextDay = addDays(date, 1);
    const inMaint = maintenance.some(
      (m) =>
        m.chambreId === chambreId &&
        new Date(m.dateDebut || (m as any).start) < nextDay &&
        new Date(m.dateFin || (m as any).end) > date
    );
    if (inMaint) return "#9E9E9E";

    const conflict = reservations.find((r) => isRoomReservedDuring(r, chambreId, date, nextDay));
    if (conflict) {
      const conflictHasAcompte = Number((conflict as any).accompte || 0) > 0;
      if (conflict.statut === "en_attente" && !conflictHasAcompte) return "#F59E0B";
      return "#EF5350";
    }

    return "#FFFFFF";
  }

  function handleRemoveRoom(chambreId: string, rangeIdx?: number) {
    setSelectedRoomsMap((prev) => {
      const ranges = prev[chambreId];
      if (rangeIdx !== undefined && ranges && ranges.length > 1) {
        // Supprimer uniquement le segment spécifié
        const newRanges = ranges.filter((_, i) => i !== rangeIdx);
        const active = activeSegmentRef.current[chambreId] ?? ranges.length - 1;
        activeSegmentRef.current[chambreId] = Math.min(active, newRanges.length - 1);
        return { ...prev, [chambreId]: newRanges };
      }
      // Supprimer toute la chambre
      const next = { ...prev };
      delete next[chambreId];
      delete activeSegmentRef.current[chambreId];
      return next;
    });
  }

  const selectedRoomEntries = Object.entries(selectedRoomsMap);
  const totalStaysCount = selectedRoomEntries.reduce((sum, [, ranges]) => sum + ranges.length, 0);
  const isValid =
    (form.clientId || form.clientNom.trim()) && selectedRoomEntries.length > 0;

  async function handleCreate() {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);

    let clientId = form.clientId;

    if (!clientId && form.clientNom) {
      try {
        const newClient = await createClient.mutateAsync({
          nom: form.clientNom.trim(),
          telephone: form.clientTelephone.trim() || undefined,
          agenceVoyage: form.clientAgenceVoyage.trim() || undefined,
          origine: form.clientOrigine.trim() || undefined,
          ...(isDircom && userEmail ? { createdBy: userEmail } : {}),
        });
        clientId = newClient.id;
      } catch (error) {
        console.error("Erreur lors de la création du client:", error);
        setIsSubmitting(false);
        return;
      }
    } else if (clientId) {
      const existingClient = clients?.find((c) => c.id === clientId);
      if (existingClient) {
        const updates: Partial<Client> = {};
        if (form.clientTelephone !== (existingClient.telephone || "")) updates.telephone = form.clientTelephone;
        if (form.clientAgenceVoyage !== (existingClient.agenceVoyage || "")) updates.agenceVoyage = form.clientAgenceVoyage;
        if (form.clientOrigine !== (existingClient.origine || "")) updates.origine = form.clientOrigine;
        if (Object.keys(updates).length > 0) {
          updateClient.mutate({ id: clientId, ...updates });
        }
      }
    }

    // Calculer les dates globales, séjours et détails par chambre (multi-séjours)
    const details: ReservationChambreDetail[] = [];
    const allStays: Stay[] = [];
    let globalStart: Date | null = null;
    let globalEnd: Date | null = null;
    const roomIds: string[] = [];
    let stayIndex = 0;

    for (const [rId, ranges] of selectedRoomEntries) {
      roomIds.push(rId);
      const ch = rooms.find((c) => c.id === rId);
      // Trier les plages par date de début
      const sortedRanges = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
      for (const range of sortedRanges) {
        stayIndex++;
        const nights = Math.max(1, eachDayOfInterval({ start: range.start, end: addDays(range.end, -1) }).length);
        details.push({
          chambreId: rId,
          dateDebut: range.start.toISOString(),
          dateFin: range.end.toISOString(),
          nuits: nights,
          tarifBase: ch?.tarif_base || 0,
        });
        allStays.push({
          id: `stay_${stayIndex}`,
          chambreId: rId,
          dateDebut: range.start.toISOString(),
          dateFin: range.end.toISOString(),
          nuits: nights,
          statut: form.statut,
          nbPersonnes: form.nbPersonnes,
          tarifBase: ch?.tarif_base || 0,
          packId: selectedPack?.id,
          packNom: selectedPack?.nom,
          packPrix: selectedPack?.prix,
          packTypeCalcul: selectedPack?.typeCalcul,
        });
        if (!globalStart || range.start < globalStart) globalStart = range.start;
        if (!globalEnd || range.end > globalEnd) globalEnd = range.end;
      }
    }

    const finalStatut = (Number(form.accompte || 0) > 0 && form.statut === "en_attente") ? "confirmee" : form.statut;

    onCreate({
      clientId,
      chambreIds: roomIds,
      chambreId: roomIds[0] || "",
      chambresDetails: details,
      stays: allStays,
      dateDebut: globalStart ? globalStart.toISOString() : new Date().toISOString(),
      dateFin: globalEnd ? globalEnd.toISOString() : addDays(new Date(), 1).toISOString(),
      nbPersonnes: form.nbPersonnes,
      statut: finalStatut,
      packId: selectedPack?.id,
      packNom: selectedPack?.nom,
      packPrix: selectedPack?.prix,
      packTypeCalcul: selectedPack?.typeCalcul,
      accompte: form.accompte ? Number(form.accompte) : 0,
      methodePaiementAccompte: form.methodePaiementAccompte,
    });
  }

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <Typography variant="body2" fontWeight={700}>
        Client
      </Typography>
      <Autocomplete
        freeSolo
        options={visibleClients}
        getOptionLabel={(option) => (typeof option === "string" ? option : option.nom)}
        value={
          clients?.find((c) => c.id === form.clientId) ||
          (form.clientNom ? ({ id: "", nom: form.clientNom, telephone: form.clientTelephone } as any) : null)
        }
        onChange={(_, newValue) => {
          if (newValue && typeof newValue !== "string") {
            setForm({
              ...form,
              clientId: newValue.id,
              clientNom: newValue.nom,
              clientTelephone: newValue.telephone || "",
              clientAgenceVoyage: newValue.agenceVoyage || "",
              clientOrigine: newValue.origine || "",
            });
          } else if (typeof newValue === "string") {
            setForm({
              ...form,
              clientId: "",
              clientNom: newValue,
              clientTelephone: "",
              clientAgenceVoyage: "",
              clientOrigine: "",
            });
          } else {
            setForm({
              ...form,
              clientId: "",
              clientNom: "",
              clientTelephone: "",
              clientAgenceVoyage: "",
              clientOrigine: "",
            });
          }
        }}
        onInputChange={(_, newInputValue, reason) => {
          if (reason === "input") {
            const matched = (clients || []).find((c) => c.nom.toLowerCase() === newInputValue.trim().toLowerCase());
            if (matched) {
              setForm((prev) => ({
                ...prev,
                clientId: matched.id,
                clientNom: matched.nom,
                clientTelephone: matched.telephone || prev.clientTelephone,
                clientAgenceVoyage: matched.agenceVoyage || prev.clientAgenceVoyage,
                clientOrigine: matched.origine || prev.clientOrigine,
              }));
            } else {
              setForm((prev) => ({
                ...prev,
                clientNom: newInputValue,
                clientId: "",
              }));
            }
          }
        }}
        componentsProps={{ paper: autocompletePaperProps }}
        renderOption={(props, option) => (
          <li {...props} key={option.id}>
            <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", py: 0.5 }}>
              <Typography variant="body2" fontWeight={700}>
                {option.nom}
              </Typography>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                {option.telephone && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ bgcolor: "action.hover", px: 0.8, py: 0.2, borderRadius: 1 }}
                  >
                    📞 {option.telephone}
                  </Typography>
                )}
                {option.agenceVoyage && (
                  <Chip size="small" label={`✈️ ${option.agenceVoyage}`} variant="outlined" sx={{ height: 20, fontSize: "0.65rem" }} />
                )}
              </Box>
            </Box>
          </li>
        )}
        renderInput={(params) => (
          <TextField {...params} size="small" label="Nom du client" placeholder="Sélectionner un client existant ou saisir un nouveau nom" />
        )}
      />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          size="small"
          fullWidth
          label="Numéro de contact (Optionnel)"
          value={form.clientTelephone}
          onChange={(e) => setForm({ ...form, clientTelephone: e.target.value })}
          placeholder="Ex: 034 00 000 00"
        />
        <TextField
          size="small"
          fullWidth
          label="Agence de voyage (Optionnel)"
          value={form.clientAgenceVoyage}
          onChange={(e) => setForm({ ...form, clientAgenceVoyage: e.target.value })}
          placeholder="Ex: Booking, Expedia, Agence A..."
        />
      </Stack>

      <TextField
        size="small"
        fullWidth
        label="Origine (Canal de réservation)"
        value={form.clientOrigine}
        onChange={(e) => setForm({ ...form, clientOrigine: e.target.value })}
        placeholder="Ex: Site web, Téléphone direct, Booking, Recommandation..."
      />

      <Divider />

      <Typography variant="body2" fontWeight={700}>
        Acompte (Optionnel)
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
        <TextField
          size="small"
          label="Montant de l'acompte (Ar)"
          type="number"
          value={form.accompte}
          onChange={(e) => {
            const val = e.target.value;
            const num = Number(val || 0);
            setForm((prev) => ({
              ...prev,
              accompte: val,
              statut: num > 0 && prev.statut === "en_attente" ? "confirmee" : prev.statut,
            }));
          }}
        />
        <Select
          size="small"
          value={form.methodePaiementAccompte}
          onChange={(e) => setForm({ ...form, methodePaiementAccompte: e.target.value })}
        >
          <MenuItem value="especes">Espèces</MenuItem>
          <MenuItem value="mobile_money">Mobile Money (MVola, etc.)</MenuItem>
          <MenuItem value="virement">Virement</MenuItem>
          <MenuItem value="carte">Carte</MenuItem>
        </Select>
      </Box>

      <Divider />

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" fontWeight={700}>
          Sélectionnez les chambres et leurs dates
        </Typography>
        {selectedRoomEntries.length > 0 && (
          <Chip
            size="small"
            color="primary"
            label={`${selectedRoomEntries.length} chambre${selectedRoomEntries.length > 1 ? "s" : ""} · ${totalStaysCount} séjour${totalStaysCount > 1 ? "s" : ""}`}
          />
        )}
      </Stack>
      {/* Hint multi-séjours */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, bgcolor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 1, px: 1.5, py: 0.7 }}>
        <Typography variant="caption" color="#1d4ed8" sx={{ fontWeight: 600 }}>
          💡 Ctrl+Clic sur une cellule libre = nouveau séjour indépendant pour la même chambre
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} alignItems="center">
        <Chip size="small" label={`Semaine du ${format(weekStart, "dd MMM yyyy", { locale: fr })}`} />
        <Chip size="small" label="◀" onClick={() => setModalDateRef((d) => addDays(d, -7))} />
        <Chip size="small" label="▶" onClick={() => setModalDateRef((d) => addDays(d, 7))} />
      </Stack>

      {/* Calendrier interactif avec sélection indépendante par chambre */}
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          p: 1,
          maxHeight: 280,
          overflowY: "auto",
          overflowX: "auto",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `80px repeat(${weekDays.length}, minmax(80px, 1fr))`,
            gap: 0.5,
            minWidth: "max-content",
          }}
        >
          <Box />
          {weekDays.map((d) => (
            <Box key={d.toISOString()} sx={{ textAlign: "center", fontSize: "0.7rem", fontWeight: 600, py: 0.5 }}>
              {format(d, "EEE d", { locale: fr })}
            </Box>
          ))}

          {sortedRooms.map((chambre) => {
            const ranges = selectedRoomsMap[chambre.id] || [];
            const isSelected = ranges.length > 0;
            const stayCount = ranges.length;
            return (
              <Fragment key={chambre.id}>
                <Box
                  sx={{
                    py: 0.5,
                    fontSize: "0.75rem",
                    fontWeight: isSelected ? 800 : 600,
                    color: isSelected ? "primary.main" : "inherit",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 0.2,
                  }}
                >
                  {chambre.numero}
                  {stayCount > 1 && (
                    <Box
                      component="span"
                      sx={{
                        fontSize: "0.6rem",
                        bgcolor: "#1d4ed8",
                        color: "#fff",
                        px: 0.5,
                        borderRadius: "4px",
                        lineHeight: 1.4,
                      }}
                    >
                      {stayCount} séjours
                    </Box>
                  )}
                </Box>
                {weekDays.map((date) => {
                  const available = isRoomAvailable(chambre.id, date);
                  const color = getCellColor(chambre.id, date);
                  const isCtrlHint = isSelected && available;

                  return (
                    <Box
                      key={`${chambre.id}-${date.toISOString()}`}
                      onClick={(e) => available && handleCellClick(chambre.id, date, e.ctrlKey || e.metaKey)}
                      title={isCtrlHint ? "Ctrl+Clic pour ajouter un séjour distinct" : undefined}
                      sx={{
                        height: 32,
                        bgcolor: color,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: "4px",
                        cursor: available ? "pointer" : "not-allowed",
                        opacity: available ? 1 : 0.5,
                        "&:hover": available ? { opacity: 0.8 } : {},
                      }}
                    />
                  );
                })}
              </Fragment>
            );
          })}
        </Box>
      </Box>

      <Stack direction="row" spacing={1} sx={{ fontSize: "0.75rem", mt: 1 }} flexWrap="wrap">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: "#FFFFFF", border: "1px solid #ccc", borderRadius: "2px" }} />
          <Typography variant="caption">Libre</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: "#66BB6A", borderRadius: "2px" }} />
          <Typography variant="caption">Sélectionné</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: "#F59E0B", borderRadius: "2px" }} />
          <Typography variant="caption">En attente / Devis</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: "#EF5350", borderRadius: "2px" }} />
          <Typography variant="caption">Confirmé / Occupé</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: "#9E9E9E", borderRadius: "2px" }} />
          <Typography variant="caption">Hors service</Typography>
        </Box>
      </Stack>

      <Box>
        <Typography variant="body2" fontWeight={700} mb={0.5}>
          Formule / Pack de séjour
        </Typography>
        <Select
          size="small"
          fullWidth
          value={selectedPackId}
          onChange={(e) => setSelectedPackId(e.target.value)}
        >
          {availablePacks.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.nom}{" "}
              {p.prix > 0
                ? `(+${p.prix.toLocaleString("fr-FR")} Ar ${p.typeCalcul === "par_personne_nuit" ? "/ pers. / nuit" : p.typeCalcul === "par_chambre_nuit" ? "/ nuit" : "forfait"})`
                : "(Inclus)"}
            </MenuItem>
          ))}
        </Select>
      </Box>

      <TextField
        size="small"
        type="number"
        label="Nombre de personnes"
        value={form.nbPersonnes}
        onChange={(e) => setForm({ ...form, nbPersonnes: parseInt(e.target.value || "1", 10) })}
        inputProps={{ min: 1 }}
      />

      <Select
        size="small"
        value={form.statut}
        onChange={(e) => setForm({ ...form, statut: e.target.value as any })}
      >
        <MenuItem value="en_attente">En attente / Devis</MenuItem>
        <MenuItem value="confirmee">Confirmée</MenuItem>
      </Select>

      {/* Résumé & Estimation tarifaire en temps réel par chambre */}
      {selectedRoomEntries.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, bgcolor: "#f0fdf4", borderColor: "#bbf7d0", borderRadius: 2 }}>
          {(() => {
            let roomsTotal = 0;
            let maxNights = 1;
            let totalRoomNights = 0;

            // Aplatir toutes les plages en items affichables
            const roomItems: { id: string; rangeIdx: number; numero: string; categorie: string; start: Date; end: Date; nights: number; cost: number }[] = [];
            for (const [rId, ranges] of selectedRoomEntries) {
              const ch = rooms.find((c) => c.id === rId);
              const sortedRanges = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
              sortedRanges.forEach((range, idx) => {
                const nights = Math.max(1, eachDayOfInterval({ start: range.start, end: addDays(range.end, -1) }).length);
                const cost = (ch?.tarif_base || 0) * nights;
                roomsTotal += cost;
                totalRoomNights += nights;
                if (nights > maxNights) maxNights = nights;
                roomItems.push({
                  id: rId,
                  rangeIdx: idx,
                  numero: ch?.numero || rId,
                  categorie: ch?.categorie || "Chambre",
                  start: range.start,
                  end: range.end,
                  nights,
                  cost,
                });
              });
            }

            let packFormulaTotal = 0;
            if (selectedPack && selectedPack.prix > 0) {
              if (selectedPack.typeCalcul === "par_personne_nuit") {
                packFormulaTotal = selectedPack.prix * maxNights * (form.nbPersonnes || 1);
              } else if (selectedPack.typeCalcul === "par_chambre_nuit") {
                packFormulaTotal = selectedPack.prix * totalRoomNights;
              } else {
                packFormulaTotal = selectedPack.prix;
              }
            }

            // Taxes & Vignettes
            const activeTaxes = (config?.hebergementTaxes && config.hebergementTaxes.length > 0)
              ? config.hebergementTaxes.filter((t) => t.actif)
              : DEFAULT_HEBERGEMENT_TAXES;

            const taxItems = activeTaxes.map((t) => {
              let qte = 1;
              if (t.typeCalcul === "fixe") qte = 1;
              else if (t.typeCalcul === "par_nuitee") qte = maxNights;
              else if (t.typeCalcul === "par_chambre_nuitee") qte = totalRoomNights;
              else if (t.typeCalcul === "par_personne_nuitee") qte = maxNights * (form.nbPersonnes || 1);
              const cost = t.montant * qte;
              return { ...t, qte, cost };
            });

            const taxesTotal = taxItems.reduce((s, t) => s + t.cost, 0);
            const estimatedTotal = roomsTotal + packFormulaTotal + taxesTotal;

            return (
              <Stack spacing={1}>
                <Typography variant="subtitle2" fontWeight={800} color="#166534">
                  Détails & Tarification des hébergements
                </Typography>
                <Divider sx={{ my: 0.5, borderColor: "#bbf7d0" }} />
                {roomItems.map((item, flatIdx) => {
                  const totalRangesForRoom = selectedRoomsMap[item.id]?.length ?? 1;
                  const isFirstOfRoom = flatIdx === 0 || roomItems[flatIdx - 1].id !== item.id;
                  return (
                    <Box
                      key={`${item.id}-${item.rangeIdx}`}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.82rem",
                        bgcolor: "rgba(255,255,255,0.6)",
                        p: 0.8,
                        borderRadius: 1,
                        borderLeft: totalRangesForRoom > 1 ? "3px solid #1d4ed8" : "none",
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          Chambre {item.numero} ({item.categorie})
                          {totalRangesForRoom > 1 && (
                            <Box
                              component="span"
                              sx={{ ml: 0.5, fontSize: "0.65rem", bgcolor: "#dbeafe", color: "#1d4ed8", px: 0.6, py: 0.1, borderRadius: "4px" }}
                            >
                              Séjour {item.rangeIdx + 1}/{totalRangesForRoom}
                            </Box>
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Du {format(item.start, "dd/MM/yyyy")} au {format(item.end, "dd/MM/yyyy")} ({item.nights} nuit
                          {item.nights > 1 ? "s" : ""})
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <b>{item.cost.toLocaleString("fr-FR")} Ar</b>
                        <IconButton
                          size="small"
                          color="error"
                          title={totalRangesForRoom > 1 ? "Supprimer ce séjour" : "Retirer cette chambre"}
                          onClick={() => handleRemoveRoom(item.id, totalRangesForRoom > 1 ? item.rangeIdx : undefined)}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Box>
                  );
                })}
                {packFormulaTotal > 0 && (
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "#0369a1", px: 0.8 }}>
                    <span>{selectedPack.nom} :</span>
                    <b>+{packFormulaTotal.toLocaleString("fr-FR")} Ar</b>
                  </Box>
                )}
                {taxItems.map((tax) => (
                  <Box key={tax.id} sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "#64748b", px: 0.8 }}>
                    <span>{tax.nom} ({tax.qte > 1 ? `${tax.qte} nuits × ${tax.montant.toLocaleString('fr-FR')} Ar` : 'Forfait séjour'}) :</span>
                    <b>+{tax.cost.toLocaleString("fr-FR")} Ar</b>
                  </Box>
                ))}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    pt: 1,
                    borderTop: "1px dashed #bbf7d0",
                    color: "#166534",
                    fontWeight: 900,
                    fontSize: "0.95rem",
                  }}
                >
                  <span>Total estimé :</span>
                  <span>{estimatedTotal.toLocaleString("fr-FR")} Ar</span>
                </Box>
                {Number(form.accompte) > 0 && (
                  <>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        color: "#059669",
                        fontWeight: 700,
                        fontSize: "0.88rem",
                        px: 0.5,
                      }}
                    >
                      <span>Acompte versé ({form.methodePaiementAccompte === "mobile_money" ? "Mobile Money" : form.methodePaiementAccompte === "virement" ? "Virement" : form.methodePaiementAccompte === "carte" ? "Carte" : "Espèces"}) :</span>
                      <span>- {Number(form.accompte).toLocaleString("fr-FR")} Ar</span>
                    </Box>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        color: "#1e293b",
                        fontWeight: 900,
                        fontSize: "0.95rem",
                        bgcolor: "#dcfce7",
                        p: 0.8,
                        borderRadius: 1,
                      }}
                    >
                      <span>Reste à payer TTC :</span>
                      <span>{Math.max(0, estimatedTotal - Number(form.accompte)).toLocaleString("fr-FR")} Ar</span>
                    </Box>
                  </>
                )}
              </Stack>
            );
          })()}
        </Paper>
      )}

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={handleCreate} disabled={!isValid || isSubmitting}>
          Créer la réservation
        </Button>
      </Stack>
    </Stack>
  );
}

function EditReservation({
  r,
  reservations,
  rooms,
  maintenance,
  onSave,
  onClose,
  isDircom,
  userEmail,
}: {
  r: Reservation;
  reservations: Reservation[];
  rooms: Chambre[];
  maintenance: ChambreMaintenance[];
  onSave: (p: Partial<Reservation> & { id: string }) => void;
  onClose: () => void;
  isDircom?: boolean;
  userEmail?: string;
}) {
  const { tenantId, config } = useTenant();
  const navigate = useNavigate();
  const { data: clients } = useClients();
  const isMyReservation = Boolean(
    userEmail && r.createdBy && r.createdBy.toLowerCase() === userEmail.toLowerCase()
  );
  const isOtherStaffReservation = Boolean(isDircom && !isMyReservation);
  const visibleClients = useMemo(() => {
    return clients || [];
  }, [clients]);
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteReservation = useDeleteHebergementReservation();
  const { data: factures } = useFactures();
  const generateInvoiceMutation = useGenerateHebergementInvoice();

  const sortedRooms = useMemo(() => sortChambres(rooms || []), [rooms]);

  const availablePacks = useMemo(() => {
    return config?.hebergementPacks && config.hebergementPacks.length > 0
      ? config.hebergementPacks
      : DEFAULT_PACKS;
  }, [config]);

  const [selectedPackId, setSelectedPackId] = useState<string>(r.packId || availablePacks[0]?.id || "chambre_seule");
  const selectedPack = availablePacks.find((p) => p.id === selectedPackId) || availablePacks[0];

  const currentClient = clients?.find((c) => c.id === r.clientId);

  // Initialiser les plages de dates indépendantes pour chaque chambre (multi-séjours)
  const [selectedRoomsMap, setSelectedRoomsMap] = useState<Record<string, RoomRange[]>>(() => {
    const map: Record<string, RoomRange[]> = {};
    const stays = getReservationStays(r);
    stays.forEach((st) => {
      if (!map[st.chambreId]) map[st.chambreId] = [];
      const s = new Date(st.dateDebut);
      const e = st.dateFin ? new Date(st.dateFin) : addDays(s, 1);
      map[st.chambreId].push({ start: s, end: e });
    });
    // Trier les plages chronologiquement
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => a.start.getTime() - b.start.getTime());
    });
    return map;
  });
  const activeSegmentRef = useRef<Record<string, number>>({});

  const initialStart = new Date(r.dateDebut);
  const [modalDateRef, setModalDateRef] = useState<Date>(initialStart);

  const validateProformaMutation = useValidateProforma();

  const [form, setForm] = useState({
    clientId: r.clientId || "",
    clientNom: currentClient?.nom || "",
    clientTelephone: currentClient?.telephone || "",
    clientAgenceVoyage: currentClient?.agenceVoyage || "",
    clientOrigine: currentClient?.origine || "",
    statut: (Number((r as any).accompte || 0) > 0 && r.statut === "en_attente") ? "confirmee" : r.statut,
    nbPersonnes: r.nbPersonnes || 2,
    accompte: (r as any).accompte || "",
    methodePaiementAccompte: (r as any).methodePaiementAccompte || "especes",
  });

  const weekStart = startOfWeek(modalDateRef, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 13) });

  function isRoomAvailable(chambreId: string, date: Date) {
    const nextDay = addDays(date, 1);
    const inMaint = (maintenance || []).some(
      (m) =>
        m.chambreId === chambreId &&
        new Date(m.dateDebut || (m as any).start) < nextDay &&
        new Date(m.dateFin || (m as any).end) > date
    );
    if (inMaint) return false;
    const hasConflict = reservations.some(
      (rr) => rr.id !== r.id && isRoomReservedDuring(rr, chambreId, date, nextDay)
    );
    const chambre = rooms.find((c) => c.id === chambreId);
    if (chambre?.statut === "maintenance") return false;
    return !hasConflict;
  }

  // Clic direct et fluide sur une cellule de chambre avec support multi-séjours (Ctrl+Clic)
  function handleCellClick(chambreId: string, date: Date, ctrlKey = false) {
    if (isOtherStaffReservation) return;
    if (!isRoomAvailable(chambreId, date)) return;

    setSelectedRoomsMap((prev) => {
      const ranges = prev[chambreId] || [];

      // --- Ctrl+Clic ou chambre vide : démarre un nouveau segment ---
      if (ctrlKey || ranges.length === 0) {
        const alreadyInRange = ranges.some((rng) => date >= rng.start && date < rng.end);
        if (alreadyInRange) return prev;
        const newRanges = [...ranges, { start: date, end: addDays(date, 1) }];
        activeSegmentRef.current[chambreId] = newRanges.length - 1;
        return { ...prev, [chambreId]: newRanges };
      }

      // --- Clic normal : édite le segment actif (le dernier sélectionné) ---
      const activeIdx = activeSegmentRef.current[chambreId] ?? ranges.length - 1;
      const current = ranges[activeIdx];
      const newRanges = [...ranges];

      if (isSameDay(date, current.start)) {
        const nights = eachDayOfInterval({ start: current.start, end: addDays(current.end, -1) }).length;
        if (nights <= 1 && ranges.length === 1) {
          const next = { ...prev };
          delete next[chambreId];
          delete activeSegmentRef.current[chambreId];
          return next;
        } else if (nights <= 1) {
          newRanges.splice(activeIdx, 1);
          activeSegmentRef.current[chambreId] = Math.max(0, newRanges.length - 1);
          return { ...prev, [chambreId]: newRanges };
        } else {
          newRanges[activeIdx] = { start: date, end: addDays(date, 1) };
          return { ...prev, [chambreId]: newRanges };
        }
      }

      if (date > current.start) {
        const targetEnd = addDays(date, 1);
        const days = eachDayOfInterval({ start: current.start, end: date });
        const allFree = days.every((d) => isRoomAvailable(chambreId, d));
        const overlapOther = ranges.some((rng, i) => {
          if (i === activeIdx) return false;
          return date >= rng.start && date < rng.end;
        });
        if (allFree && !overlapOther) {
          newRanges[activeIdx] = { start: current.start, end: targetEnd };
        } else {
          const alreadyIn = ranges.some((rng) => date >= rng.start && date < rng.end);
          if (!alreadyIn) {
            newRanges.push({ start: date, end: addDays(date, 1) });
            activeSegmentRef.current[chambreId] = newRanges.length - 1;
          }
        }
        return { ...prev, [chambreId]: newRanges };
      } else {
        const currentLastDay = addDays(current.end, -1);
        const days = eachDayOfInterval({ start: date, end: currentLastDay });
        const allFree = days.every((d) => isRoomAvailable(chambreId, d));
        if (allFree) {
          newRanges[activeIdx] = { start: date, end: current.end };
        } else {
          const alreadyIn = ranges.some((rng) => date >= rng.start && date < rng.end);
          if (!alreadyIn) {
            newRanges.push({ start: date, end: addDays(date, 1) });
            activeSegmentRef.current[chambreId] = newRanges.length - 1;
          }
        }
        return { ...prev, [chambreId]: newRanges };
      }
    });
  }

  function getCellColor(chambreId: string, date: Date) {
    const chambre = rooms.find((c) => c.id === chambreId);
    if (chambre?.statut === "maintenance") return "#9E9E9E";

    // Multi-séjours : vérifie si la date est dans l'une des plages sélectionnées
    const ranges = selectedRoomsMap[chambreId];
    if (ranges && ranges.length > 0) {
      const activeIdx = activeSegmentRef.current[chambreId] ?? ranges.length - 1;
      const matchedIdx = ranges.findIndex((rng) => date >= rng.start && date < rng.end);
      if (matchedIdx !== -1) {
        return matchedIdx === activeIdx ? "#66BB6A" : "#2E7D32";
      }
    }

    const nextDay = addDays(date, 1);
    const inMaint = (maintenance || []).some(
      (m) =>
        m.chambreId === chambreId &&
        new Date(m.dateDebut || (m as any).start) < nextDay &&
        new Date(m.dateFin || (m as any).end) > date
    );
    if (inMaint) return "#9E9E9E";

    const conflict = reservations.find(
      (rr) => rr.id !== r.id && isRoomReservedDuring(rr, chambreId, date, nextDay)
    );
    if (conflict) {
      const conflictHasAcompte = Number((conflict as any).accompte || 0) > 0;
      if (conflict.statut === "en_attente" && !conflictHasAcompte) return "#F59E0B";
      return "#EF5350";
    }

    return "#FFFFFF";
  }

  function handleRemoveRoom(chambreId: string, rangeIdx?: number) {
    setSelectedRoomsMap((prev) => {
      const ranges = prev[chambreId];
      if (!ranges) return prev;
      if (rangeIdx !== undefined && ranges.length > 1) {
        const nextRanges = ranges.filter((_, i) => i !== rangeIdx);
        activeSegmentRef.current[chambreId] = Math.max(0, nextRanges.length - 1);
        return { ...prev, [chambreId]: nextRanges };
      }
      const next = { ...prev };
      delete next[chambreId];
      delete activeSegmentRef.current[chambreId];
      return next;
    });
  }

  const selectedRoomEntries = Object.entries(selectedRoomsMap);
  const totalStaysCount = selectedRoomEntries.reduce((acc, [, ranges]) => acc + ranges.length, 0);
  const isValid = (form.clientId || form.clientNom) && selectedRoomEntries.length > 0;

  const allReservationStays = useMemo(() => {
    if (selectedRoomEntries.length > 0) {
      const existingStays = getReservationStays(r);
      const list: Stay[] = [];
      let stayCounter = 0;

      for (const [rId, ranges] of selectedRoomEntries) {
        const ch = rooms.find((c) => c.id === rId);
        const sortedRanges = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
        sortedRanges.forEach((range) => {
          stayCounter++;
          const nights = Math.max(1, eachDayOfInterval({ start: range.start, end: addDays(range.end, -1) }).length);
          const existingStay = existingStays.find(
            (s) => s.chambreId === rId && Math.abs(new Date(s.dateDebut).getTime() - range.start.getTime()) < 86400000
          ) || existingStays.find((s) => s.chambreId === rId && !list.some((item) => item.id === s.id));

          list.push({
            id: existingStay?.id || `stay_${stayCounter}`,
            chambreId: rId,
            dateDebut: range.start.toISOString(),
            dateFin: range.end.toISOString(),
            nuits: nights,
            statut: form.statut,
            nbPersonnes: form.nbPersonnes,
            tarifBase: ch?.tarif_base || 0,
            packId: selectedPack?.id,
            packNom: selectedPack?.nom,
            packPrix: selectedPack?.prix,
            packTypeCalcul: selectedPack?.typeCalcul,
            invoiceId: existingStay?.invoiceId,
          });
        });
      }
      return list;
    }
    if (r.stays && r.stays.length > 0) return r.stays;
    return getReservationStays(r);
  }, [r, selectedRoomEntries, form.statut, form.nbPersonnes, rooms, selectedPack]);

  async function handleSave() {
    if (selectedRoomEntries.length === 0) {
      onSave({ id: r.id, statut: "annulee" });
      onClose();
      return;
    }
    if (!isValid) return;

    let clientId = form.clientId;
    if (!clientId && form.clientNom) {
      try {
        const newClient = await createClient.mutateAsync({
          nom: form.clientNom.trim(),
          telephone: form.clientTelephone.trim() || undefined,
          agenceVoyage: form.clientAgenceVoyage.trim() || undefined,
          origine: form.clientOrigine.trim() || undefined,
          ...(isDircom && userEmail ? { createdBy: userEmail } : {}),
        });
        clientId = newClient.id;
      } catch (error) {
        console.error("Erreur création client:", error);
      }
    } else if (clientId) {
      const existingClient = clients?.find((c) => c.id === clientId);
      if (existingClient) {
        const updates: Partial<Client> = {};
        if (form.clientTelephone !== (existingClient.telephone || "")) updates.telephone = form.clientTelephone;
        if (form.clientAgenceVoyage !== (existingClient.agenceVoyage || "")) updates.agenceVoyage = form.clientAgenceVoyage;
        if (form.clientOrigine !== (existingClient.origine || "")) updates.origine = form.clientOrigine;
        if (Object.keys(updates).length > 0) {
          updateClient.mutate({ id: clientId, ...updates });
        }
      }
    }

    const details: ReservationChambreDetail[] = [];
    let globalStart: Date | null = null;
    let globalEnd: Date | null = null;
    const roomIds: string[] = [];

    for (const [rId, ranges] of selectedRoomEntries) {
      roomIds.push(rId);
      const ch = rooms.find((c) => c.id === rId);
      const sortedRanges = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
      for (const range of sortedRanges) {
        const nights = Math.max(1, eachDayOfInterval({ start: range.start, end: addDays(range.end, -1) }).length);
        details.push({
          chambreId: rId,
          dateDebut: range.start.toISOString(),
          dateFin: range.end.toISOString(),
          nuits: nights,
          tarifBase: ch?.tarif_base || 0,
        });

        if (!globalStart || range.start < globalStart) globalStart = range.start;
        if (!globalEnd || range.end > globalEnd) globalEnd = range.end;
      }
    }

    const finalStatut = (Number(form.accompte || 0) > 0 && form.statut === "en_attente") ? "confirmee" : form.statut;

    onSave({
      id: r.id,
      clientId,
      chambreIds: roomIds,
      chambreId: roomIds[0] || "",
      chambresDetails: details,
      stays: allReservationStays,
      dateDebut: globalStart ? globalStart.toISOString() : r.dateDebut,
      dateFin: globalEnd ? globalEnd.toISOString() : r.dateFin,
      nbPersonnes: form.nbPersonnes,
      statut: finalStatut,
      packId: selectedPack?.id,
      packNom: selectedPack?.nom,
      packPrix: selectedPack?.prix,
      packTypeCalcul: selectedPack?.typeCalcul,
      accompte: form.accompte ? Number(form.accompte) : 0,
      methodePaiementAccompte: form.methodePaiementAccompte,
    });
  }

  const linkedInvoices = useMemo(() => {
    return (factures || []).filter(
      (f) =>
        (f.reservationId === r.id ||
          f.reservationIds?.includes(r.id) ||
          (f.stayIds && allReservationStays.some((s) => f.stayIds?.includes(s.id)))) &&
        f.source === "Hebergement"
    );
  }, [factures, r.id, allReservationStays]);

  const [selectedStayIdsForBilling, setSelectedStayIdsForBilling] = useState<string[]>(() => {
    return allReservationStays.map((s) => s.id);
  });

  useEffect(() => {
    setSelectedStayIdsForBilling(allReservationStays.map((s) => s.id));
  }, [allReservationStays]);

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {isOtherStaffReservation ? (
        <Paper variant="outlined" sx={{ p: 2, bgcolor: "#f8fafc", borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              CLIENT & COORDONNÉES (LECTURE SEULE)
            </Typography>
            <Chip
              size="small"
              label={form.statut}
              color={form.statut === "confirmee" ? "primary" : form.statut === "arrivee" ? "success" : "default"}
              variant="outlined"
              sx={{ height: 20, fontSize: "0.7rem", textTransform: "capitalize" }}
            />
          </Stack>
          <Typography variant="subtitle1" fontWeight={800} color="#1e293b">
            👤 {currentClient?.nom || form.clientNom || (clients || []).find((c) => c.id === r.clientId)?.nom || "Client non renseigné"}
          </Typography>
          <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                Téléphone
              </Typography>
              <Typography variant="body2" fontWeight={600} color="#334155">
                📞 {currentClient?.telephone || form.clientTelephone || (r as any).clientTelephone || "Non renseigné"}
              </Typography>
            </Grid>
            {currentClient?.email && (
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" display="block">
                  E-mail
                </Typography>
                <Typography variant="body2" fontWeight={600} color="#334155">
                  ✉️ {currentClient.email}
                </Typography>
              </Grid>
            )}
            {(currentClient?.agenceVoyage || form.clientAgenceVoyage) && (
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Agence partenaire
                </Typography>
                <Typography variant="body2" fontWeight={600} color="primary.main">
                  ✈️ {currentClient?.agenceVoyage || form.clientAgenceVoyage}
                </Typography>
              </Grid>
            )}
            {(currentClient?.origine || form.clientOrigine) && (
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Canal / Origine
                </Typography>
                <Typography variant="body2" fontWeight={600} color="#475569">
                  🌐 {currentClient?.origine || form.clientOrigine}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Paper>
      ) : (
        <>
          <Typography variant="body2" fontWeight={700}>
            Client
          </Typography>
          <Autocomplete
            freeSolo
            size="small"
            options={visibleClients}
            getOptionLabel={(option) => (typeof option === "string" ? option : option.nom)}
            value={
              clients?.find((c) => c.id === form.clientId) ||
              (form.clientNom ? ({ id: "", nom: form.clientNom, telephone: form.clientTelephone } as any) : null)
            }
            onChange={(_, newValue) => {
              if (newValue && typeof newValue !== "string") {
                setForm({
                  ...form,
                  clientId: newValue.id,
                  clientNom: newValue.nom,
                  clientTelephone: newValue.telephone || "",
                  clientAgenceVoyage: newValue.agenceVoyage || "",
                  clientOrigine: newValue.origine || "",
                });
              } else if (typeof newValue === "string") {
                setForm({
                  ...form,
                  clientId: "",
                  clientNom: newValue,
                  clientTelephone: "",
                  clientAgenceVoyage: "",
                  clientOrigine: "",
                });
              } else {
                setForm({
                  ...form,
                  clientId: "",
                  clientNom: "",
                  clientTelephone: "",
                  clientAgenceVoyage: "",
                  clientOrigine: "",
                });
              }
            }}
            onInputChange={(_, newInputValue, reason) => {
              if (reason === "input") {
                const matched = (clients || []).find((c) => c.nom.toLowerCase() === newInputValue.trim().toLowerCase());
                if (matched) {
                  setForm((prev) => ({
                    ...prev,
                    clientId: matched.id,
                    clientNom: matched.nom,
                    clientTelephone: matched.telephone || prev.clientTelephone,
                    clientAgenceVoyage: matched.agenceVoyage || prev.clientAgenceVoyage,
                    clientOrigine: matched.origine || prev.clientOrigine,
                  }));
                } else {
                  setForm((prev) => ({
                    ...prev,
                    clientNom: newInputValue,
                    clientId: "",
                  }));
                }
              }
            }}
            componentsProps={{ paper: autocompletePaperProps }}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", py: 0.5 }}>
                  <Typography variant="body2" fontWeight={700}>
                    {option.nom}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    {option.telephone && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ bgcolor: "action.hover", px: 0.8, py: 0.2, borderRadius: 1 }}
                      >
                        📞 {option.telephone}
                      </Typography>
                    )}
                    {option.agenceVoyage && (
                      <Chip size="small" label={`✈️ ${option.agenceVoyage}`} variant="outlined" sx={{ height: 20, fontSize: "0.65rem" }} />
                    )}
                  </Box>
                </Box>
              </li>
            )}
            renderInput={(params) => <TextField {...params} label="Nom du client" placeholder="Sélectionner ou saisir" />}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              size="small"
              fullWidth
              label="Numéro de contact (Optionnel)"
              value={form.clientTelephone}
              onChange={(e) => setForm({ ...form, clientTelephone: e.target.value })}
              placeholder="Ex: 034 00 000 00"
            />
            <TextField
              size="small"
              fullWidth
              label="Agence de voyage (Optionnel)"
              value={form.clientAgenceVoyage}
              onChange={(e) => setForm({ ...form, clientAgenceVoyage: e.target.value })}
              placeholder="Ex: Booking, Expedia, Agence A..."
            />
          </Stack>

          <TextField
            size="small"
            fullWidth
            label="Origine (Canal de réservation)"
            value={form.clientOrigine}
            onChange={(e) => setForm({ ...form, clientOrigine: e.target.value })}
            placeholder="Ex: Site web, Téléphone direct, Booking..."
          />

          <Select size="small" value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value as any })}>
            <MenuItem value="en_attente">En attente / Devis</MenuItem>
            <MenuItem value="confirmee">Confirmée</MenuItem>
            <MenuItem value="arrivee">Occupée</MenuItem>
            <MenuItem value="terminee">Terminée</MenuItem>
            <MenuItem value="annulee">Annulée</MenuItem>
          </Select>

          <Typography variant="body2" fontWeight={700}>
            Acompte (Optionnel)
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
            <TextField
              size="small"
              label="Montant de l'acompte (Ar)"
              type="number"
              value={form.accompte}
              onChange={(e) => {
                const val = e.target.value;
                const num = Number(val || 0);
                setForm((prev) => ({
                  ...prev,
                  accompte: val,
                  statut: num > 0 && prev.statut === "en_attente" ? "confirmee" : prev.statut,
                }));
              }}
            />
            <Select
              size="small"
              value={form.methodePaiementAccompte}
              onChange={(e) => setForm({ ...form, methodePaiementAccompte: e.target.value })}
            >
              <MenuItem value="especes">Espèces</MenuItem>
              <MenuItem value="mobile_money">Mobile Money</MenuItem>
              <MenuItem value="virement">Virement</MenuItem>
              <MenuItem value="carte">Carte</MenuItem>
            </Select>
          </Box>
        </>
      )}

      {isOtherStaffReservation ? (
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "#f8fafc", borderRadius: 2 }}>
          <Stack direction="row" spacing={3} flexWrap="wrap" gap={1}>
            <Box>
              <Typography variant="caption" color="text.secondary">Formule</Typography>
              <Typography variant="body2" fontWeight={600}>{selectedPack?.nom || "Standard"} {selectedPack?.prix > 0 ? `(+${selectedPack.prix.toLocaleString("fr-FR")} Ar)` : ""}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Occupants</Typography>
              <Typography variant="body2" fontWeight={600}>{form.nbPersonnes} personne{form.nbPersonnes > 1 ? "s" : ""}</Typography>
            </Box>
            {Number(form.accompte) > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary">Acompte enregistré</Typography>
                <Typography variant="body2" fontWeight={700} color="#059669">
                  {Number(form.accompte).toLocaleString("fr-FR")} Ar ({form.methodePaiementAccompte === "mobile_money" ? "Mobile Money" : form.methodePaiementAccompte === "virement" ? "Virement" : form.methodePaiementAccompte === "carte" ? "Carte" : "Espèces"})
                </Typography>
              </Box>
            )}
          </Stack>
        </Paper>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1.4fr 1fr" }, gap: 1.5 }}>
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary" mb={0.5} display="block">
              Formule / Pack de séjour
            </Typography>
            <Select
              size="small"
              fullWidth
              value={selectedPackId}
              onChange={(e) => setSelectedPackId(e.target.value)}
            >
              {availablePacks.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.nom} {p.prix > 0 ? `(+${p.prix.toLocaleString("fr-FR")} Ar)` : "(Inclus)"}
                </MenuItem>
              ))}
            </Select>
          </Box>
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary" mb={0.5} display="block">
              Personnes
            </Typography>
            <TextField
              size="small"
              type="number"
              fullWidth
              value={form.nbPersonnes}
              onChange={(e) => setForm({ ...form, nbPersonnes: parseInt(e.target.value || "1", 10) })}
              inputProps={{ min: 1 }}
            />
          </Box>
        </Box>
      )}

      {/* Mini Calendrier Interactif avec sélection indépendante par chambre */}
      <Divider />
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" fontWeight={700}>
          {isOtherStaffReservation ? "Chambres et dates réservées (Lecture seule)" : "Sélectionnez les chambres et leurs dates"}
        </Typography>
        {selectedRoomEntries.length > 0 && (
          <Chip
            size="small"
            color="primary"
            label={`${selectedRoomEntries.length} chambre${selectedRoomEntries.length > 1 ? "s" : ""} · ${totalStaysCount} séjour${totalStaysCount > 1 ? "s" : ""}`}
          />
        )}
      </Stack>
      {/* Hint multi-séjours */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, bgcolor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 1, px: 1.5, py: 0.7 }}>
        <Typography variant="caption" color="#1d4ed8" sx={{ fontWeight: 600 }}>
          💡 Ctrl+Clic sur une cellule libre = nouveau séjour indépendant pour la même chambre
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip size="small" label={`Semaine du ${format(weekStart, "dd MMM yyyy", { locale: fr })}`} />
        <Chip size="small" label="◀" onClick={() => setModalDateRef((d) => addDays(d, -7))} />
        <Chip size="small" label="▶" onClick={() => setModalDateRef((d) => addDays(d, 7))} />
      </Stack>

      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          p: 1,
          maxHeight: 260,
          overflowY: "auto",
          overflowX: "auto",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `70px repeat(${weekDays.length}, minmax(65px, 1fr))`,
            gap: 0.5,
            minWidth: "max-content",
          }}
        >
          <Box />
          {weekDays.map((d) => (
            <Box
              key={d.toISOString()}
              sx={{ textAlign: "center", fontSize: "0.72rem", fontWeight: 600, py: 0.5, color: "text.secondary" }}
            >
              {format(d, "EEE d", { locale: fr })}
            </Box>
          ))}

          {sortedRooms.map((chambre) => {
            const ranges = selectedRoomsMap[chambre.id];
            const isSelected = !!ranges && ranges.length > 0;
            const stayCount = ranges?.length ?? 0;
            return (
              <Fragment key={chambre.id}>
                <Box
                  sx={{
                    py: 0.5,
                    fontSize: "0.75rem",
                    fontWeight: isSelected ? 800 : 600,
                    color: isSelected ? "primary.main" : "inherit",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 0.2,
                  }}
                >
                  {chambre.numero}
                  {stayCount > 1 && (
                    <Box
                      component="span"
                      sx={{
                        fontSize: "0.6rem",
                        bgcolor: "#1d4ed8",
                        color: "#fff",
                        px: 0.5,
                        borderRadius: "4px",
                        lineHeight: 1.4,
                      }}
                    >
                      {stayCount} séjours
                    </Box>
                  )}
                </Box>
                {weekDays.map((date) => {
                  const available = isRoomAvailable(chambre.id, date);
                  const color = getCellColor(chambre.id, date);
                  const isCtrlHint = isSelected && available;
                  return (
                    <Box
                      key={`${chambre.id}-${date.toISOString()}`}
                      onClick={(e) => !isOtherStaffReservation && available && handleCellClick(chambre.id, date, e.ctrlKey || e.metaKey)}
                      title={!isOtherStaffReservation && isCtrlHint ? "Ctrl+Clic pour ajouter un séjour distinct" : undefined}
                      sx={{
                        height: 32,
                        bgcolor: color,
                        border: "1px solid",
                        borderColor: "divider",
                        cursor: (!isOtherStaffReservation && available) ? "pointer" : "default",
                        opacity: available ? 1 : 0.6,
                        borderRadius: "4px",
                        "&:hover": (!isOtherStaffReservation && available) ? { opacity: 0.8 } : {},
                      }}
                    />
                  );
                })}
              </Fragment>
            );
          })}
        </Box>
      </Box>

      <Stack direction="row" spacing={1} sx={{ fontSize: "0.75rem", mt: 1 }} flexWrap="wrap">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: "#FFFFFF", border: "1px solid #ccc", borderRadius: "2px" }} />
          <Typography variant="caption">Libre</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: "#66BB6A", borderRadius: "2px" }} />
          <Typography variant="caption">Sélectionné</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: "#F59E0B", borderRadius: "2px" }} />
          <Typography variant="caption">En attente / Devis</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: "#EF5350", borderRadius: "2px" }} />
          <Typography variant="caption">Confirmé / Occupé</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: "#9E9E9E", borderRadius: "2px" }} />
          <Typography variant="caption">Hors service</Typography>
        </Box>
      </Stack>

      {/* Résumé & Estimation tarifaire */}
      {selectedRoomEntries.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "#f0fdf4", borderColor: "#bbf7d0", borderRadius: 2 }}>
          {(() => {
            let roomsTotal = 0;
            let maxNights = 1;
            let totalRoomNights = 0;

            // Aplatir toutes les plages en items affichables
            const roomItems: { id: string; rangeIdx: number; numero: string; categorie: string; start: Date; end: Date; nights: number; cost: number }[] = [];
            for (const [rId, ranges] of selectedRoomEntries) {
              const ch = rooms.find((c) => c.id === rId);
              const sortedRanges = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
              sortedRanges.forEach((range, idx) => {
                const nights = Math.max(1, eachDayOfInterval({ start: range.start, end: addDays(range.end, -1) }).length);
                const cost = (ch?.tarif_base || 0) * nights;
                roomsTotal += cost;
                totalRoomNights += nights;
                if (nights > maxNights) maxNights = nights;
                roomItems.push({
                  id: rId,
                  rangeIdx: idx,
                  numero: ch?.numero || rId,
                  categorie: ch?.categorie || "Chambre",
                  start: range.start,
                  end: range.end,
                  nights,
                  cost,
                });
              });
            }

            let packFormulaTotal = 0;
            if (selectedPack && selectedPack.prix > 0) {
              if (selectedPack.typeCalcul === "par_personne_nuit") {
                packFormulaTotal = selectedPack.prix * maxNights * (form.nbPersonnes || 1);
              } else if (selectedPack.typeCalcul === "par_chambre_nuit") {
                packFormulaTotal = selectedPack.prix * totalRoomNights;
              } else {
                packFormulaTotal = selectedPack.prix;
              }
            }

            // Taxes & Vignettes
            const activeTaxesEdit = (config?.hebergementTaxes && config.hebergementTaxes.length > 0)
              ? config.hebergementTaxes.filter((t) => t.actif)
              : DEFAULT_HEBERGEMENT_TAXES;

            const taxItemsEdit = activeTaxesEdit.map((t) => {
              let qte = 1;
              if (t.typeCalcul === "fixe") qte = 1;
              else if (t.typeCalcul === "par_nuitee") qte = maxNights;
              else if (t.typeCalcul === "par_chambre_nuitee") qte = totalRoomNights;
              else if (t.typeCalcul === "par_personne_nuitee") qte = maxNights * (form.nbPersonnes || 1);
              const cost = t.montant * qte;
              return { ...t, qte, cost };
            });

            const taxesTotalEdit = taxItemsEdit.reduce((s, t) => s + t.cost, 0);
            const estimatedTotal = roomsTotal + packFormulaTotal + taxesTotalEdit;

            return (
              <Stack spacing={0.8}>
                <Typography variant="body2" fontWeight={700} color="#166534">
                  Détail des hébergements
                </Typography>
                <Divider sx={{ my: 0.3, borderColor: "#bbf7d0" }} />
                {roomItems.map((item) => {
                  const totalRangesForRoom = selectedRoomsMap[item.id]?.length ?? 1;
                  return (
                    <Box
                      key={`${item.id}-${item.rangeIdx}`}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.82rem",
                        bgcolor: "rgba(255,255,255,0.6)",
                        p: 0.8,
                        borderRadius: 1,
                        borderLeft: totalRangesForRoom > 1 ? "3px solid #1d4ed8" : "none",
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          Chambre {item.numero} ({item.categorie})
                          {totalRangesForRoom > 1 && (
                            <Box
                              component="span"
                              sx={{ ml: 0.5, fontSize: "0.65rem", bgcolor: "#dbeafe", color: "#1d4ed8", px: 0.6, py: 0.1, borderRadius: "4px" }}
                            >
                              Séjour {item.rangeIdx + 1}/{totalRangesForRoom}
                            </Box>
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Du {format(item.start, "dd/MM/yyyy")} au {format(item.end, "dd/MM/yyyy")} ({item.nights} nuit
                          {item.nights > 1 ? "s" : ""})
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <b>{item.cost.toLocaleString("fr-FR")} Ar</b>
                        {!isOtherStaffReservation && (
                          <IconButton
                            size="small"
                            color="error"
                            title={totalRangesForRoom > 1 ? "Supprimer ce séjour" : "Retirer cette chambre"}
                            onClick={() => handleRemoveRoom(item.id, totalRangesForRoom > 1 ? item.rangeIdx : undefined)}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
                    {packFormulaTotal > 0 && (
                      <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "#0369a1", px: 0.5 }}>
                        <span>{selectedPack.nom} :</span>
                        <b>+{packFormulaTotal.toLocaleString("fr-FR")} Ar</b>
                      </Box>
                    )}
                    {taxItemsEdit.map((tax) => (
                      <Box key={tax.id} sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "#64748b", px: 0.5 }}>
                        <span>{tax.nom} ({tax.qte > 1 ? `${tax.qte} nuits × ${tax.montant.toLocaleString('fr-FR')} Ar` : 'Forfait séjour'}) :</span>
                        <b>+{tax.cost.toLocaleString("fr-FR")} Ar</b>
                      </Box>
                    ))}
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        pt: 1,
                        borderTop: "1px dashed #bbf7d0",
                        color: "#166534",
                        fontWeight: 900,
                        fontSize: "0.95rem",
                      }}
                    >
                      <span>Total estimé :</span>
                      <span>{estimatedTotal.toLocaleString("fr-FR")} Ar</span>
                    </Box>
                    {Number(form.accompte) > 0 && (
                      <>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            color: "#059669",
                            fontWeight: 700,
                            fontSize: "0.88rem",
                            px: 0.5,
                          }}
                        >
                          <span>Acompte versé ({form.methodePaiementAccompte === "mobile_money" ? "Mobile Money" : form.methodePaiementAccompte === "virement" ? "Virement" : form.methodePaiementAccompte === "carte" ? "Carte" : "Espèces"}) :</span>
                          <span>- {Number(form.accompte).toLocaleString("fr-FR")} Ar</span>
                        </Box>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            color: "#1e293b",
                            fontWeight: 900,
                            fontSize: "0.95rem",
                            bgcolor: "#dcfce7",
                            p: 0.8,
                            borderRadius: 1,
                          }}
                        >
                          <span>Reste à payer TTC :</span>
                          <span>{Math.max(0, estimatedTotal - Number(form.accompte)).toLocaleString("fr-FR")} Ar</span>
                        </Box>
                      </>
                    )}
              </Stack>
            );
          })()}
        </Paper>
      )}

      {selectedRoomEntries.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          Aucune chambre sélectionnée : en validant, la réservation sera annulée.
        </Typography>
      )}

      {!isOtherStaffReservation && (
        <>
          <Divider />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography fontWeight={700}>Facturation & Documents ({linkedInvoices.length})</Typography>
        {linkedInvoices.length > 0 && (
          <Chip
            size="small"
            label={`${linkedInvoices.length} document(s)`}
            color="primary"
            variant="outlined"
          />
        )}
      </Stack>

      {/* Affichage des factures / proformas liées */}
      {linkedInvoices.length > 0 && (
        <Stack spacing={1}>
          {linkedInvoices.map((inv) => (
            <Paper key={inv.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" fontWeight={700}>
                      {inv.typeDocument === "devis"
                        ? "📝 Devis"
                        : inv.typeDocument === "proforma"
                        ? "📋 Facture Proforma"
                        : "📄 Facture"}{" "}
                      {inv.numero}
                    </Typography>
                    <Chip
                      size="small"
                      label={inv.statut === "payee" ? "Payée" : inv.statut === "annulee" ? "Annulée" : isProformaDocument(inv) ? "Devis / Proforma" : "En cours"}
                      color={inv.statut === "payee" ? "success" : isProformaDocument(inv) ? "warning" : "default"}
                      sx={{ fontSize: "0.7rem", height: 20 }}
                    />
                  </Stack>
                  {(() => {
                    const docAccompte = Number((inv as any).accompte || (form.accompte ? Number(form.accompte) : (r as any).accompte) || 0);
                    const methode = (inv as any).methodePaiementAccompte || form.methodePaiementAccompte || (r as any).methodePaiementAccompte || "especes";
                    const methodeLabel = methode === "mobile_money" ? "Mobile Money" : methode === "virement" ? "Virement" : methode === "carte" ? "Carte" : "Espèces";
                    const reste = Math.max(0, inv.totalTTC - docAccompte);
                    return (
                      <Box sx={{ mt: 0.3 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Total TTC : <b><Ariary value={inv.totalTTC} /></b>
                          {docAccompte > 0 && (
                            <>
                              {" · "}
                              <span style={{ color: "#166534", fontWeight: 700 }}>
                                Acompte : -<Ariary value={docAccompte} /> ({methodeLabel})
                              </span>
                              {" · "}
                              <span style={{ color: "#0f172a", fontWeight: 800 }}>
                                Reste : <Ariary value={reste} />
                              </span>
                            </>
                          )}
                          {inv.dueDate ? ` · Échéance : ${new Date(inv.dueDate).toLocaleDateString()}` : ""}
                        </Typography>
                      </Box>
                    );
                  })()}
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={async () => {
                    if (form.accompte !== undefined) {
                      try {
                        await handleSave();
                      } catch (err) {
                        console.warn("Auto-save before navigating to invoice:", err);
                      }
                    }
                    onClose();
                    navigate(`/${tenantId}/financier?factureId=${inv.id}`);
                  }}
                >
                  Ouvrir
                </Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Raccourci vers conversion de la Proforma existante et émission dynamique */}
      {(() => {
        const targetStays =
          allReservationStays.length > 1
            ? allReservationStays.filter((s) => selectedStayIdsForBilling.includes(s.id))
            : allReservationStays;

        const existingProforma = linkedInvoices.find(
          (inv) => isProformaDocument(inv) && inv.statut !== "annulee"
        );
        const existingFacture = linkedInvoices.find(
          (inv) => !isProformaDocument(inv) && inv.statut !== "annulee"
        );

        // Vérification précise par séjour pour éviter les doublons
        const isStayBilledByFacture = (stayId: string) => {
          return linkedInvoices.some(
            (inv) =>
              !isProformaDocument(inv) &&
              inv.statut !== "annulee" &&
              (inv.stayIds?.includes(stayId) ||
                (!inv.stayIds?.length && (inv.reservationId === r.id || inv.reservationIds?.includes(r.id))))
          );
        };

        const isStayBilledByProforma = (stayId: string) => {
          return linkedInvoices.some(
            (inv) =>
              isProformaDocument(inv) &&
              inv.statut !== "annulee" &&
              (inv.stayIds?.includes(stayId) ||
                (!inv.stayIds?.length && (inv.reservationId === r.id || inv.reservationIds?.includes(r.id))))
          );
        };

        const allTargetedAlreadyHaveFacture =
          targetStays.length > 0 && targetStays.every((s) => isStayBilledByFacture(s.id));

        const allTargetedAlreadyHaveProforma =
          targetStays.length > 0 && targetStays.every((s) => isStayBilledByProforma(s.id));

        const isAnnulee = form.statut === "annulee";
        const isEnAttente = form.statut === "en_attente";
        const isConfirmeeOuPlus = ["confirmee", "arrivee", "terminee"].includes(form.statut);

        // Règles de désactivation pour Facture Définitive
        let disabledFacture = false;
        let factureReason = "";

        if (isAnnulee) {
          disabledFacture = true;
          factureReason = "Réservation annulée";
        } else if (existingFacture || allTargetedAlreadyHaveFacture) {
          disabledFacture = true;
          factureReason = existingFacture
            ? `Facture définitive ${existingFacture.numero} déjà émise`
            : "Séjours déjà facturés en définitif";
        } else if (isEnAttente) {
          disabledFacture = true;
          factureReason = "Réservation en attente : passez le statut en 'Confirmée' pour facturer en définitif";
        } else if (allReservationStays.length > 1 && selectedStayIdsForBilling.length === 0) {
          disabledFacture = true;
          factureReason = "Sélectionnez au moins un séjour";
        } else if (generateInvoiceMutation.isPending) {
          disabledFacture = true;
        }

        // Règles de désactivation pour Facture Proforma
        let disabledProforma = false;
        let proformaReason = "";

        if (isAnnulee) {
          disabledProforma = true;
          proformaReason = "Réservation annulée";
        } else if (existingFacture || allTargetedAlreadyHaveFacture) {
          disabledProforma = true;
          proformaReason = existingFacture
            ? `Facture ${existingFacture.numero} déjà émise`
            : "Séjours déjà facturés";
        } else if (existingProforma || allTargetedAlreadyHaveProforma) {
          disabledProforma = true;
          proformaReason = existingProforma
            ? `Proforma ${existingProforma.numero} déjà existante`
            : "Proforma déjà existante";
        } else if (isConfirmeeOuPlus) {
          disabledProforma = true;
          proformaReason = "Réservation confirmée : émettez directement la facture définitive";
        } else if (allReservationStays.length > 1 && selectedStayIdsForBilling.length === 0) {
          disabledProforma = true;
          proformaReason = "Sélectionnez au moins un séjour";
        } else if (generateInvoiceMutation.isPending) {
          disabledProforma = true;
        }

        // Déterminer s'il reste des séjours à facturer pour afficher la sélection multi-séjours
        const shouldShowStaySelection =
          !existingFacture &&
          !allTargetedAlreadyHaveFacture &&
          !isAnnulee &&
          allReservationStays.length > 1;

        return (
          <Box sx={{ p: 2, border: "1px solid #e0e7ff", borderRadius: 2, bgcolor: "#faf5ff" }}>
            <Typography variant="subtitle2" fontWeight={800} color="#4338ca" mb={1}>
              Émettre un document pour cette réservation
            </Typography>

            {/* CAS 1 : Facture définitive déjà active -> Alerte de verrouillage anti-doublon */}
            {existingFacture && (
              <Box sx={{ mb: 1.5, p: 1.5, bgcolor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 1.5 }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" gap={1.5}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={700} color="#166534">
                      📄 Facture Définitive active : {existingFacture.numero}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.3 }}>
                      Une facture définitive est déjà émise pour cette réservation. L'émission de nouveaux documents est verrouillée pour éviter les doublons comptables.
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={async () => {
                      if (form.accompte !== undefined) {
                        try {
                          await handleSave();
                        } catch (err) {
                          console.warn("Auto-save:", err);
                        }
                      }
                      onClose();
                      navigate(`/${tenantId}/financier?factureId=${existingFacture.id}`);
                    }}
                    sx={{
                      bgcolor: "#16a34a",
                      color: "#ffffff !important",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      textTransform: "none",
                      px: 2,
                      py: 0.8,
                      borderRadius: 2,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      boxShadow: "0 2px 6px rgba(22, 163, 74, 0.25)",
                      "&:hover": { bgcolor: "#15803d" },
                    }}
                  >
                    Ouvrir la Facture
                  </Button>
                </Stack>
              </Box>
            )}

            {/* CAS 2 : Proforma active sans facture définitive -> Proposition de conversion */}
            {existingProforma && !existingFacture && (
              <Box sx={{ mb: 1.5, p: 1.5, bgcolor: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 1.5 }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" gap={1.5}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={700} color="#065f46">
                      📋 Proforma active : {existingProforma.numero}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.3 }}>
                      Une proforma existe déjà. Selon la norme comptable, validez-la en facture définitive au lieu d'en créer une nouvelle (évite les doublons de chiffre d'affaires).
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={validateProformaMutation.isPending}
                      onClick={async () => {
                        try {
                          if (form.accompte !== undefined) {
                            try {
                              await handleSave();
                            } catch (err) {
                              console.warn("Auto-save:", err);
                            }
                          }
                          await validateProformaMutation.mutateAsync({ id: existingProforma.id });
                        } catch (err) {
                          console.error("Erreur conversion proforma:", err);
                        }
                      }}
                      sx={{
                        bgcolor: "#059669",
                        color: "#ffffff !important",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        textTransform: "none",
                        px: 1.8,
                        py: 0.8,
                        borderRadius: 2,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        boxShadow: "0 2px 6px rgba(5, 150, 105, 0.25)",
                        "&:hover": { bgcolor: "#047857" },
                      }}
                    >
                      {validateProformaMutation.isPending ? "Conversion..." : "Convertir en Définitive"}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={async () => {
                        if (form.accompte !== undefined) {
                          try {
                            await handleSave();
                          } catch (err) {
                            console.warn("Auto-save:", err);
                          }
                        }
                        onClose();
                        navigate(`/${tenantId}/financier?factureId=${existingProforma.id}`);
                      }}
                      sx={{
                        fontSize: "0.8rem",
                        textTransform: "none",
                        px: 1.5,
                        py: 0.8,
                        borderRadius: 2,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Voir / Imprimer
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            )}

            {/* AFFICHER LA SÉLECTION DES SÉJOURS UNIQUEMENT SI FACTURATION POSSIBLE ET MULTI-CHAMBRES */}
            {shouldShowStaySelection && (
              <Box sx={{ mb: 1.5, p: 1, bgcolor: "#ffffff", borderRadius: 1, border: "1px solid #e9d5ff" }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
                  Sélectionnez les séjours à inclure dans ce document ({selectedStayIdsForBilling.length}/{allReservationStays.length}) :
                </Typography>
                <Stack spacing={0.5}>
                  {allReservationStays.map((st) => {
                    const ch = rooms.find((c) => c.id === st.chambreId);
                    const isSelected = selectedStayIdsForBilling.includes(st.id);
                    const isAlreadyBilledFacture = isStayBilledByFacture(st.id);
                    const isAlreadyBilledProforma = isStayBilledByProforma(st.id);

                    return (
                      <FormControlLabel
                        key={st.id}
                        control={
                          <Checkbox
                            size="small"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStayIdsForBilling((prev) => [...prev, st.id]);
                              } else {
                                setSelectedStayIdsForBilling((prev) => prev.filter((id) => id !== st.id));
                              }
                            }}
                          />
                        }
                        label={
                          <Box sx={{ fontSize: "0.8rem" }}>
                            <strong>Chambre {ch?.numero || st.chambreId}</strong> — Du{" "}
                            {format(new Date(st.dateDebut), "dd/MM/yyyy")} au{" "}
                            {format(new Date(st.dateFin), "dd/MM/yyyy")}
                            {isAlreadyBilledFacture ? (
                              <Chip size="small" color="success" label="Facturé (Définitif)" sx={{ ml: 1, height: 18, fontSize: "0.65rem" }} />
                            ) : isAlreadyBilledProforma ? (
                              <Chip size="small" color="warning" label="Proforma émise" sx={{ ml: 1, height: 18, fontSize: "0.65rem" }} />
                            ) : null}
                          </Box>
                        }
                      />
                    );
                  })}
                </Stack>
              </Box>
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Button
                  size="small"
                  variant="contained"
                  disabled={disabledProforma}
                  onClick={() => handleGenerateDocument("proforma")}
                  sx={{
                    width: "100%",
                    bgcolor: disabledProforma ? "#cbd5e1" : "#f59e0b",
                    "&:hover": { bgcolor: disabledProforma ? "#cbd5e1" : "#d97706" },
                    color: "#fff",
                    fontWeight: 700,
                  }}
                >
                  📋 Établir Facture Proforma
                </Button>
                {proformaReason && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: "0.7rem", lineHeight: 1.2, textAlign: "center" }}
                  >
                    🔒 {proformaReason}
                  </Typography>
                )}
              </Box>

              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Button
                  size="small"
                  variant="contained"
                  disabled={disabledFacture}
                  onClick={() => handleGenerateDocument("facture")}
                  sx={{
                    width: "100%",
                    bgcolor: disabledFacture ? "#cbd5e1" : "#4f46e5",
                    "&:hover": { bgcolor: disabledFacture ? "#cbd5e1" : "#4338ca" },
                    fontWeight: 700,
                  }}
                >
                  📄 Établir Facture Définitive
                </Button>
                {factureReason && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: "0.7rem", lineHeight: 1.2, textAlign: "center" }}
                  >
                    🔒 {factureReason}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Box>
        );
      })()}
        </>
      )}

      <Divider sx={{ my: 1 }} />

      {/* Actions principales de la modale en bas */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems="center">
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
          {!isOtherStaffReservation && form.statut !== "annulee" && (
            <Button
              color="error"
              variant="outlined"
              onClick={() => {
                if (
                  window.confirm(
                    "Confirmez-vous l'annulation de cette réservation ?\n\nLes chambres seront immédiatement libérées sur le planning et l'historique sera préservé pour les statistiques et le suivi client."
                  )
                ) {
                  onSave({ id: r.id, statut: "annulee" });
                  onClose();
                }
              }}
              sx={{ fontWeight: 700, textTransform: "none" }}
            >
              Annuler le séjour
            </Button>
          )}

          {/* Bouton Supprimer : Conforme aux normes hôtelières (Interdit si document ou acompte lié) */}
          {!isOtherStaffReservation && (
            <Tooltip
              title={
                linkedInvoices.length > 0
                  ? "Suppression impossible : des factures ou proformas sont rattachées à cette réservation. Utilisez 'Annuler le séjour'."
                  : Number(form.accompte) > 0
                  ? "Suppression impossible : un acompte est enregistré. Utilisez 'Annuler le séjour'."
                  : "Supprimer définitivement (réservé aux erreurs de saisie immédiates sans document)"
              }
              arrow
            >
              <span>
                <Button
                  color="error"
                  variant="text"
                  disabled={
                    deleteReservation.isPending ||
                    linkedInvoices.length > 0 ||
                    Number(form.accompte) > 0
                  }
                  onClick={() => {
                    if (
                      window.confirm(
                        "Attention : cette action supprime définitivement la réservation de la base de données.\n\nConfirmez-vous la suppression (erreur de saisie) ?"
                      )
                    ) {
                      deleteReservation.mutate({ id: r.id });
                      onClose();
                    }
                  }}
                  sx={{
                    color: (linkedInvoices.length > 0 || Number(form.accompte) > 0) ? "#94a3b8" : "#dc2626",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    textTransform: "none",
                  }}
                >
                  Supprimer (Erreur de saisie)
                </Button>
              </span>
            </Tooltip>
          )}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={onClose} sx={{ textTransform: "none" }}>
            Fermer
          </Button>
          {!isOtherStaffReservation && (
            <Button variant="contained" onClick={handleSave} disabled={!isValid && selectedRoomEntries.length > 0} sx={{ textTransform: "none", fontWeight: 700 }}>
              Valider
            </Button>
          )}
        </Stack>
      </Stack>
    </Stack>
  );

  function handleGenerateDocument(docType: "proforma" | "facture") {
    const details: ReservationChambreDetail[] = [];
    let globalStart: Date | null = null;
    let globalEnd: Date | null = null;
    const roomIds: string[] = [];

    for (const [rId, ranges] of selectedRoomEntries) {
      roomIds.push(rId);
      const ch = rooms.find((c) => c.id === rId);
      const sortedRanges = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
      for (const range of sortedRanges) {
        const nights = Math.max(1, eachDayOfInterval({ start: range.start, end: addDays(range.end, -1) }).length);
        details.push({
          chambreId: rId,
          dateDebut: range.start.toISOString(),
          dateFin: range.end.toISOString(),
          nuits: nights,
          tarifBase: ch?.tarif_base || 0,
        });
        if (!globalStart || range.start < globalStart) globalStart = range.start;
        if (!globalEnd || range.end > globalEnd) globalEnd = range.end;
      }
    }

    const currentRes: Reservation = {
      ...r,
      clientId: form.clientId || r.clientId,
      chambreIds: roomIds,
      chambreId: roomIds[0] || r.chambreId,
      chambresDetails: details,
      stays: allReservationStays,
      dateDebut: globalStart ? globalStart.toISOString() : r.dateDebut,
      dateFin: globalEnd ? globalEnd.toISOString() : r.dateFin,
      nbPersonnes: form.nbPersonnes || r.nbPersonnes || 1,
      packId: selectedPack?.id || r.packId,
      packNom: selectedPack?.nom || r.packNom,
      packPrix: selectedPack?.prix ?? r.packPrix,
      packTypeCalcul: selectedPack?.typeCalcul || r.packTypeCalcul,
    };

    const targetStayIds =
      allReservationStays.length > 1 && selectedStayIdsForBilling.length > 0
        ? selectedStayIdsForBilling
        : undefined;

    generateInvoiceMutation.mutate(
      {
        reservation: currentRes,
        stayIds: targetStayIds,
        typeDocument: docType,
      },
      {
        onSuccess: (newDoc: any) => {
          if (newDoc?.id) {
            onClose();
            navigate(`/${tenantId}/financier?factureId=${newDoc.id}`);
          }
        },
        onError: (err) => {
          console.error("Facturation error:", err);
          alert("Erreur lors de la génération du document.");
        },
      }
    );
  }
}
