import {
  Box,
  Grid,
  Paper,
  Typography,
  Chip,
  Stack,
  Button,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Select,
  MenuItem,
  Alert,
} from "@mui/material";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";
import {
  useFactures,
  useEvenements,
  useStockProduits,
  useChambres,
  useHebergementReservations,
  useRoomMaintenance,
  sortChambres,
  reservationHasRoom,
  getReservationRoomInterval,
} from "@/services/api";
import { useTenant } from "@/contexts/TenantContext";
import {
  addDays,
  format,
  getISOWeek,
  startOfWeek,
  endOfWeek,
  isSameDay,
  startOfMonth,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Link, useSearchParams } from "react-router-dom";
import { RoomCalendar } from "@/components/RoomCalendar";
import { useState, useMemo } from "react";
import { exportToCSV, exportToPDF } from "@/lib/export";
import { Facture } from "@shared/api";

function formatAr(n: number) {
  return `${n.toLocaleString("fr-FR")} Ar`;
}

function LegendDot({ color, label }: { color: string; label: string }) {
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

export default function Dashboard() {
  const { data: reservations } = useHebergementReservations();
  const { data: factures } = useFactures();
  const { data: stock } = useStockProduits();
  const { tenantId, publicConfig } = useTenant();
  const { data: events } = useEvenements();
  const { data: rawRooms } = useChambres();
  const { data: maintenance } = useRoomMaintenance();

  const sortedRooms = useMemo(() => sortChambres(rawRooms || []), [rawRooms]);

  const pendingList = useMemo(
    () => (factures || []).filter((f) => f.statut === "emise" && (f.typeDocument === "facture" || !f.typeDocument)),
    [factures]
  );
  
  const lowList = useMemo(
    () => (stock || []).filter((p) => p.stock <= p.seuilMin),
    [stock]
  );

  // Hook pour récupérer les paramètres URL
  const [sp] = useSearchParams();
  const notice = sp.get("notice");

  // État pour le calendrier des chambres
  const [roomView, setRoomView] = useState<"month" | "week" | "day">("week");
  const [roomDateRef, setRoomDateRef] = useState<Date>(new Date());

  // Revenus par activité (synchronisés avec Financier)
  const revenus = useMemo(() => {
    const sum = (src: Facture["source"]) =>
      (factures || [])
        .filter((f) => f.source === src && f.statut === "payee" && (f.typeDocument === "facture" || !f.typeDocument))
        .reduce((s, f) => s + (f.totalTTC || 0), 0);
    return [
      { name: "Héb.", value: sum("Hebergement") },
      { name: "Resto", value: sum("Restaurant") },
      { name: "Évén.", value: sum("Evenement") },
    ];
  }, [factures]);

  function handleExportRevenus() {
    const exportData = revenus.map((r) => ({
      Activité: r.name,
      "Revenus (Ar)": r.value.toLocaleString("fr-FR"),
    }));
    exportToCSV(exportData, "revenus_par_activite");
  }

  function handleExportRevenusPDF() {
    const exportData = revenus.map((r) => ({
      Activité: r.name,
      Revenus: formatAr(r.value),
    }));
    exportToPDF("Revenus par activité", exportData, "revenus_par_activite", publicConfig?.nom);
  }

  // Filtres pour les alertes
  const [stockFamilleFilter, setStockFamilleFilter] = useState<"all" | "Restaurant" | "Hebergement">("all");
  const [alertFilter, setAlertFilter] = useState<"all" | "stock" | "chambre">("all");

  const alerts = useMemo(() => {
    const now = new Date();
    const currentMaintenances = (maintenance || []).filter((m: any) => {
      const start = new Date(m.dateDebut || m.start);
      const end = new Date(m.dateFin || m.end || m.dateDebut || m.start);
      return now >= start && now <= addDays(end, 1);
    });

    const chambreAlerts = currentMaintenances.map((m: any) => {
      const room = sortedRooms.find((r) => r.id === m.chambreId);
      return {
        type: "chambre" as const,
        text: `Chambre ${room?.numero || m.chambreId} hors service`,
        badge: "Maintenance",
      };
    });

    const filteredLowStock = (stock || [])
      .filter((p) => p.stock <= p.seuilMin)
      .filter((p) => (stockFamilleFilter === "all" ? true : p.famille === stockFamilleFilter));

    const stockAlerts = filteredLowStock.map((p) => ({
      type: "stock" as const,
      text: `${p.nom} (${p.stock} ${p.unite || "unités"} restants)`,
      badge: p.stock === 0 ? "Rupture" : "Stock bas",
    }));

    const alertsAll = [...stockAlerts, ...chambreAlerts];

    return alertsAll.filter((a) =>
      alertFilter === "all"
        ? true
        : alertFilter === "stock"
          ? a.type === "stock"
          : a.type === "chambre"
    );
  }, [maintenance, sortedRooms, stock, stockFamilleFilter, alertFilter]);

  // KPIs dynamiques
  const today = new Date();
  const occupiedCount = useMemo(() => {
    return sortedRooms.filter((c) =>
      (reservations || []).some((r) => {
        if (r.statut !== "arrivee" && r.statut !== "confirmee") return false;
        if (!reservationHasRoom(r, c.id)) return false;
        const { resDebut, resFin } = getReservationRoomInterval(r, c.id);
        return today >= resDebut && today < resFin;
      })
    ).length;
  }, [sortedRooms, reservations, today]);

  const occupancyRate = sortedRooms.length
    ? Math.round((occupiedCount / sortedRooms.length) * 100)
    : 0;

  const arrivalsNext7 = useMemo(() => {
    return (reservations || []).filter((r) => {
      if (r.type !== "hebergement" || r.statut === "annulee") return false;
      const d = new Date(r.dateDebut);
      return d > today && d <= addDays(today, 7);
    }).length;
  }, [reservations, today]);

  // Calendrier semaine (Événements)
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const weekEvents = useMemo(() => {
    return (events || []).filter((e) => {
      if (e.sessions && e.sessions.length > 0) {
        return e.sessions.some((s) => {
          const d = new Date(s.date + "T00:00:00");
          return d >= weekStart && d <= weekEnd;
        });
      }
      const d = new Date(e.date + "T00:00:00");
      return d >= weekStart && d <= weekEnd;
    });
  }, [events, weekStart, weekEnd]);

  const weekNumber = Number(format(new Date(), "I"));
  const monthLabel = format(new Date(), "LLLL yyyy", { locale: fr });

  return (
    <Box>
      {/* Alerte pour les administrateurs */}
      {notice === "admin-only" && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Accès réservé aux administrateurs
        </Alert>
      )}

      <Typography variant="h4" fontWeight={800} mb={3}>
        Tableau de bord
      </Typography>

      {/* KPIs */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary">Taux d'occupation</Typography>
            <Typography variant="h4" fontWeight={800}>
              {occupancyRate}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {occupiedCount} / {sortedRooms.length} chambre{sortedRooms.length > 1 ? "s" : ""}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary">Arrivées à venir (7j)</Typography>
            <Typography variant="h4" fontWeight={800}>
              {arrivalsNext7}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Réservations prévues
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary">Alertes stock</Typography>
            <Typography variant="h4" fontWeight={800} color={lowList.length > 0 ? "warning.main" : "inherit"}>
              {lowList.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Articles sous le seuil
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary">Factures en attente</Typography>
            <Typography variant="h4" fontWeight={800} color={pendingList.length > 0 ? "primary.main" : "inherit"}>
              {pendingList.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              À encaisser
            </Typography>
          </Paper>
        </Grid>

        {/* Alertes + Calendrier semaine */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2, height: 360, display: "flex", flexDirection: "column" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1, flexWrap: "wrap", gap: 1 }}>
              <Typography fontWeight={700}>Alertes</Typography>
              <Stack direction="row" spacing={0.8} alignItems="center">
                <Chip
                  size="small"
                  label="Tous"
                  color={alertFilter === "all" ? "primary" : "default"}
                  variant={alertFilter === "all" ? "filled" : "outlined"}
                  onClick={() => setAlertFilter("all")}
                />
                <Chip
                  size="small"
                  label="Stock"
                  color={alertFilter === "stock" ? "primary" : "default"}
                  variant={alertFilter === "stock" ? "filled" : "outlined"}
                  onClick={() => setAlertFilter("stock")}
                />
                <Chip
                  size="small"
                  label="Chambres"
                  color={alertFilter === "chambre" ? "primary" : "default"}
                  variant={alertFilter === "chambre" ? "filled" : "outlined"}
                  onClick={() => setAlertFilter("chambre")}
                />
                {alertFilter === "stock" && (
                  <Select
                    size="small"
                    value={stockFamilleFilter}
                    onChange={(e) => setStockFamilleFilter(e.target.value as any)}
                    sx={{ minWidth: 130, height: 28, fontSize: "0.75rem" }}
                  >
                    <MenuItem value="all">Tous stocks</MenuItem>
                    <MenuItem value="Restaurant">Restaurant</MenuItem>
                    <MenuItem value="Hebergement">Hébergement</MenuItem>
                  </Select>
                )}
              </Stack>
            </Stack>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, overflow: "auto", flex: 1, mt: 0.5 }}>
              {alerts.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
                  Aucune alerte pour le moment 👍
                </Typography>
              )}
              {alerts.map((a, i) => (
                <Paper
                  key={i}
                  variant="outlined"
                  sx={{
                    p: 1.2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Typography variant="body2" fontWeight={600}>{a.text}</Typography>
                  <Chip
                    size="small"
                    label={a.badge}
                    color={a.badge === "Rupture" ? "error" : a.badge === "Stock bas" ? "warning" : "default"}
                    variant={a.badge === "Rupture" ? "filled" : "outlined"}
                  />
                </Paper>
              ))}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2, height: 360, display: "flex", flexDirection: "column" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography fontWeight={700}>Événements de la semaine</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={`S-${weekNumber}`} variant="outlined" />
                <Chip size="small" label={monthLabel} />
              </Stack>
            </Stack>
            <Divider sx={{ mb: 1 }} />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 1,
                flex: 1,
              }}
            >
              {days.map((d) => (
                <Box
                  key={d.toISOString()}
                  sx={{
                    p: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    minHeight: 90,
                    bgcolor: isSameDay(d, today) ? "action.hover" : "transparent",
                  }}
                >
                  <Typography variant="caption" fontWeight={isSameDay(d, today) ? 800 : 500} color={isSameDay(d, today) ? "primary.main" : "text.secondary"}>
                    {format(d, "EEE d", { locale: fr })}
                  </Typography>
                  <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                    {weekEvents
                      .filter((e) => {
                        if (e.sessions && e.sessions.length > 0) {
                          return e.sessions.some((s) => isSameDay(new Date(s.date + "T00:00:00"), d));
                        }
                        return isSameDay(new Date(e.date + "T00:00:00"), d);
                      })
                      .map((e) => (
                        <Chip
                          key={e.id}
                          size="small"
                          label={e.nom}
                          color="primary"
                          component={Link as any}
                          to={`/${tenantId}/resto/evenements`}
                          clickable
                        />
                      ))}
                  </Stack>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Revenus + Factures en attente */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: 340 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography fontWeight={700}>Revenus payés par activité</Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" onClick={handleExportRevenusPDF}>
                  PDF
                </Button>
                <Button size="small" variant="outlined" onClick={handleExportRevenus}>
                  Excel
                </Button>
              </Stack>
            </Stack>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenus}>
                <XAxis dataKey="name" />
                <Tooltip formatter={(value: any) => `${Number(value || 0).toLocaleString("fr-FR")} Ar`} />
                <Bar dataKey="value" fill="#6E8EF5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
              <LegendDot color="#6E8EF5" label="Chiffre d'Affaires Encaissé (TTC)" />
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: 340, display: "flex", flexDirection: "column" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography fontWeight={700}>Factures en attente</Typography>
              <Chip size="small" label={pendingList.length} color={pendingList.length > 0 ? "primary" : "default"} />
            </Stack>
            <List dense sx={{ flex: 1, overflow: "auto" }}>
              {pendingList.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
                  Toutes les factures sont réglées 🎉
                </Typography>
              )}
              {pendingList.map((f) => (
                <ListItemButton
                  key={f.id}
                  sx={{ borderTop: "1px solid", borderColor: "divider", px: 1 }}
                >
                  <ListItemText
                    primary={f.clientNom || "Client"}
                    secondary={`${format(new Date(f.date), "dd/MM/yyyy", { locale: fr })} · ${formatAr(f.totalTTC)}`}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    component={Link}
                    to={`/${tenantId}/financier?factureId=${encodeURIComponent(f.id)}`}
                  >
                    Ouvrir
                  </Button>
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Mini calendrier chambres */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography fontWeight={700}>Occupation des chambres</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  label="Mensuel"
                  color={roomView === "month" ? "primary" : "default"}
                  variant={roomView === "month" ? "filled" : "outlined"}
                  onClick={() => setRoomView("month")}
                />
                <Chip
                  size="small"
                  label="Hebdo"
                  color={roomView === "week" ? "primary" : "default"}
                  variant={roomView === "week" ? "filled" : "outlined"}
                  onClick={() => setRoomView("week")}
                />
                <Chip
                  size="small"
                  label="Jour"
                  color={roomView === "day" ? "primary" : "default"}
                  variant={roomView === "day" ? "filled" : "outlined"}
                  onClick={() => setRoomView("day")}
                />
                <Chip
                  size="small"
                  label="Aujourd'hui"
                  variant="outlined"
                  onClick={() => setRoomDateRef(new Date())}
                />
                <Chip
                  size="small"
                  label="◀"
                  onClick={() =>
                    setRoomDateRef((d) =>
                      roomView === "month"
                        ? addDays(d, -30)
                        : roomView === "week"
                          ? addDays(d, -7)
                          : addDays(d, -1)
                    )
                  }
                />
                <Chip
                  size="small"
                  label="▶"
                  onClick={() =>
                    setRoomDateRef((d) =>
                      roomView === "month"
                        ? addDays(d, 30)
                        : roomView === "week"
                          ? addDays(d, 7)
                          : addDays(d, 1)
                    )
                  }
                />
              </Stack>
            </Stack>
            <Box sx={{ maxHeight: 400, overflowY: "auto", overflowX: "hidden" }}>
              <RoomCalendar
                view={roomView}
                dateRef={roomDateRef}
                statusFilter="all"
                reservations={reservations || []}
                chambres={sortedRooms}
                maintenance={maintenance || []}
                compact={true}
              />
            </Box>
            <Stack direction="row" spacing={2} sx={{ mt: 1.5, pt: 1, borderTop: "1px solid", borderColor: "divider" }} flexWrap="wrap" rowGap={0.5}>
              <LegendDot color="#FFFFFF" label="Libre" />
              <LegendDot color="#F59E0B" label="En attente / Devis" />
              <LegendDot color="#66BB6A" label="Réservée" />
              <LegendDot color="#EF5350" label="Occupée" />
              <LegendDot color="#9E9E9E" label="Hors service" />
            </Stack>
          </Paper>
        </Grid>

        {/* Liens Rapides */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography fontWeight={700}>Plan de salle (Restaurant)</Typography>
              <Typography variant="body2" color="text.secondary">
                Vue rapide des tables et commandes en cours
              </Typography>
            </Box>
            <Button variant="contained" component={Link as any} to={`/${tenantId}/resto/plan`}>
              Ouvrir
            </Button>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography fontWeight={700}>Gestion des chambres (Hébergement)</Typography>
              <Typography variant="body2" color="text.secondary">
                Planning détaillé, réservations et facturation
              </Typography>
            </Box>
            <Button variant="outlined" component={Link as any} to={`/${tenantId}/hebergement/gestion`}>
              Voir
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
