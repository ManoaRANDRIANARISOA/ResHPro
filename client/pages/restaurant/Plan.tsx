import {
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import { useMemo, useState, useEffect, Fragment, useCallback } from "react";
import {
  useTables,
  useSaveTables,
  DEFAULT_TABLES,
  useEndOfService,
  useTodayRestoReservations,
  useCreateClient,
  useCreateRestoReservation,
  useUpdateRestoReservation,
  useDeleteRestoReservation,
  useClients,
  useCancelPendingCommandesForReservation,
} from "@/services/api";
import { Reservation, TableResto, Client } from "@shared/api";
import { TableStatus } from "@/components/StatusChip";
import DynamicSchedule from "@/components/DynamicSchedule";
import { format } from "date-fns";

type ReservationMode = "new" | "view" | null;

interface EnrichedReservation extends Reservation {
  client?: Client;
}

interface FormState {
  nom: string;
  telephone: string;
  date: string;
  heure: string;
  nb: number;
  table: string;
  heureArrivee: string;
  heureDepart: string;
  duree: number;
}

export default function RestoPlan() {
  const { data: tables } = useTables();
  const saveTablesMutation = useSaveTables();
  const todayRes = useTodayRestoReservations();
  const { data: clients } = useClients();
  const deleteResa = useDeleteRestoReservation();
  const cancelPendingCmd = useCancelPendingCommandesForReservation();
  const end = useEndOfService();

  // Dialog configuration des tables
  const [configOpen, setConfigOpen] = useState(false);
  const [tableCountInput, setTableCountInput] = useState<number>(12);
  const [customTables, setCustomTables] = useState<TableResto[]>([]);

  const effectiveTables = useMemo(() => {
    return (tables && tables.length > 0) ? tables : DEFAULT_TABLES;
  }, [tables]);

  useEffect(() => {
    if (effectiveTables.length > 0) {
      setTableCountInput(effectiveTables.length);
      setCustomTables(effectiveTables);
    }
  }, [effectiveTables]);

  function handleOpenConfig() {
    setTableCountInput(effectiveTables.length);
    setCustomTables(effectiveTables);
    setConfigOpen(true);
  }

  function handleCountChange(count: number) {
    const validCount = Math.max(1, Math.min(30, count));
    setTableCountInput(validCount);
    const newTables: TableResto[] = [];
    for (let i = 0; i < validCount; i++) {
      const existing = customTables[i];
      if (existing) {
        newTables.push(existing);
      } else {
        newTables.push({
          id: `T${i + 1}`,
          numero: `T${i + 1}`,
          capacite: (i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2),
          statut: 'libre',
        });
      }
    }
    setCustomTables(newTables);
  }

  function handleSaveTableConfig() {
    saveTablesMutation.mutate(customTables, {
      onSuccess: () => {
        setConfigOpen(false);
      }
    });
  }

  // Enrichir les réservations avec les données clients
  const enrichedReservations = useMemo(() => {
    if (!todayRes.data || !clients) return [];
    return todayRes.data.map(reservation => ({
      ...reservation,
      client: clients.find(c => c.id === reservation.clientId)
    }));
  }, [todayRes.data, clients]);
  
  // État pour gérer le mode de réservation (nouvelle ou vue d'une existante)
  const [reservationMode, setReservationMode] = useState<ReservationMode>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  
  // État local pour les réservations enrichies (pour les mises à jour dynamiques)
  const [localEnrichedReservations, setLocalEnrichedReservations] = useState<EnrichedReservation[]>([]);

  // Fonction optimisée pour mettre à jour les réservations localement
  const handleReservationUpdate = useCallback((updatedReservations: EnrichedReservation[]) => {
    setLocalEnrichedReservations(updatedReservations);
    const updatedSelected = updatedReservations.find(r => r.id === selectedReservation?.id);
    if (updatedSelected) {
      setSelectedReservation(updatedSelected);
    }
  }, [selectedReservation?.id]);

  // Synchroniser l'état local avec les données du serveur
  useEffect(() => {
    if (enrichedReservations.length > 0) {
      setLocalEnrichedReservations(enrichedReservations);
    }
  }, [enrichedReservations]);

  const [service, setService] = useState<"today" | "dej" | "diner">("today");
  const [cap, setCap] = useState<"all" | "2" | "4p">("all");

  // Pré-remplissage du formulaire lors d'un clic dans la vue journalière
  const [initialNewHour, setInitialNewHour] = useState<string | undefined>();
  const [initialNewTableId, setInitialNewTableId] = useState<string | undefined>();
  function setInitialNew(payload: { heure?: string; tableId?: string }) {
    setInitialNewHour(payload.heure);
    setInitialNewTableId(payload.tableId);
  }

  const filteredTables = useMemo(() => {
    let list = effectiveTables;
    if (cap === "2") list = list.filter((t) => t.capacite <= 2);
    if (cap === "4p") list = list.filter((t) => t.capacite >= 4);
    return list;
  }, [effectiveTables, cap]);

  const currentService = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 14) return "dej";
    return "diner";
  }, []);

  const serviceLabel = useMemo(() => {
    if (service === "dej") return { label: "Déjeuner" };
    if (service === "diner") return { label: "Dîner" };
    const upcoming = enrichedReservations.find(
      (r) => new Date(r.dateDebut).getTime() > new Date().getTime()
    );
    if (upcoming) return { label: `Prochaine: ${upcoming.heure}` };
    return { label: "" };
  }, [service, enrichedReservations]);

  // Statistiques
  const topTableStats = useMemo(() => {
    const SERVICE_START = 8;
    const SERVICE_END = 22;
    const SERVICE_MINUTES = (SERVICE_END - SERVICE_START) * 60;
    const now = new Date();
    function toMinutes(time?: string) {
      if (!time) return null;
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    }
    function durationForReservation(r: EnrichedReservation) {
      const arriveMin = toMinutes(r.heureArrivee);
      const departMin = toMinutes(r.heureDepart);
      if (arriveMin != null && departMin != null && departMin > arriveMin) {
        return departMin - arriveMin;
      }
      if (arriveMin != null && departMin == null) {
        const curMin = now.getHours() * 60 + now.getMinutes();
        const planned = (r.duree as number) || 60;
        return Math.min(Math.max(0, curMin - arriveMin), planned);
      }
      return (r.duree as number) || 60;
    }
    const totalOccupied = localEnrichedReservations.reduce((sum, r) => sum + durationForReservation(r), 0);
    const capacity = (effectiveTables?.length || 0) * SERVICE_MINUTES;
    const avgOccupationPct = capacity > 0 ? Math.min(100, Math.round((totalOccupied / capacity) * 100)) : 0;
    const perTable: Record<string, number> = {};
    for (const r of localEnrichedReservations) {
      const d = durationForReservation(r);
      const key = r.tableId || "_none";
      perTable[key] = (perTable[key] || 0) + d;
    }
    const favEntry = Object.entries(perTable).sort((a, b) => b[1] - a[1])[0];
    const favTableId = favEntry?.[0];
    const favTable = (effectiveTables || []).find(t => t.id === favTableId)?.numero || (favTableId ? favTableId : "—");
    return {
      totalReservations: localEnrichedReservations.length,
      avgOccupation: `${avgOccupationPct}%`,
      topTable: favTable
    };
  }, [localEnrichedReservations, effectiveTables]);

  return (
    <Box sx={{ pb: 4 }}>
      {/* Contrôles de filtre */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h6" component="h2" fontWeight={800}>
              Planification Restaurant
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {serviceLabel.label}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack direction="row" spacing={1.5} justifyContent="flex-end" alignItems="center" flexWrap="wrap">
              <Button
                variant="outlined"
                size="small"
                startIcon={<SettingsIcon />}
                onClick={handleOpenConfig}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                Configurer les tables ({effectiveTables.length})
              </Button>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Capacité</InputLabel>
                <Select
                  value={cap}
                  onChange={(e) => setCap(e.target.value as any)}
                  label="Capacité"
                >
                  <MenuItem value="all">Toutes</MenuItem>
                  <MenuItem value="2">2 pers.</MenuItem>
                  <MenuItem value="4p">4+ pers.</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Statistiques */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={3} justifyContent="center" alignItems="stretch">
          <Grid item xs={12} sm={4} md={4}>
            <Box textAlign="center">
              <Typography variant="h6" color="primary" fontWeight={800}>
                {topTableStats.totalReservations}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Réservations
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4} md={4}>
            <Box textAlign="center">
              <Typography variant="h6" color="primary" fontWeight={800}>
                {topTableStats.avgOccupation}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Occupation
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4} md={4}>
            <Box textAlign="center">
              <Typography variant="h6" color="primary" fontWeight={800}>
                {topTableStats.topTable}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Table favorite
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Légende et contrôles */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle1" fontWeight={700}>
              Légende
            </Typography>
            <Chip size="small" label="Réservé" sx={{ backgroundColor: '#66BB6A', color: '#fff', fontWeight: 600 }} />
            <Chip size="small" label="Occupé" sx={{ backgroundColor: '#EF5350', color: '#fff', fontWeight: 600 }} />
            <Chip size="small" label="Terminé" sx={{ backgroundColor: '#9E9E9E', color: '#fff', fontWeight: 600 }} />
          </Stack>
          <Button
            variant="contained"
            onClick={() => {
              setReservationMode('new');
              setSelectedReservation(null);
              document.getElementById("new-resa")?.scrollIntoView({ behavior: "smooth" });
            }}
            sx={{ fontWeight: 700 }}
          >
            Nouvelle Réservation
          </Button>
        </Stack>
      </Paper>

      {/* Planning dynamique médical-style (Grille Horaires x Tables avec ligne de temps rouge) */}
      <Paper sx={{ p: 2, mb: 2, overflowX: 'auto' }}>
        <Typography fontWeight={800} mb={2}>Planning Dynamique</Typography>
        <DynamicSchedule 
          reservations={localEnrichedReservations} 
          tables={filteredTables}
          clients={clients}
          onReservationUpdate={handleReservationUpdate}
          onReservationClick={(reservation) => {
            setReservationMode('view');
            setSelectedReservation(reservation);
            document
              .getElementById("new-resa")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          onMarkNoShow={(reservationId) => {
            cancelPendingCmd.mutate({ reservationId });
          }}
        />
      </Paper>

      <ReservationsList 
        reservations={localEnrichedReservations}
        clients={clients || []}
        tables={filteredTables}
        onViewReservation={(reservation) => {
          setReservationMode("view");
          setSelectedReservation(reservation);
          document
            .getElementById("new-resa")
            ?.scrollIntoView({ behavior: "smooth" });
        }}
      />
      <NewReservationForm 
        mode={reservationMode}
        selectedReservation={selectedReservation}
        setReservationMode={setReservationMode}
        onDelete={async () => {
          if (selectedReservation) {
            await deleteResa.mutateAsync({ id: selectedReservation.id });
            const updatedReservations = localEnrichedReservations.filter(r => r.id !== selectedReservation.id);
            setLocalEnrichedReservations(updatedReservations);
            setReservationMode(null);
            setSelectedReservation(null);
          }
        }}
        initialHour={initialNewHour}
        initialTableId={initialNewTableId}
        localEnrichedReservations={localEnrichedReservations}
        setLocalEnrichedReservations={setLocalEnrichedReservations}
        setSelectedReservation={setSelectedReservation}
      />

      {/* Modal Paramétrage des Tables du Restaurant */}
      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          Paramétrage des tables du restaurant
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="body2" fontWeight={700} mb={0.5}>
                Nombre total de tables :
              </Typography>
              <TextField
                type="number"
                size="small"
                fullWidth
                value={tableCountInput}
                onChange={(e) => handleCountChange(parseInt(e.target.value || '1', 10))}
                inputProps={{ min: 1, max: 30 }}
                helperText="Ajustez le nombre de tables configurées pour votre établissement (ex: 8, 12, 16, 20)."
              />
            </Box>

            <Typography variant="subtitle2" fontWeight={700}>
              Liste et capacités des tables
            </Typography>

            <Box sx={{ maxHeight: 280, overflowY: 'auto', pr: 1 }}>
              <Stack spacing={1.5}>
                {customTables.map((t, idx) => (
                  <Paper key={t.id || idx} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TextField
                      label="Nom / Numéro"
                      size="small"
                      value={t.numero}
                      onChange={(e) => {
                        const next = [...customTables];
                        next[idx] = { ...next[idx], numero: e.target.value, id: e.target.value };
                        setCustomTables(next);
                      }}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Capacité (pers.)"
                      type="number"
                      size="small"
                      value={t.capacite}
                      onChange={(e) => {
                        const next = [...customTables];
                        next[idx] = { ...next[idx], capacite: parseInt(e.target.value || '2', 10) };
                        setCustomTables(next);
                      }}
                      inputProps={{ min: 1, max: 20 }}
                      sx={{ width: 140 }}
                    />
                  </Paper>
                ))}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigOpen(false)}>Annuler</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveTableConfig}
            disabled={saveTablesMutation.isPending}
            sx={{ fontWeight: 700 }}
          >
            {saveTablesMutation.isPending ? "Enregistrement..." : "Enregistrer la disposition"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ReservationsList({ 
  reservations,
  clients,
  tables,
  onViewReservation 
}: { 
  reservations: EnrichedReservation[];
  clients: Client[];
  tables: TableResto[];
  onViewReservation: (reservation: Reservation) => void 
}) {

  const enrichedReservations = useMemo(() => {
    if (!reservations || !clients) return [];
    return reservations.map(reservation => ({
      ...reservation,
      client: clients.find(c => c.id === reservation.clientId),
      table: tables?.find(t => t.id === reservation.tableId)
    }));
  }, [reservations, clients, tables]);

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" component="h3" gutterBottom>
        Réservations du jour
      </Typography>
      {enrichedReservations.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Aucune réservation pour aujourd'hui
        </Typography>
      ) : (
        <Stack spacing={1}>
          {enrichedReservations.map((r) => (
            <Box
              key={r.id}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                p: 1,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight="bold">
                  {r.client?.nom || "Client inconnu"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {r.heure} - Table {r.table?.numero || "?"} ({r.nbPersonnes} pers.)
                </Typography>
              </Box>
              <Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => onViewReservation(r)}
                >
                  Voir
                </Button>
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

function NewReservationForm({ 
  mode, 
  selectedReservation,
  setReservationMode,
  onDelete,
  initialHour,
  initialTableId,
  localEnrichedReservations,
  setLocalEnrichedReservations,
  setSelectedReservation
}: { 
  mode: ReservationMode;
  selectedReservation: Reservation | null;
  setReservationMode: (mode: ReservationMode) => void;
  onDelete: () => void;
  initialHour?: string;
  initialTableId?: string;
  localEnrichedReservations: EnrichedReservation[];
  setLocalEnrichedReservations: (reservations: EnrichedReservation[]) => void;
  setSelectedReservation: (reservation: Reservation | null) => void;
}) {
  const createClient = useCreateClient();
  const createResa = useCreateRestoReservation();
  const updateResa = useUpdateRestoReservation();
  const { data: clients } = useClients();
  const { data: tables } = useTables();

  // État du formulaire
  const [form, setForm] = useState<FormState>({
    nom: "",
    telephone: "",
    date: format(new Date(), "yyyy-MM-dd"),
    heure: "19:00",
    nb: 4,
    table: "",
    heureArrivee: "",
    heureDepart: "",
    duree: 60,
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const nowStr = format(new Date(), "HH:mm");

  // Synchroniser le formulaire quand une réservation est sélectionnée ou mise à jour
  useEffect(() => {
    if (mode === "view" && selectedReservation) {
      // Toujours utiliser la version la plus récente depuis localEnrichedReservations
      const currentReservation = localEnrichedReservations.find(r => r.id === selectedReservation?.id) || selectedReservation;
      const client = clients?.find((c) => c.id === currentReservation.clientId);
      setForm({
        nom: client?.nom || "",
        telephone: client?.telephone || "",
        date: currentReservation.dateDebut 
          ? format(new Date(currentReservation.dateDebut), "yyyy-MM-dd") 
          : format(new Date(), "yyyy-MM-dd"),
        heure: currentReservation.heure || "19:00",
        nb: currentReservation.nbPersonnes || 4,
        table: currentReservation.tableId || "",
        heureArrivee: currentReservation.heureArrivee || "",
        heureDepart: currentReservation.heureDepart || "",
        duree: (currentReservation.duree as number) || 60,
      });
    } else if (mode === "new") {
      // Réinitialiser pour une nouvelle réservation
      setForm({
        nom: "",
        telephone: "",
        date: format(new Date(), "yyyy-MM-dd"),
        heure: initialHour || "19:00",
        nb: 4,
        table: initialTableId || "",
        heureArrivee: "",
        heureDepart: "",
        duree: 60,
      });
    }
  }, [mode, selectedReservation, clients, initialHour, initialTableId, localEnrichedReservations]);

  async function save() {
    if (mode === "view" && selectedReservation) {
      // Mode édition: mettre à jour la réservation existante
      const date = new Date(form.date + "T" + form.heure + ":00");
      await updateResa.mutateAsync({
        id: selectedReservation.id,
        dateDebut: date.toISOString(),
        heure: form.heure,
        nbPersonnes: form.nb,
        tableId: form.table || undefined,
        heureArrivee: form.heureArrivee || undefined,
        heureDepart: form.heureDepart || undefined,
        duree: form.duree || 60,
      });
      
      // Mettre à jour l'état local immédiatement
      const updatedReservations = localEnrichedReservations.map(r => 
        r.id === selectedReservation.id 
          ? { 
              ...r, 
              dateDebut: date.toISOString(),
              heure: form.heure,
              nbPersonnes: form.nb,
              tableId: form.table || undefined,
              heureArrivee: form.heureArrivee || undefined,
              heureDepart: form.heureDepart || undefined,
              duree: form.duree || (r.duree as number) || 60,
            }
          : r
      );
      setLocalEnrichedReservations(updatedReservations);
      if (selectedReservation) {
        const updatedSelected = updatedReservations.find(r => r.id === selectedReservation.id);
        if (updatedSelected) {
          setSelectedReservation(updatedSelected);
        }
      }
      
    } else {
      // Mode création: créer une nouvelle réservation
      const client = await createClient.mutateAsync({
        nom: form.nom,
        telephone: form.telephone,
      });
      const date = new Date(form.date + "T" + form.heure + ":00");
      const newReservation = await createResa.mutateAsync({
        clientId: client.id,
        dateDebut: date.toISOString(),
        heure: form.heure,
        nbPersonnes: form.nb,
        tableId: form.table || undefined,
      });
      
      // Ajouter la nouvelle réservation à l'état local
      const enrichedNewReservation = { ...newReservation, client };
      enrichedNewReservation.duree = form.duree || 60;
      setLocalEnrichedReservations([...localEnrichedReservations, enrichedNewReservation]);
    }
  }
  
  async function handleDelete() {
    if (selectedReservation) {
      // Appeler la fonction onDelete pour que le parent gère la suppression
      onDelete();
    }
  }

  return (
    <Box id="new-resa" sx={{ mt: 3 }}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" component="h3" gutterBottom>
          {mode === "view" ? "Détails de la réservation" : "Nouvelle réservation"}
        </Typography>
        
        <Stack spacing={2}>
          <TextField
            label="Nom du client"
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
          />
          <TextField
            label="Téléphone"
            value={form.telephone}
            onChange={(e) => setForm({ ...form, telephone: e.target.value })}
          />
          <TextField
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <TextField
            label="Heure"
            type="time"
            value={form.heure}
            onChange={(e) => setForm({ ...form, heure: e.target.value })}
          />
          <TextField
            label="Nombre de personnes"
            type="number"
            value={form.nb}
            onChange={(e) => setForm({ ...form, nb: parseInt(e.target.value) || 1 })}
          />
          <TextField
            label="Durée d'occupation (minutes)"
            type="number"
            value={form.duree}
            onChange={(e) => setForm({ ...form, duree: parseInt(e.target.value) || 60 })}
          />
          <FormControl fullWidth>
            <InputLabel>Table</InputLabel>
            <Select
              value={form.table}
              onChange={(e) => setForm({ ...form, table: e.target.value })}
            >
              <MenuItem value="">
                <em>Automatique</em>
              </MenuItem>
              {tables?.map((table) => (
                <MenuItem key={table.id} value={table.id}>
                  Table {table.numero} ({table.capacite} places)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        
        {/* Champs pour les heures d'arrivée et de départ */}
        {mode === "view" && selectedReservation && (
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            sx={{
              mt: 2,
              p: 2,
              backgroundColor: "#f5f5f5",
              borderRadius: 1,
            }}
          >
            <TextField
              label="Heure d'arrivée"
              type="time"
              value={form.heureArrivee}
              onChange={(e) => setForm({ ...form, heureArrivee: e.target.value })}
              helperText="Laissez vide si non arrivé"
            />
            <TextField
              label="Heure de départ"
              type="time"
              value={form.heureDepart}
              onChange={(e) => setForm({ ...form, heureDepart: e.target.value })}
              helperText="Laissez vide si non parti"
            />
          </Stack>
        )}
        
        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button
            variant="contained"
            onClick={save}
            disabled={createResa.isPending || updateResa.isPending}
          >
            {mode === "view" ? "Mettre à jour" : "Enregistrer"}
          </Button>
          {/* Afficher le bouton Supprimer uniquement en mode "view" (réservation existante) */}
          {mode === "view" && selectedReservation && (
            <Button 
              variant="contained" 
              color="error"
              onClick={handleDelete}
            >
              Supprimer
            </Button>
          )}
          <Button
            variant="outlined"
            onClick={() => {
              setReservationMode(null);
              setSelectedReservation(null);
            }}
          >
            Annuler
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}