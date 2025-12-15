import { Box, Button, Chip, Grid, Paper, Stack, Typography, Divider, Select, MenuItem, TextField, Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { addDays, format, getISOWeek, startOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { useMemo, useState, useEffect, Fragment } from "react";
import { useHebergementReservations, useUpdateHebergementReservation, useCreateHebergementReservation, useClients, useCreateClient, useChambres, useFactures, useCreateFacture, useRoomMaintenance, useAddRoomMaintenance, useRemoveRoomMaintenance,
  useUpdateChambre,
} from "@/services/api";
import { Reservation, Chambre, ChambreMaintenance } from "@shared/api";
import { RoomCalendar } from "@/components/RoomCalendar";
import { exportToCSV, exportToPDF } from "@/lib/export";
import { useSearchParams } from "react-router-dom";

type View = "month" | "week" | "day";

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box 
        sx={{ 
          width: 10, 
          height: 10, 
          borderRadius: '50%', 
          bgcolor: color,
          border: color === '#FFFFFF' ? '1px solid #ccc' : 'none'
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
  const { data: maintenance } = useRoomMaintenance();
  const addMaint = useAddRoomMaintenance();
  const removeMaint = useRemoveRoomMaintenance();
  const updateRoom = useUpdateChambre();
  const update = useUpdateHebergementReservation();
  const create = useCreateHebergementReservation();
  const { data: clients } = useClients();
  const { data: rooms } = useChambres();
  const [open, setOpen] = useState<Reservation | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [view, setView] = useState<View>('month');
  const [dateRef, setDateRef] = useState<Date>(startOfMonth(new Date()));
  const [searchParams] = useSearchParams();
  const [maintRoomId, setMaintRoomId] = useState<string>('');
  const [maintStart, setMaintStart] = useState<string>('');
  const [maintEnd, setMaintEnd] = useState<string>('');
  
  // Ouvrir automatiquement le modal de création si demandé via l’URL
  useEffect(() => {
    if (searchParams.get('newReservation') === '1') {
      setCreateModalOpen(true);
    }
  }, [searchParams]);
  useEffect(() => {
    const rid = rooms?.[0]?.id || '';
    setMaintRoomId((v) => v || rid);
    const s = format(dateRef, 'yyyy-MM-dd');
    const e = format(addDays(dateRef, 1), 'yyyy-MM-dd');
    setMaintStart((v) => v || s);
    setMaintEnd((v) => v || e);
  }, [rooms, dateRef]);
  // Status filter supprimé sur cette page (UI)

  function deriveReservationStatus(r: Reservation) {
    const now = new Date();
    const dStart = new Date(r.dateDebut);
    const dEnd = new Date(r.dateFin || r.dateDebut);
    if (r.statut === 'annulee') return 'annulee';
    if (now < dStart) {
      // Ne pas afficher "arrivee" pour le futur; garder confirmée/en_attente
      return r.statut === 'arrivee' ? 'confirmee' : r.statut;
    }
    if (now >= dStart && now < dEnd) {
      return r.statut === 'arrivee' ? 'arrivee' : 'confirmee';
    }
    return 'terminee';
  }

  // Calcul dynamique de la chambre la plus occupée du mois courant
  const chambresStats = useMemo(() => {
    const start = startOfMonth(dateRef);
    const end = endOfMonth(dateRef);
    const daysInMonth = eachDayOfInterval({ start, end }).length;
    const stats = (rooms || []).map((ch) => {
      // Compte des jours occupés dans le mois (statut annulé ignoré)
      const occupiedDays = (list || [])
        .filter((r) => r.type === 'hebergement' && r.chambreId === ch.id && r.statut !== 'annulee')
        .reduce((sum, r) => {
          const dStart = new Date(r.dateDebut);
          const dEnd = new Date(r.dateFin || r.dateDebut);
          // chevauchement avec le mois
          const overlapStart = dStart < start ? start : dStart;
          const overlapEnd = dEnd > end ? end : dEnd;
          if (overlapEnd <= overlapStart) return sum;
          const overlapDays = eachDayOfInterval({ start: overlapStart, end: overlapEnd }).length;
          return sum + Math.max(0, overlapDays);
        }, 0);
      const taux = Math.min(100, Math.round((occupiedDays / daysInMonth) * 100));
      return { chambre: ch.numero, categorie: ch.categorie, totalReservations: occupiedDays, tauxOccupation: taux };
    });
    return stats.sort((a, b) => b.totalReservations - a.totalReservations);
  }, [list, dateRef, rooms]);

  function label() {
    if (view==='month') {
      const formatted = format(dateRef, 'LLLL yyyy', { locale: fr });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
    if (view==='week') return `Semaine ${getISOWeek(dateRef)}`;
    const formatted = format(dateRef, 'dd LLLL yyyy', { locale: fr });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  function handleExportReservations() {
    const exportData = (list || []).map(r => ({
      'Client': clients?.find(c => c.id === r.clientId)?.nom || r.clientId,
      'Arrivée': format(new Date(r.dateDebut), 'dd/MM/yyyy'),
      'Départ': r.dateFin ? format(new Date(r.dateFin), 'dd/MM/yyyy') : '-',
      'Chambre': (rooms || []).find(c => c.id === r.chambreId)?.numero || '-',
      'Statut': r.statut,
      'Personnes': r.nbPersonnes || '-'
    }));
    
    exportToCSV(exportData, 'reservations_hebergement');
  }

  function handleExportPDF() {
    const exportData = (list || []).map(r => ({
      'Client': clients?.find(c => c.id === r.clientId)?.nom || r.clientId,
      'Arrivée': format(new Date(r.dateDebut), 'dd/MM/yyyy'),
      'Départ': r.dateFin ? format(new Date(r.dateFin), 'dd/MM/yyyy') : '-',
      'Chambre': (rooms || []).find(c => c.id === r.chambreId)?.numero || '-',
      'Statut': r.statut,
      'Personnes': r.nbPersonnes || '-'
    }));
    
    exportToPDF('Liste des réservations - Hébergement', exportData, 'reservations_hebergement');
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} mb={2}>Hébergement — Gestion des chambres</Typography>

      {/* Statistique chambre la plus occupée */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
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
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
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
            <Stack direction={{ xs:'column', md:'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 1 }}>
              <Stack direction="row" spacing={1}>
                <Chip size="small" label="Mensuel" color={view==='month'? 'primary':'default'} variant={view==='month'? 'filled':'outlined'} onClick={()=>setView('month')} />
                <Chip size="small" label="Hebdo" color={view==='week'? 'primary':'default'} variant={view==='week'? 'filled':'outlined'} onClick={()=>setView('week')} />
                <Chip size="small" label="Jour" color={view==='day'? 'primary':'default'} variant={view==='day'? 'filled':'outlined'} onClick={()=>setView('day')} />
                <Chip size="small" label="Aujourd'hui" variant="outlined" onClick={()=> setDateRef(new Date()) } />
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" label={label()} />
              <Chip size="small" label="◀" onClick={()=> setDateRef(d=> view==='month'? addDays(d, -30): view==='week'? addDays(d,-7): addDays(d,-1)) } />
              <Chip size="small" label="▶" onClick={()=> setDateRef(d=> view==='month'? addDays(d, 30): view==='week'? addDays(d,7): addDays(d,1)) } />
            </Stack>
          </Stack>
          <RoomCalendar 
            view={view} 
            dateRef={dateRef} 
            statusFilter={'all'}
            reservations={list || []}
            chambres={rooms || []}
            maintenance={maintenance || []}
          />
            <Stack direction="row" spacing={2} sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Legend color="#FFFFFF" label="Libre" />
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
                <Button variant="outlined" onClick={handleExportReservations}>Export CSV</Button>
                <Button variant="outlined" onClick={handleExportPDF}>Export PDF</Button>
                <Button variant="contained" onClick={() => setCreateModalOpen(true)}>
                  Nouvelle réservation
                </Button>
              </Stack>
            </Stack>
            <Paper sx={{ p: 1, mb: 1 }}>
              <Stack direction={{ xs:'column', md:'row' }} spacing={1} alignItems={{ xs:'stretch', md:'center' }}>
                <Typography variant="body2" color="text.secondary">Hors service (période)</Typography>
                <Box sx={{ display:'flex', gap:1, flexWrap:'wrap' }}>
                  <Select size="small" value={maintRoomId} onChange={(e)=> setMaintRoomId(e.target.value)} sx={{ minWidth:160 }}>
                    {(rooms||[]).map(r=> (<MenuItem key={r.id} value={r.id}>{r.numero}</MenuItem>))}
                  </Select>
                  <TextField size="small" type="date" label="Début" value={maintStart} onChange={(e)=> setMaintStart(e.target.value)} sx={{ minWidth:160 }} />
                  <TextField size="small" type="date" label="Fin" value={maintEnd} onChange={(e)=> setMaintEnd(e.target.value)} sx={{ minWidth:160 }} />
                  <Button size="small" variant="outlined" onClick={() => {
                    if (!maintRoomId || !maintStart || !maintEnd) return;
                    removeMaint.mutate({ chambreId: maintRoomId, start: maintStart, end: maintEnd }, {
                      onSuccess: () => updateRoom.mutate({ id: maintRoomId, statut: 'libre' } as any)
                    });
                  }}>Réactiver</Button>
                  <Button size="small" variant="text" onClick={() => {
                    if (!maintRoomId || !maintStart || !maintEnd) return;
                    addMaint.mutate({ chambreId: maintRoomId, start: maintStart, end: maintEnd });
                  }}>Marquer HS</Button>
                </Box>
              </Stack>
            </Paper>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 140px 140px 120px 140px', px: 1, py: 1, color: 'text.secondary', fontWeight: 700 }}>
              <Box>Client</Box><Box>Arrivée</Box><Box>Départ</Box><Box>Chambre</Box><Box>Montant</Box><Box>Statut</Box><Box>Action</Box>
            </Box>
            {(list || []).map((r) => (
              <Box key={r.id} sx={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 140px 140px 120px 140px', px: 1, py: 1, alignItems: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
                <Box>{clients?.find(c => c.id === r.clientId)?.nom ?? r.clientId}</Box>
                <Box>{format(new Date(r.dateDebut), 'dd/MM/yyyy')}</Box>
                <Box>{r.dateFin ? format(new Date(r.dateFin), 'dd/MM/yyyy') : '-'}</Box>
                <Box>{(rooms || []).find((c) => c.id === r.chambreId)?.numero ?? '-'}</Box>
                <Box>
                  {(() => {
                    const f = (factures || []).find((x) => x.reservationId === r.id && x.source === 'Hebergement');
                    if (!f) return <Chip size="small" label="—" variant="outlined" />;
                    return (
                      <Button size="small" variant="text" onClick={() => (window.location.href = `/financier?factureId=${f.id}`)}>
                        {f.totalTTC.toLocaleString()} Ar
                      </Button>
                    );
                  })()}
                </Box>
                <Box>{deriveReservationStatus(r)}</Box>
                <Box>
                  {(() => {
                    const f = (factures || []).find((x) => x.reservationId === r.id && x.source === 'Hebergement');
                    if (!f || f.statut === 'annulee') {
                      const ch = (rooms || []).find((c) => c.id === r.chambreId);
                      const dStart = new Date(r.dateDebut);
                      const dEnd = new Date(r.dateFin || r.dateDebut);
                      const nights = eachDayOfInterval({ start: dStart, end: dEnd }).length;
                      const total = (ch?.tarif_base ?? 0) * nights;
                      return (
                        <Button size="small" variant="contained" onClick={() => createFacture.mutate({
                          clientNom: clients?.find(c => c.id === r.clientId)?.nom || String(r.clientId),
                          date: new Date().toISOString(),
                          dueDate: addDays(dStart, 15).toISOString(),
                          source: 'Hebergement',
                          lignes: [{ description: `Nuitée ${(rooms || []).find(c => c.id === r.chambreId)?.numero || r.chambreId} (${dStart.toLocaleDateString()} – ${dEnd.toLocaleDateString()})`, qte: nights, pu: ch?.tarif_base ?? 0 }],
                          totalTTC: total,
                          reservationId: r.id,
                          statut: 'emise',
                        })}>
                          Créer facture
                        </Button>
                      );
                    }
                    return <Button size="small" variant="outlined" onClick={() => setOpen(r)}>Voir</Button>;
                  })()}
                </Box>
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>

      {/* Dialog pour consulter/éditer une réservation existante avec calendrier interactif */}
      <Dialog open={!!open} onClose={() => setOpen(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Voir réservation</DialogTitle>
        <DialogContent>
          {!open && <Typography color="text.secondary">Sélectionnez une réservation</Typography>}
            {open && (
            <EditReservation 
              r={open} 
              reservations={list || []}
              rooms={rooms || []}
              maintenance={maintenance || []}
              onClose={()=> setOpen(null)} 
              onSave={(p)=> update.mutate(p as any, { onSuccess: ()=> setOpen(null) })} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal pour créer une nouvelle réservation */}
      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle réservation</DialogTitle>
        <DialogContent>
          <CreateReservationForm 
            reservations={list || []}
            rooms={rooms || []}
            maintenance={maintenance || []}
            onClose={() => setCreateModalOpen(false)}
            initialClientId={searchParams.get('clientId') || undefined}
            onCreate={(payload) => {
              create.mutate(payload, {
                onSuccess: () => setCreateModalOpen(false)
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}

function Ariary({ value }: { value: number }) {
  return <>{value.toLocaleString('fr-MG')} Ar</>;
}

function CreateReservationForm({ 
  reservations, 
  rooms,
  maintenance,
  onClose, 
  onCreate,
  initialClientId
}: { 
  reservations: Reservation[];
  rooms: Chambre[];
  maintenance: ChambreMaintenance[];
  onClose: () => void;
  onCreate: (payload: any) => void;
  initialClientId?: string;
}) {
  const { data: clients } = useClients();
  const createClient = useCreateClient();
  
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const [modalDateRef, setModalDateRef] = useState<Date>(today);
  
  const [form, setForm] = useState({
    clientId: initialClientId ?? '',
    clientNom: '',
    clientTelephone: '',
    chambreId: '',
    dateDebut: today,
    dateFin: tomorrow,
    nbPersonnes: 2,
    statut: 'confirmee' as const,
  });

  const [selectedDates, setSelectedDates] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null
  });

  // Calculer les chambres disponibles pour les dates sélectionnées
  const availableRooms = useMemo(() => {
    if (!selectedDates.start || !selectedDates.end) return [];
    
    const debut = selectedDates.start;
    const fin = selectedDates.end;
    
    return rooms.filter(chambre => {
      if (chambre.statut === 'maintenance') return false;
      
      const hasConflict = reservations.some(r => {
        if (r.type !== 'hebergement' || r.chambreId !== chambre.id) return false;
        const resDebut = new Date(r.dateDebut);
        const resFin = new Date(r.dateFin || r.dateDebut);
        return resDebut < fin && resFin > debut;
      });
      
      return !hasConflict;
    });
  }, [selectedDates, reservations, rooms]);

  // Générer les dates affichées pour le calendrier (fenêtre glissante)
  const weekStart = startOfWeek(modalDateRef, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 13) });

  // Vérifier la disponibilité d'une chambre pour une date
  function isRoomAvailable(chambreId: string, date: Date) {
    const nextDay = addDays(date, 1);
    const inMaint = maintenance.some(m => m.chambreId === chambreId && new Date(m.start) < nextDay && new Date(m.end) > date);
    if (inMaint) return false;
    const hasConflict = reservations.some(r => {
      if (r.type !== 'hebergement' || r.chambreId !== chambreId) return false;
      if (r.statut === 'annulee') return false;
      const resDebut = new Date(r.dateDebut);
      const resFinBase = new Date(r.dateFin || r.dateDebut);
      const resFin = addDays(resFinBase, 1);
      return resDebut < nextDay && resFin > date;
    });
    return !hasConflict;
  }

  // Gérer le clic sur une cellule du calendrier
  function handleCellClick(chambreId: string, date: Date) {
    if (!isRoomAvailable(chambreId, date)) return;
    // Si changement de chambre, repartir sur nouvelle sélection
    if (!form.chambreId || form.chambreId !== chambreId) {
      setSelectedDates({ start: date, end: null });
      setForm({ ...form, chambreId, dateDebut: date, dateFin: addDays(date, 1) });
      return;
    }

    // Sélection flexible: clics successifs étendent/réduisent la plage
    if (selectedDates.start && selectedDates.end) {
      if (date >= selectedDates.start) {
        setSelectedDates({ start: selectedDates.start, end: date });
        setForm({ ...form, chambreId, dateFin: date });
      } else {
        // Nouveau début avant l'ancien: repart sur nouveau début
        setSelectedDates({ start: date, end: null });
        setForm({ ...form, chambreId, dateDebut: date, dateFin: addDays(date, 1) });
      }
      return;
    }

    if (!selectedDates.start) {
      setSelectedDates({ start: date, end: null });
      setForm({ ...form, chambreId, dateDebut: date, dateFin: addDays(date, 1) });
      return;
    }

    // start défini, end non défini
    if (date.getTime() === selectedDates.start.getTime()) {
      // Toggle: reclique sur la même date => désélection
      setSelectedDates({ start: null, end: null });
      setForm({ ...form, chambreId: '', dateDebut: today, dateFin: addDays(today, 1) });
    } else if (date > selectedDates.start) {
      setSelectedDates({ start: selectedDates.start, end: date });
      setForm({ ...form, chambreId, dateFin: date });
    } else if (date < selectedDates.start) {
      setSelectedDates({ start: date, end: null });
      setForm({ ...form, chambreId, dateDebut: date, dateFin: addDays(date, 1) });
    }
  }

  // Couleur de la cellule selon la sélection
  function getCellColor(chambreId: string, date: Date) {
    const chambre = rooms.find(c => c.id === chambreId);
    if (chambre?.statut === 'maintenance') return '#9E9E9E'; // Gris - indisponible
    if (!isRoomAvailable(chambreId, date)) return '#EF5350'; // Rouge - occupé
    
    if (selectedDates.start && selectedDates.end && chambreId === form.chambreId) {
      if (date >= selectedDates.start && date <= selectedDates.end) {
        return '#66BB6A'; // Vert - sélectionné
      }
    } else if (selectedDates.start && !selectedDates.end && chambreId === form.chambreId) {
      if (date.getTime() === selectedDates.start.getTime()) {
        return '#66BB6A'; // Vert - début sélectionné
      }
    }
    
    return '#FFFFFF'; // Blanc - disponible
  }

  // Validation
  const isValid = (form.clientId || (form.clientNom && form.clientTelephone)) && 
                  form.chambreId && 
                  selectedDates.start;

  async function handleCreate() {
    if (!isValid) return;
    
    let clientId = form.clientId;
    
    // Créer un nouveau client si nécessaire
    if (!clientId && form.clientNom && form.clientTelephone) {
      try {
        const newClient = await createClient.mutateAsync({
          nom: form.clientNom,
          telephone: form.clientTelephone
        });
        clientId = newClient.id;
      } catch (error) {
        console.error('Erreur lors de la création du client:', error);
        return;
      }
    }
    
    onCreate({
      clientId,
      chambreId: form.chambreId,
      dateDebut: selectedDates.start!.toISOString(),
      dateFin: (selectedDates.end ? selectedDates.end : addDays(selectedDates.start!, 1)).toISOString(),
      nbPersonnes: form.nbPersonnes,
      statut: form.statut,
    });
  }

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Typography variant="body2" fontWeight={700}>Client</Typography>
      <Autocomplete
        freeSolo
        options={clients || []}
        getOptionLabel={(option) => typeof option === 'string' ? option : `${option.nom} - ${option.telephone}`}
        value={clients?.find(c => c.id === form.clientId) || null}
        onChange={(_, newValue) => {
          if (newValue && typeof newValue !== 'string') {
            setForm({ ...form, clientId: newValue.id, clientNom: '', clientTelephone: '' });
          } else {
            setForm({ ...form, clientId: '', clientNom: '', clientTelephone: '' });
          }
        }}
        onInputChange={(_, newInputValue) => {
          setForm({ ...form, clientNom: newInputValue, clientId: '' });
        }}
        renderInput={(params) => (
          <TextField {...params} size="small" label="Nom du client" placeholder="Saisir ou sélectionner" />
        )}
      />

      {!form.clientId && form.clientNom && (
        <TextField
          size="small"
          label="Téléphone du nouveau client"
          value={form.clientTelephone}
          onChange={(e) => setForm({ ...form, clientTelephone: e.target.value })}
          placeholder="032 00 000 00"
        />
      )}

      <Divider />
      
      <Typography variant="body2" fontWeight={700}>
        Sélectionnez les dates et la chambre (cliquez sur le calendrier)
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip size="small" label={`Semaine du ${format(weekStart, 'dd MMM yyyy', { locale: fr })}`} />
        <Chip size="small" label="◀" onClick={() => setModalDateRef(d => addDays(d, -7))} />
        <Chip size="small" label="▶" onClick={() => setModalDateRef(d => addDays(d, 7))} />
      </Stack>
      
      <Box sx={{ 
        border: '1px solid', 
        borderColor: 'divider', 
        borderRadius: 1, 
        p: 1,
        maxHeight: 300,
        overflowY: 'auto',
        overflowX: 'auto'
      }}>
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: `80px repeat(${weekDays.length}, minmax(90px, 1fr))`, 
          gap: 0.5,
          minWidth: 'max-content'
        }}>
          <Box />
          {weekDays.map((d) => (
            <Box key={d.toISOString()} sx={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, py: 0.5 }}>
              {format(d, 'EEE d', { locale: fr })}
            </Box>
          ))}
          
          {(rooms || []).map((chambre) => (
            <Fragment key={chambre.id}>
              <Box sx={{ py: 0.5, fontSize: '0.75rem', fontWeight: 700 }}>
                {chambre.numero}
              </Box>
              {weekDays.map((date) => {
                const available = isRoomAvailable(chambre.id, date);
                const color = getCellColor(chambre.id, date);
                
                return (
                  <Box
                    key={`${chambre.id}-${date.toISOString()}`}
                    onClick={() => available && handleCellClick(chambre.id, date)}
                    sx={{
                      height: 32,
                      bgcolor: color,
                      border: '1px solid',
                      borderColor: 'divider',
                      cursor: available ? 'pointer' : 'not-allowed',
                      opacity: available ? 1 : 0.5,
                      '&:hover': available ? { opacity: 0.8 } : {}
                    }}
                  />
                );
              })}
            </Fragment>
          ))}
        </Box>
      </Box>

      <Stack direction="row" spacing={1} sx={{ fontSize: '0.75rem' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: '#FFFFFF', border: '1px solid #ccc' }} />
          <Typography variant="caption">Disponible</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: '#66BB6A' }} />
          <Typography variant="caption">Sélectionné</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: '#EF5350' }} />
          <Typography variant="caption">Occupé</Typography>
        </Box>
      </Stack>

      {(selectedDates.start && form.chambreId) && (
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'primary.50' }}>
          <Typography variant="body2" fontWeight={700}>Résumé de la réservation</Typography>
          <Typography variant="caption">
            Chambre: {(rooms || []).find(c => c.id === form.chambreId)?.numero}
          </Typography>
          <br />
          <Typography variant="caption">
            {selectedDates.end
              ? `Du ${format(selectedDates.start, 'dd MMM yyyy', { locale: fr })} au ${format(selectedDates.end, 'dd MMM yyyy', { locale: fr })}`
              : `Séjour d’un jour le ${format(selectedDates.start, 'dd MMM yyyy', { locale: fr })}`}
          </Typography>
        </Paper>
      )}

      <TextField
        size="small"
        type="number"
        label="Nombre de personnes"
        value={form.nbPersonnes}
        onChange={(e) => setForm({ ...form, nbPersonnes: parseInt(e.target.value || '1', 10) })}
        inputProps={{ min: 1 }}
      />

      <Select
        size="small"
        value={form.statut}
        onChange={(e) => setForm({ ...form, statut: e.target.value as any })}
      >
        <MenuItem value="en_attente">En attente</MenuItem>
        <MenuItem value="confirmee">Confirmée</MenuItem>
      </Select>

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button onClick={onClose}>Annuler</Button>
        <Button 
          variant="contained" 
          onClick={handleCreate}
          disabled={!isValid}
        >
          Créer
        </Button>
      </Stack>
    </Stack>
  );
}

function EditReservation({ r, reservations, rooms, maintenance, onSave, onClose }: { r: Reservation; reservations: Reservation[]; rooms: Chambre[]; maintenance: ChambreMaintenance[]; onSave: (p: Partial<Reservation> & { id: string }) => void; onClose: ()=>void }) {
  const { data: clients } = useClients();
  const { data: factures } = useFactures();
  const [form, setForm] = useState({
    clientId: r.clientId || '',
    chambreId: r.chambreId || '',
    statut: r.statut,
  });

  const initialStart = new Date(r.dateDebut);
  const initialEnd = r.dateFin ? new Date(r.dateFin) : null;
  const [selectedDates, setSelectedDates] = useState<{ start: Date | null; end: Date | null }>({
    start: initialStart,
    end: initialEnd,
  });
  const [modalDateRef, setModalDateRef] = useState<Date>(initialStart);

  const weekStart = startOfWeek(modalDateRef, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 13) });

  function isRoomAvailable(chambreId: string, date: Date) {
    const nextDay = addDays(date, 1);
    const inMaint = maintenance.some(m => m.chambreId === chambreId && new Date(m.start) < nextDay && new Date(m.end) > date);
    if (inMaint) return false;
    const hasConflict = reservations.some(rr => {
      if (rr.id === r.id) return false;
      if (rr.type !== 'hebergement' || rr.chambreId !== chambreId) return false;
      if (rr.statut === 'annulee') return false;
      const resDebut = new Date(rr.dateDebut);
      const resFinBase = new Date(rr.dateFin || rr.dateDebut);
      const resFin = addDays(resFinBase, 1);
      return resDebut < nextDay && resFin > date;
    });
    const chambre = rooms.find(c => c.id === chambreId);
    if (chambre?.statut === 'maintenance') return false;
    return !hasConflict;
  }

  function handleCellClick(chambreId: string, date: Date) {
    if (!isRoomAvailable(chambreId, date)) return;
    if (!form.chambreId || form.chambreId !== chambreId) {
      setSelectedDates({ start: date, end: null });
      setForm({ ...form, chambreId });
      return;
    }

    if (selectedDates.start && selectedDates.end) {
      if (date >= selectedDates.start) {
        setSelectedDates({ start: selectedDates.start, end: date });
      } else {
        setSelectedDates({ start: date, end: null });
      }
      return;
    }

    if (!selectedDates.start) {
      setSelectedDates({ start: date, end: null });
      return;
    }

    if (date.getTime() === selectedDates.start.getTime()) {
      // Toggle: reclique sur la même date => aucune sélection
      setSelectedDates({ start: null, end: null });
      setForm({ ...form, chambreId: '' });
      return;
    } else if (date > selectedDates.start) {
      setSelectedDates({ start: selectedDates.start, end: date });
    } else if (date < selectedDates.start) {
      setSelectedDates({ start: date, end: null });
    }
  }

  function getCellColor(chambreId: string, date: Date) {
    const chambre = rooms.find(c => c.id === chambreId);
    if (chambre?.statut === 'maintenance') return '#9E9E9E';
    if (!isRoomAvailable(chambreId, date)) return '#EF5350';

    if (selectedDates.start && selectedDates.end && chambreId === form.chambreId) {
      if (date >= selectedDates.start && date <= selectedDates.end) return '#66BB6A';
    } else if (selectedDates.start && !selectedDates.end && chambreId === form.chambreId) {
      if (date.getTime() === selectedDates.start.getTime()) return '#66BB6A';
    }
    return '#FFFFFF';
  }

  const isValid = form.chambreId && selectedDates.start;

  function handleSave() {
    // Si aucune date sélectionnée, annuler la réservation
    if (!selectedDates.start) {
      onSave({ id: r.id, statut: 'annulee' });
      onClose();
      return;
    }
    if (!isValid) return;
    onSave({
      id: r.id,
      clientId: form.clientId,
      chambreId: form.chambreId,
      dateDebut: selectedDates.start!.toISOString(),
      dateFin: (selectedDates.end ? selectedDates.end : addDays(selectedDates.start!, 1)).toISOString(),
      statut: form.statut,
    });
  }

  const linkedInvoice = (factures || []).find(f => f.reservationId === r.id && f.source === 'Hebergement');

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <Typography variant="body2" fontWeight={700}>Client</Typography>
      {/* Uniformiser l’affichage avec Autocomplete */}
      <Autocomplete
        size="small"
        options={(clients || []).map(c => ({ id: c.id, label: c.nom }))}
        value={(clients || []).map(c => ({ id: c.id, label: c.nom })).find(o => o.id === form.clientId) || null}
        onChange={(_, v) => setForm({ ...form, clientId: v?.id || '' })}
        renderInput={(params) => <TextField {...params} label="Client" />}
      />

      <Select size="small" value={form.statut} onChange={(e)=> setForm({ ...form, statut: e.target.value as any })}>
        <MenuItem value="en_attente">En attente</MenuItem>
        <MenuItem value="confirmee">Confirmée</MenuItem>
        <MenuItem value="arrivee">Occupée</MenuItem>
        <MenuItem value="terminee">Terminée</MenuItem>
        <MenuItem value="annulee">Annulée</MenuItem>
      </Select>

      <Divider />
      <Typography variant="body2" fontWeight={700}>Sélectionnez les dates et la chambre (calendrier)</Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip size="small" label={`Semaine du ${format(weekStart, 'dd MMM yyyy', { locale: fr })}`} />
        <Chip size="small" label="◀" onClick={() => setModalDateRef(d => addDays(d, -7))} />
        <Chip size="small" label="▶" onClick={() => setModalDateRef(d => addDays(d, 7))} />
      </Stack>

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, maxHeight: 300, overflowY: 'auto', overflowX: 'auto' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: `80px repeat(${weekDays.length}, minmax(90px, 1fr))`, gap: 0.5, minWidth: 'max-content' }}>
          <Box />
          {weekDays.map((d) => (
            <Box key={d.toISOString()} sx={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, py: 0.5 }}>
              {format(d, 'EEE d', { locale: fr })}
            </Box>
          ))}

          {(rooms || []).map((chambre) => (
            <Fragment key={chambre.id}>
              <Box sx={{ py: 0.5, fontSize: '0.75rem', fontWeight: 700 }}>
                {chambre.numero}
              </Box>
              {weekDays.map((date) => {
                const available = isRoomAvailable(chambre.id, date);
                const color = getCellColor(chambre.id, date);
                return (
                  <Box
                    key={`${chambre.id}-${date.toISOString()}`}
                    onClick={() => available && handleCellClick(chambre.id, date)}
                    sx={{
                      height: 32,
                      bgcolor: color,
                      border: '1px solid',
                      borderColor: 'divider',
                      cursor: available ? 'pointer' : 'not-allowed',
                      opacity: available ? 1 : 0.5,
                      '&:hover': available ? { opacity: 0.8 } : {}
                    }}
                  />
                );
              })}
            </Fragment>
          ))}
        </Box>
      </Box>

      {(selectedDates.start && form.chambreId) && (
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'primary.50' }}>
          <Typography variant="body2" fontWeight={700}>Résumé</Typography>
          <Typography variant="caption">
            Chambre: {(rooms || []).find(c => c.id === form.chambreId)?.numero}
          </Typography>
          <br />
          <Typography variant="caption">
            {selectedDates.end
              ? `Du ${format(selectedDates.start, 'dd MMM yyyy', { locale: fr })} au ${format(selectedDates.end, 'dd MMM yyyy', { locale: fr })}`
              : `Séjour d’un jour le ${format(selectedDates.start, 'dd MMM yyyy', { locale: fr })}`}
          </Typography>
        </Paper>
      )}

      {!selectedDates.start && (
        <Typography variant="caption" color="text.secondary">
          Aucune date sélectionnée : en validant, la réservation sera annulée.
        </Typography>
      )}

      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
        <Button color="error" variant="outlined" onClick={() => { onSave({ id: r.id, statut: 'annulee' }); onClose(); }}>
          Annuler la réservation
        </Button>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={onClose}>Annuler modification</Button>
          <Button variant="contained" onClick={handleSave} disabled={!isValid}>Valider</Button>
        </Stack>
      </Stack>

      <Divider />
      <Typography fontWeight={700}>Facture liée</Typography>
      {!linkedInvoice && (
        <Typography variant="caption" color="text.secondary">Aucune facture liée</Typography>
      )}
      {linkedInvoice && (
        <Stack spacing={1}>
          <Typography variant="caption">Numéro: {linkedInvoice.numero}</Typography>
          <Typography variant="caption">Échéance: {linkedInvoice.dueDate ? new Date(linkedInvoice.dueDate).toLocaleDateString() : '—'}</Typography>
          {linkedInvoice.lignes.map((l, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="center">
              <Typography sx={{ minWidth: 160 }}>{l.description}</Typography>
              <Typography>× {l.qte}</Typography>
              <Typography><Ariary value={l.pu} /></Typography>
              <Typography>= <Ariary value={l.qte * l.pu} /></Typography>
            </Stack>
          ))}
          <Typography><b>Total:</b> <Ariary value={linkedInvoice.totalTTC} /></Typography>
          <Button size="small" variant="outlined" onClick={() => (window.location.href = `/financier?factureId=${linkedInvoice.id}`)}>Ouvrir la facture</Button>
        </Stack>
      )}
    </Stack>
  );
}
