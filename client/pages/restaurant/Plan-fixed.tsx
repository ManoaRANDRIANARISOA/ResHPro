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
} from "@/services/api";
import { Reservation, TableResto, Client } from "@shared/api";
import { TableStatus } from "@/components/StatusChip";
import DynamicSchedule from "@/components/DynamicSchedule";
import { format } from "date-fns";

type ReservationMode = "new" | "view" | null;

interface EnrichedReservation extends Reservation {
  client?: Client;
}

export default function RestoPlan() {
  const { data: tables } = useTables();
  const todayRes = useTodayRestoReservations();
  const { data: clients } = useClients();
  const end = useEndOfService();

  // État pour gérer le mode de réservation
  const [reservationMode, setReservationMode] = useState<ReservationMode>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  
  // État local pour les réservations
  const [localReservations, setLocalReservations] = useState<Reservation[]>([]);

  // Fonction pour mettre à jour les réservations localement
  const updateLocalReservation = useCallback((updatedReservations: EnrichedReservation[]) => {
    setLocalReservations(updatedReservations);
    // Mettre à jour la réservation sélectionnée si elle existe dans la liste
    const updatedSelected = updatedReservations.find(r => r.id === selectedReservation?.id);
    if (updatedSelected) {
      setSelectedReservation(updatedSelected);
    }
  }, [selectedReservation?.id]);

  // Charger les données initiales
  useEffect(() => {
    if (todayRes.data) {
      setLocalReservations(todayRes.data);
    }
  }, [todayRes.data]);

  const [service, setService] = useState<"today" | "dej" | "diner">("today");
  const [cap, setCap] = useState<"all" | "2" | "4p">("all");

  // Pré-remplissage du formulaire
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

  // Enrichir les réservations avec les données clients
  const enrichedReservations = useMemo(() => {
    if (!localReservations || !clients) return [];
    return localReservations.map(reservation => ({
      ...reservation,
      client: clients.find(c => c.id === reservation.clientId)
    }));
  }, [localReservations, clients]);

  return (
    <Box>
      {/* Contrôles de filtre */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h6" component="h2">
              Planification Restaurant
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <FormControl size="small" sx={{ minWidth: 120 }}>
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
              </FormControl>
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

      {/* Légende */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h6" component="h3">
            Légende
          </Typography>
          <Chip size="small" label="Réservé" sx={{ backgroundColor: '#66BB6A', color: '#fff' }} />
          <Chip size="small" label="Occupé" sx={{ backgroundColor: '#EF5350', color: '#fff' }} />
          <Chip size="small" label="Terminé" sx={{ backgroundColor: '#9E9E9E', color: '#fff' }} />
        </Stack>
      </Paper>

      {/* Planning dynamique médical-style */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography fontWeight={800} mb={2}>Planning Dynamique</Typography>
        {filteredTables.length > 0 && enrichedReservations && (
          <DynamicSchedule 
            reservations={enrichedReservations} 
            tables={filteredTables}
            clients={clients}
            onReservationUpdate={updateLocalReservation}
            onReservationClick={(reservation) => {
              setReservationMode('view');
              setSelectedReservation(reservation);
              document
                .getElementById("new-resa")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        )}
      </Paper>

      <ReservationForm
        mode={reservationMode}
        reservation={selectedReservation}
        onClose={() => {
          setReservationMode(null);
          setSelectedReservation(null);
        }}
        onUpdate={(updatedReservation: Reservation) => {
          // Mettre à jour la réservation dans l'état local
          const updatedReservations = localReservations.map(r => 
            r.id === updatedReservation.id ? updatedReservation : r
          );
          setLocalReservations(updatedReservations);
          // Mettre à jour la réservation sélectionnée si c'est la même
          if (selectedReservation && selectedReservation.id === updatedReservation.id) {
            setSelectedReservation(updatedReservation);
          }
        }}
        initialHour={initialNewHour}
        initialTableId={initialNewTableId}
      />
    </Box>
  );
}

function ReservationForm({ 
  mode, 
  reservation,
  onClose,
  onUpdate,
  initialHour,
  initialTableId
}: { 
  mode: ReservationMode;
  reservation: Reservation | null;
  onClose: () => void;
  onUpdate: (reservation: Reservation) => void;
  initialHour?: string;
  initialTableId?: string;
}) {
  const createClient = useCreateClient();
  const createResa = useCreateRestoReservation();
  const updateResa = useUpdateRestoReservation();
  const deleteResa = useDeleteRestoReservation();
  const { data: clients } = useClients();
  const { data: tables } = useTables();

  // État du formulaire
  const [form, setForm] = useState({
    nom: "",
    telephone: "",
    date: format(new Date(), "yyyy-MM-dd"),
    heure: "19:00",
    nb: 4,
    table: "",
    heureArrivee: "",
    heureDepart: "",
  });

  // Synchroniser le formulaire quand une réservation est sélectionnée
  useEffect(() => {
    if (mode === "view" && reservation) {
      const client = clients?.find((c) => c.id === reservation.clientId);
      setForm({
        nom: client?.nom || "",
        telephone: client?.telephone || "",
        date: reservation.dateDebut 
          ? format(new Date(reservation.dateDebut), "yyyy-MM-dd") 
          : format(new Date(), "yyyy-MM-dd"),
        heure: reservation.heure || "19:00",
        nb: reservation.nbPersonnes || 4,
        table: reservation.tableId || "",
        heureArrivee: reservation.heureArrivee || "",
        heureDepart: reservation.heureDepart || "",
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
      });
    }
  }, [mode, reservation, clients, initialHour, initialTableId]);

  async function handleSave() {
    if (mode === "view" && reservation) {
      // Mode édition: mettre à jour la réservation existante
      const date = new Date(form.date + "T" + form.heure + ":00");
      const updatedReservation = {
        ...reservation,
        dateDebut: date.toISOString(),
        heure: form.heure,
        nbPersonnes: form.nb,
        tableId: form.table || undefined,
        heureArrivee: form.heureArrivee || undefined,
        heureDepart: form.heureDepart || undefined,
      };
      
      await updateResa.mutateAsync(updatedReservation);
      onUpdate(updatedReservation);
      
    } else if (mode === "new") {
      // Mode création: créer une nouvelle réservation
      const client = await createClient.mutateAsync({
        nom: form.nom,
        telephone: form.telephone,
      });
      const date = new Date(form.date + "T" + form.heure + ":00");
      await createResa.mutateAsync({
        clientId: client.id,
        dateDebut: date.toISOString(),
        heure: form.heure,
        nbPersonnes: form.nb,
        tableId: form.table || undefined,
      });
    }
    
    onClose();
  }
  
  async function handleDelete() {
    if (reservation) {
      await deleteResa.mutateAsync({ id: reservation.id });
      onClose();
    }
  }

  if (mode === null) return null;

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
            disabled={mode === "view"}
          />
          <TextField
            label="Téléphone"
            value={form.telephone}
            onChange={(e) => setForm({ ...form, telephone: e.target.value })}
            disabled={mode === "view"}
          />
          <TextField
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            disabled={mode === "view"}
          />
          <TextField
            label="Heure"
            type="time"
            value={form.heure}
            onChange={(e) => setForm({ ...form, heure: e.target.value })}
            disabled={mode === "view"}
          />
          <TextField
            label="Nombre de personnes"
            type="number"
            value={form.nb}
            onChange={(e) => setForm({ ...form, nb: parseInt(e.target.value) || 1 })}
            disabled={mode === "view"}
          />
          <FormControl fullWidth>
            <InputLabel>Table</InputLabel>
            <Select
              value={form.table}
              onChange={(e) => setForm({ ...form, table: e.target.value })}
              disabled={mode === "view"}
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
        {mode === "view" && reservation && (
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
            onClick={handleSave}
            disabled={createResa.isPending || updateResa.isPending}
          >
            {mode === "view" ? "Mettre à jour" : "Enregistrer"}
          </Button>
          {/* Afficher le bouton Supprimer uniquement en mode "view" (réservation existante) */}
          {mode === "view" && reservation && (
            <Button 
              variant="contained" 
              color="error"
              onClick={handleDelete}
              disabled={deleteResa.isPending}
            >
              Supprimer
            </Button>
          )}
          <Button
            variant="outlined"
            onClick={onClose}
          >
            Fermer
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}