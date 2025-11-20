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
} from "@mui/material";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";
import { useFactures, useEvenements, useStockProduits, useChambres, useHebergementReservations } from "@/services/api";
import {
  addDays,
  format,
  startOfWeek,
  endOfWeek,
  isSameDay,
  startOfMonth,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { RoomCalendar } from "@/components/RoomCalendar";
import { Fragment, useState } from "react";
import { exportToCSV, exportToPDF } from "@/lib/export";

function formatAr(n: number) {
  return `${n.toLocaleString("fr-FR")} Ar`;
}

export default function Dashboard() {
  const { data: reservations } = useHebergementReservations();
  const { data: factures } = useFactures();
  const { data: stock } = useStockProduits();
  const { data: events } = useEvenements();
  const { data: rooms } = useChambres();
  const pendingList = (factures || []).filter((f) => f.statut === "emise");
  const lowList = (stock || []).filter((p) => p.stock <= p.seuilMin);
  const zeroList = (stock || []).filter((p) => p.stock === 0);
  
  // État pour le calendrier des chambres
  const [roomView, setRoomView] = useState<"month" | "week" | "day">("week");
  const [roomDateRef, setRoomDateRef] = useState<Date>(new Date());

  // Revenus par activité (synchronisés avec Financier)
  const revenus = (() => {
    const sum = (src: import("@shared/api").Facture["source"]) =>
      (factures || [])
        .filter((f) => f.source === src && f.statut === "payee")
        .reduce((s, f) => s + f.totalTTC, 0);
    return [
      { name: "Héb.", value: sum("Hebergement") },
      { name: "Resto", value: sum("Restaurant") },
      { name: "Évén.", value: sum("Evenement") },
    ];
  })();

  function handleExportRevenus() {
    const exportData = revenus.map(r => ({
      'Activité': r.name,
      'Revenus (Ar)': r.value.toLocaleString('fr-FR')
    }));
    exportToCSV(exportData, 'revenus_par_activite');
  }

  function handleExportRevenusPDF() {
    const exportData = revenus.map(r => ({
      'Activité': r.name,
      'Revenus': formatAr(r.value)
    }));
    exportToPDF('Revenus par activité', exportData, 'revenus_par_activite');
  }

  // Alerts data (stock + housekeeping)
  const chambreAlerts = (rooms || [])
    .filter((c) => c.statut === "maintenance")
    .map((c) => ({
      type: "chambre" as const,
      text: `${c.numero} en maintenance`,
      badge: "En nettoyage",
    }));
  // Filtres secondaires pour le stock
  const [stockFamilleFilter, setStockFamilleFilter] = useState<"all" | "Restaurant" | "Hebergement">("all");
  const filteredLow = (stock || [])
    .filter((p) => p.stock <= p.seuilMin)
    .filter((p) => stockFamilleFilter === "all" ? true : p.famille === stockFamilleFilter)
    .map((p) => p);
  const stockAlerts = filteredLow.map((p) => ({
    type: "stock" as const,
    text: `${p.nom} sous seuil`,
    badge: "Rupture",
  }));
  const alertsAll = [...stockAlerts, ...chambreAlerts];

  const [alertFilter, setAlertFilter] = useState<"all" | "stock" | "chambre">(
    "all",
  );
  const alerts = alertsAll.filter((a) =>
    alertFilter === "all"
      ? true
      : alertFilter === "stock"
        ? a.type === "stock"
        : a.type === "chambre",
  );

  // KPIs dynamiques
  const today = new Date();
  const occupiedCount = (rooms || []).filter((c) =>
    (reservations || []).some((r) => {
      if (r.type !== "hebergement" || r.chambreId !== c.id) return false;
      const dStart = new Date(r.dateDebut);
      const dEnd = new Date(r.dateFin || r.dateDebut);
      return r.statut === "arrivee" && today >= dStart && today < dEnd;
    })
  ).length;
  const occupancyRate = (rooms || []).length
    ? Math.round((occupiedCount / (rooms || []).length) * 100)
    : 0;
  const arrivalsNext7 = (reservations || []).filter((r) => {
    if (r.type !== "hebergement") return false;
    const d = new Date(r.dateDebut);
    return d > today && d <= addDays(today, 7);
  }).length;

  // Week calendar (events) — synchronisés avec page événements
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const weekEvents = (events || []).filter((e) => {
    const d = new Date(e.date + "T00:00:00");
    return d >= weekStart && d <= weekEnd;
  });
  const weekNumber = Number(format(new Date(), "I"));
  const monthLabel = format(new Date(), "LLLL yyyy", { locale: fr });

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} mb={3}>
        Tableau de bord
      </Typography>

      {/* KPIs */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary">Taux d'occupation</Typography>
            <Typography variant="h4" fontWeight={800}>
              {occupancyRate}%
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary">
              Arrivées à venir (7j)
            </Typography>
            <Typography variant="h4" fontWeight={800}>
              {arrivalsNext7}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary">Alertes stock</Typography>
            <Typography variant="h4" fontWeight={800}>
              {lowList.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary">Factures en attente</Typography>
            <Typography variant="h4" fontWeight={800}>
              {pendingList.length}
            </Typography>
          </Paper>
        </Grid>

        {/* Alertes + Calendrier semaine */}
        <Grid item xs={12} md={5}>
          <Paper
            sx={{ p: 2, height: 360, display: "flex", flexDirection: "column" }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1 }}
            >
              <Typography fontWeight={700}>Alertes</Typography>
              <Stack direction="row" spacing={1}>
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
                    sx={{ minWidth: 200 }}
                  >
                    <MenuItem value="all">Tous stocks</MenuItem>
                    <MenuItem value="Restaurant">Restaurant</MenuItem>
                    <MenuItem value="Hebergement">Hébergement</MenuItem>
                  </Select>
                )}
              </Stack>
            </Stack>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                overflow: "auto",
              }}
            >
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
                  <Typography>{a.text}</Typography>
                  <Chip
                    size="small"
                    label={a.badge}
                    color={a.badge === "Rupture" ? "error" : "warning"}
                    variant={a.badge === "Rupture" ? "filled" : "outlined"}
                  />
                </Paper>
              ))}
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={7}>
          <Paper
            sx={{ p: 2, height: 360, display: "flex", flexDirection: "column" }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1 }}
            >
              <Typography fontWeight={700}>Calendrier (semaine)</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  label={`S-${weekNumber}`}
                  variant="outlined"
                />
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
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {format(d, "EEE d", { locale: fr })}
                  </Typography>
                  <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                    {weekEvents
                      .filter((e) =>
                        isSameDay(new Date(e.date + "T00:00:00"), d),
                      )
                      .map((e) => (
                        <Chip
                          key={e.id}
                          size="small"
                          label={e.nom}
                          color="primary"
                          component={Link as any}
                          to="/resto/evenements"
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
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1 }}
            >
              <Typography fontWeight={700}>Revenus par activité</Typography>
              <Stack direction="row" spacing={1}>
                <Chip size="small" label="Ce mois" color="primary" />
                <Button size="small" variant="outlined" onClick={handleExportRevenusPDF}>
                  PDF
                </Button>
                <Button size="small" variant="outlined" onClick={handleExportRevenus}>
                  Excel
                </Button>
              </Stack>
            </Stack>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenus}>
                <XAxis dataKey="name" />
                <Tooltip />
                <Bar dataKey="value" fill="#6E8EF5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              <LegendDot color="#6E8EF5" label="CA TTC" />
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper
            sx={{ p: 2, height: 340, display: "flex", flexDirection: "column" }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1 }}
            >
              <Typography fontWeight={700}>Factures en attente</Typography>
              <Chip size="small" label={pendingList.length} />
            </Stack>
            <List dense sx={{ flex: 1, overflow: "auto" }}>
              {pendingList.map((f) => (
                <ListItemButton
                  key={f.id}
                  sx={{ borderTop: "1px solid", borderColor: "divider" }}
                >
                  <ListItemText
                    primary={f.clientNom}
                    secondary={`${format(new Date(f.date), "dd/MM/yyyy", { locale: fr })} · ${formatAr(f.totalTTC)}`}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    component={Link}
                    to={`/financier?factureId=${encodeURIComponent(f.id)}`}
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
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1 }}
            >
              <Typography fontWeight={700}>Occupation chambres</Typography>
              <Stack direction="row" spacing={1}>
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
                  onClick={() => setRoomDateRef(d => 
                    roomView === "month" ? addDays(d, -30) : 
                    roomView === "week" ? addDays(d, -7) : 
                    addDays(d, -1)
                  )}
                />
                <Chip 
                  size="small" 
                  label="▶" 
                  onClick={() => setRoomDateRef(d => 
                    roomView === "month" ? addDays(d, 30) : 
                    roomView === "week" ? addDays(d, 7) : 
                    addDays(d, 1)
                  )}
                />
              </Stack>
            </Stack>
            <Box sx={{ maxHeight: 400, overflowY: 'auto', overflowX: 'hidden' }}>
              <RoomCalendar 
                view={roomView}
                dateRef={roomDateRef}
                statusFilter="all"
                reservations={reservations || []}
                chambres={rooms || []}
                compact={true}
              />
            </Box>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <LegendDot color="#FFFFFF" label="Libre" />
              <LegendDot color="#66BB6A" label="Réservée" />
              <LegendDot color="#EF5350" label="Occupée" />
              <LegendDot color="#9E9E9E" label="Hors service" />
            </Stack>
          </Paper>
        </Grid>

        {/* Recaps */}
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
              <Typography fontWeight={700}>Plan de salle</Typography>
              <Typography variant="body2" color="text.secondary">
                Vue rapide des tables et réservations en cours
              </Typography>
            </Box>
            <Button
              variant="contained"
              component={Link as any}
              to="/resto/plan"
            >
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
              <Typography fontWeight={700}>
                Réservations hébergement
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Calendrier et détails
              </Typography>
            </Box>
            <Button
              variant="outlined"
              component={Link as any}
              to="/hebergement/gestion"
            >
              Voir
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box
        sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color }}
      />
      <Typography variant="caption">{label}</Typography>
    </Stack>
  );
}

import { useSearchParams } from "react-router-dom";
import { Alert } from "@mui/material";
  const [sp] = useSearchParams();
  const notice = sp.get("notice");
      {notice === "admin-only" && (
        <Alert severity="info" sx={{ mb: 2 }}>Accès réservé aux administrateurs</Alert>
      )}

