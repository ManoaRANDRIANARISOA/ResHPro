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
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { useMemo, useState, useEffect, Fragment, useCallback } from "react";
import {
  useTables,
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
// Modals latéraux retirés selon demande
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
  const todayRes = useTodayRestoReservations();
  const { data: clients } = useClients();
  const deleteResa = useDeleteRestoReservation();
  const cancelPendingCmd = useCancelPendingCommandesForReservation();
  // Drawer/modal latéral retiré
  const end = useEndOfService();

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
    console.log('Plan.tsx - Mise à jour des réservations reçue:', updatedReservations.length, 'réservations');
    setLocalEnrichedReservations(updatedReservations);
    // Mettre également à jour la réservation sélectionnée si elle existe
    const updatedSelected = updatedReservations.find(r => r.id === selectedReservation?.id);
    if (updatedSelected) {
      console.log('Plan.tsx - Réservation sélectionnée mise à jour:', updatedSelected.id);
      setSelectedReservation(updatedSelected);
    }
  }, [selectedReservation?.id]);

  // Synchroniser l'état local avec les données du serveur - SOLUTION DÉFINITIVE
  useEffect(() => {
    if (enrichedReservations.length > 0) {
      // Seulement à l'initialisation ou quand nécessaire
      if (localEnrichedReservations.length === 0) {
        setLocalEnrichedReservations(enrichedReservations);
      }
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
    let list = tables ?? [];
    if (cap === "2") list = list.filter((t) => t.capacite <= 2);
    if (cap === "4p") list = list.filter((t) => t.capacite >= 4);
    return list;
  }, [tables, cap]);

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

  // const selectedReservationId = selected?.assignedReservationId ?? ""; // retiré

  // Statistiques (statique pour l'instant, prêt pour données dynamiques du backend)
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
    const capacity = (tables?.length || 0) * SERVICE_MINUTES;
    const avgOccupationPct = capacity > 0 ? Math.min(100, Math.round((totalOccupied / capacity) * 100)) : 0;
    const perTable: Record<string, number> = {};
    for (const r of localEnrichedReservations) {
      const d = durationForReservation(r);
      const key = r.tableId || "_none";
      perTable[key] = (perTable[key] || 0) + d;
    }
    const favEntry = Object.entries(perTable).sort((a, b) => b[1] - a[1])[0];
    const favTableId = favEntry?.[0];
    const favTable = (tables || []).find(t => t.id === favTableId)?.numero || (favTableId ? favTableId : "—");
    return {
      totalReservations: localEnrichedReservations.length,
      avgOccupation: `${avgOccupationPct}%`,
      topTable: favTable
    };
  }, [localEnrichedReservations, tables]);

  return (
    <Box>
      {/* Contrôles de filtre */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h6" component="h2">
              Planification Restaurant
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {serviceLabel.label}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              {/* <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Service</InputLabel>
                <Select
                  value={service}
                  onChange={(e) => setService(e.target.value as any)}
                  label="Service"
                >
                  <MenuItem value="today">Aujourd'hui</MenuItem>
                  <MenuItem value="dej">Déjeuner</MenuItem>
                  <MenuItem value="diner">Dîner</MenuItem>
                </Select>
              </FormControl> */}
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
              <Typography variant="h6" color="primary">
                {topTableStats.totalReservations}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Réservations
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4} md={4}>
            <Box textAlign="center">
              <Typography variant="h6" color="primary">
                {topTableStats.avgOccupation}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Occupation
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4} md={4}>
            <Box textAlign="center">
              <Typography variant="h6" color="primary">
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
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h6" component="h3">
              Légende
            </Typography>
            <Chip size="small" label="Réservé" sx={{ backgroundColor: '#66BB6A', color: '#fff' }} />
            <Chip size="small" label="Occupé" sx={{ backgroundColor: '#EF5350', color: '#fff' }} />
            <Chip size="small" label="Terminé" sx={{ backgroundColor: '#9E9E9E', color: '#fff' }} />
          </Stack>
          <Button
            variant="contained"
            onClick={() => {
              setReservationMode('new');
              setSelectedReservation(null);
              document.getElementById("new-resa")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Nouvelle Réservation
          </Button>
        </Stack>
      </Paper>

      {/* Planning dynamique médical-style */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography fontWeight={800} mb={2}>Planning Dynamique</Typography>
        {filteredTables.length > 0 && enrichedReservations && (
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
        )}
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
            // Mettre à jour l'état local immédiatement
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

      {/* Drawer et modals supprimés pour une interface simplifiée */}
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