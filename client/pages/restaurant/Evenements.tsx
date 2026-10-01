import {
  Box,
  Button,
  Chip,
  Grid,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from "@mui/material";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
} from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useCreateEvenement,
  useEvenements,
  useUpdateEvenement,
  useDeleteEvenement,
  useCreateFacture,
  useFactures,
  useValidateProforma,
} from "@/services/api";
import { Evenement, EvenementSession, isProformaDocument } from "@shared/api";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import WineBarIcon from "@mui/icons-material/WineBar";
import CakeIcon from "@mui/icons-material/Cake";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import FavoriteIcon from "@mui/icons-material/Favorite";
import EventIcon from "@mui/icons-material/Event";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ReceiptIcon from "@mui/icons-material/Receipt";

function typeIcon(t?: Evenement["type"]) {
  switch (t) {
    case "musique":
      return <MusicNoteIcon fontSize="small" />;
    case "degustation":
      return <WineBarIcon fontSize="small" />;
    case "anniversaire":
      return <CakeIcon fontSize="small" />;
    case "conference":
      return <BusinessCenterIcon fontSize="small" />;
    case "mariage":
      return <FavoriteIcon fontSize="small" />;
    default:
      return <EventIcon fontSize="small" />;
  }
}

function statutChip(ev: Evenement) {
  const label = ev.statut === "confirme" ? "Confirmé" : ev.statut === "annule" ? "Annulé" : "Planifié";
  const color: any = ev.statut === "confirme" ? "success" : ev.statut === "annule" ? "default" : "warning";
  return <Chip size="small" label={label} color={color} variant={ev.statut === "annule" ? "outlined" : "filled"} />;
}

function CalendarMonth({
  baseDate,
  events,
  onSelect,
}: {
  baseDate: Date;
  events: Evenement[];
  onSelect: (id: string) => void;
}) {
  function EventPill({ ev, onClick }: { ev: Evenement; onClick: () => void }) {
    const bg = ev.statut === "confirme" ? "success.light" : ev.statut === "annule" ? "grey.300" : "warning.light";
    const fg = ev.statut === "confirme" ? "success.dark" : ev.statut === "annule" ? "text.secondary" : "warning.dark";
    return (
      <Box
        onClick={onClick}
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 0.8,
          px: 1,
          py: 0.6,
          borderRadius: 10,
          bgcolor: bg,
          color: fg,
          width: "100%",
          cursor: "pointer",
          transition: "background-color .2s ease",
          '&:hover': { opacity: 0.95 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', pt: 0.2 }}>{typeIcon(ev.type)}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {ev.nom}
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', opacity: 0.85 }}>{ev.heures}</Typography>
        </Box>
      </Box>
    );
  }
  const start = startOfMonth(baseDate);
  const end = endOfMonth(baseDate);
  const days = eachDayOfInterval({ start, end });

  function eventsFor(d: Date) {
    const key = format(d, "yyyy-MM-dd");
    return events.filter((e) => {
      if (e.sessions && e.sessions.length > 0) {
        return e.sessions.some((s) => s.date === key);
      }
      return e.date === key;
    });
  }

  const weekdays = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, mb: 1 }}>
        {weekdays.map((w, i) => (
          <Typography key={i} variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontWeight: 600 }}>
            {w}
          </Typography>
        ))}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
        {days.map((d) => (
          <Paper key={d.toISOString()} sx={{ p: 1.2, height: 140, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="caption" color="text.secondary">
              {format(d, "d")}
            </Typography>
            <Stack spacing={0.6} sx={{ mt: 0.5, overflowY: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
              {eventsFor(d).map((ev) => (
                <EventPill key={ev.id} ev={ev} onClick={() => onSelect(ev.id)} />
              ))}
            </Stack>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}

export default function RestoEvenements() {
  const { tenantId } = useTenant();
  const { data } = useEvenements();
  const { data: factures } = useFactures();
  const create = useCreateEvenement();
  const update = useUpdateEvenement();
  const deleteEvent = useDeleteEvenement();
  const createFacture = useCreateFacture();
  const validateProforma = useValidateProforma();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(data?.[0]?.id ?? null);
  useEffect(() => {
    if (data && !selectedId) setSelectedId(data[0]?.id ?? null);
  }, [data]);
  const [monthRef, setMonthRef] = useState<Date>(startOfMonth(new Date()));
  const detailsRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  function focusDetails() {
    detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => nameRef.current?.focus(), 120);
  }
  const monthLabel = format(monthRef, "LLLL yyyy");

  // --- Dialog : Nouvel événement (formulaire avant création en DB) ---
  const [newEventDialog, setNewEventDialog] = useState(false);
  const [newEventForm, setNewEventForm] = useState({
    nom: "",
    date: format(new Date(), "yyyy-MM-dd"),
    heures: "19:00–22:00",
    contact: "",
    type: "musique" as NonNullable<Evenement["type"]>,
  });

  // --- Dialog : Confirmation génération facture ---
  const [confirmFactureDialog, setConfirmFactureDialog] = useState<{
    open: boolean;
    typeDoc: "proforma" | "facture" | null;
  }>({ open: false, typeDoc: null });

  // --- Dialog : Confirmation suppression événement ---
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Filters: statut + type
  const [statusFilter, setStatusFilter] = useState<"all" | "planifie" | "confirme" | "annule">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | NonNullable<Evenement["type"]>>("all");

  const inMonth = useMemo(() => {
    const list = data || [];
    const m = format(monthRef, "yyyy-MM");
    return list.filter((e) => {
      if (e.sessions && e.sessions.length > 0) {
        return e.sessions.some((s) => (s.date || "").startsWith(m));
      }
      return (e.date || "").startsWith(m);
    });
  }, [data, monthRef]);

  const filtered = useMemo(() => {
    let list = inMonth;
    if (statusFilter !== "all") list = list.filter((e) => e.statut === statusFilter);
    if (typeFilter !== "all") list = list.filter((e) => e.type === typeFilter);
    return list;
  }, [inMonth, statusFilter, typeFilter]);

  const selected = (data || []).find((e) => e.id === selectedId) || null;

  // Details form state (save only on button)
  const [form, setForm] = useState<Partial<Evenement>>({});
  useEffect(() => {
    if (selected) {
      setForm({
        nom: selected.nom,
        date: selected.date,
        heures: selected.heures,
        nb: selected.nb,
        contact: selected.contact,
        notes: selected.notes,
        statut: selected.statut,
        type: selected.type,
        montantTotal: selected.montantTotal ?? 0,
        sessions: selected.sessions || [],
      });
    }
  }, [selectedId, selected]);

  const linkedInvoice = useMemo(() => {
    return (factures || []).find((f) => f.id === selected?.factureId);
  }, [factures, selected?.factureId]);

  function onSave() {
    if (!selected) return;
    const willBeConfirmed = form.statut === "confirme";
    if (willBeConfirmed) {
      const nom = form.nom ?? selected.nom;
      const date = form.date ?? selected.date;
      const heures = form.heures ?? selected.heures;
      const contact = form.contact ?? selected.contact;
      if (!nom || !date || !heures || !contact) {
        alert("Veuillez remplir Client, Nom, Date et Heures avant confirmation.");
        return;
      }
    }

    const payload: Partial<Evenement> = {
      ...form,
    };
    if (form.sessions && form.sessions.length > 0) {
      payload.date = form.sessions[0].date;
      payload.heures = form.sessions[0].heures;
    }

    update.mutate({ id: selected.id, ...payload } as any, {
      onSuccess: (ev) => {
        if (ev?.date) setMonthRef(startOfMonth(new Date(ev.date)));
        setSelectedId(ev.id);
      },
    });
  }

  function handleGenerateFacture(typeDoc: "proforma" | "facture") {
    if (!selected) return;
    // Vérification : facture définitive uniquement si event confirmé
    if (typeDoc === "facture" && selected.statut !== "confirme") {
      alert("La génération d'une facture définitive nécessite que l'événement soit en statut \"Confirmé\".");
      return;
    }
    // Ouvre le dialog de confirmation avant de générer
    setConfirmFactureDialog({ open: true, typeDoc });
  }

  function handleConfirmGenerateFacture() {
    const typeDoc = confirmFactureDialog.typeDoc;
    if (!selected || !typeDoc) return;
    setConfirmFactureDialog({ open: false, typeDoc: null });

    // Si une proforma existe déjà et que l'utilisateur veut une facture définitive -> conversion en place
    if (typeDoc === "facture" && linkedInvoice && isProformaDocument(linkedInvoice)) {
      validateProforma.mutate(
        { id: linkedInvoice.id },
        {
          onSuccess: () => {
            navigate(`/${tenantId}/financier?factureId=${linkedInvoice.id}`);
          },
        }
      );
      return;
    }

    // Si une facture définitive existe déjà -> naviguer vers elle
    if (linkedInvoice && !isProformaDocument(linkedInvoice)) {
      navigate(`/${tenantId}/financier?factureId=${linkedInvoice.id}`);
      return;
    }

    // Si une proforma existe déjà et que l'utilisateur clique proforma -> naviguer vers elle
    if (typeDoc === "proforma" && linkedInvoice && isProformaDocument(linkedInvoice)) {
      navigate(`/${tenantId}/financier?factureId=${linkedInvoice.id}`);
      return;
    }

    const montant = Number(form.montantTotal ?? selected.montantTotal ?? 0);
    const clientNom = form.contact || selected.contact || "Client";
    const nomEvent = form.nom || selected.nom;
    const sessions = form.sessions && form.sessions.length > 0 ? form.sessions : [];

    const lignes: any[] = [];
    if (sessions.length > 1) {
      lignes.push({
        description: `Événement ${nomEvent} (${sessions.length} séances / dates) - Forfait convenu`,
        qte: 1,
        pu: montant,
      });
      sessions.forEach((s, idx) => {
        lignes.push({
          description: `  · Séance ${idx + 1} : ${s.date} (${s.heures})${s.notes ? ` - ${s.notes}` : ""}`,
          qte: 1,
          pu: 0,
        });
      });
    } else {
      const singleDate = form.date || selected.date;
      const singleHours = form.heures || selected.heures;
      lignes.push({
        description: `Événement ${nomEvent} (${singleDate} ${singleHours}) - Forfait convenu`,
        qte: 1,
        pu: montant,
      });
    }

    createFacture.mutate(
      {
        typeDocument: typeDoc,
        date: new Date().toISOString(),
        clientNom,
        source: "Evenement",
        modePaiement: "especes",
        lignes,
        sousTotal: montant,
        remisePourcentage: 0,
        remiseMontant: 0,
        totalTTC: montant,
      },
      {
        onSuccess: (f) => {
          update.mutate({ id: selected.id, factureId: f.id });
          navigate(`/${tenantId}/financier?factureId=${f.id}`);
        },
      }
    );
  }

  function onDuplicate() {
    if (!selected) return;
    const payload: Omit<Evenement, "id"> = {
      nom: `${selected.nom} (copie)`,
      date: selected.date,
      heures: selected.heures,
      nb: selected.nb,
      contact: selected.contact,
      statut: selected.statut,
      notes: selected.notes,
      type: selected.type,
      montantTotal: selected.montantTotal ?? 0,
      sessions: selected.sessions || [],
    } as Omit<Evenement, "id">;
    create.mutate(payload, { onSuccess: (ev) => { setSelectedId(ev.id); setMonthRef(startOfMonth(new Date(ev.date))); setForm(ev); focusDetails(); } });
  }

  function newEvent() {
    // Ouvre le dialog de création AVANT d'écrire en Firestore
    setNewEventForm({
      nom: "",
      date: format(monthRef, "yyyy-MM-dd"),
      heures: "19:00–22:00",
      contact: "",
      type: "musique",
    });
    setNewEventDialog(true);
  }

  function handleConfirmNewEvent() {
    if (!newEventForm.nom.trim() || !newEventForm.date || !newEventForm.contact.trim()) return;
    create.mutate(
      {
        nom: newEventForm.nom.trim(),
        date: newEventForm.date,
        heures: newEventForm.heures,
        nb: 0,
        contact: newEventForm.contact.trim(),
        statut: "planifie",
        type: newEventForm.type,
        montantTotal: 0,
        sessions: [],
      },
      {
        onSuccess: (ev) => {
          setSelectedId(ev.id);
          setMonthRef(startOfMonth(new Date(ev.date)));
          setForm(ev);
          focusDetails();
          setNewEventDialog(false);
        },
      }
    );
  }

  function exportCsv() {
    const rows = [
      ["Nom", "Date", "Heures", "Capacité", "Statut", "Type", "Contact"],
      ...((data || []).map((e) => [e.nom, e.date, e.heures, String(e.nb), e.statut || "", e.type || "", e.contact])),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "evenements.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDeleteClick() {
    if (!selected) return;
    if (selected.factureId) {
      alert("Cet événement est lié à une facture. Pour des raisons comptables et de traçabilité, il ne peut pas être supprimé directement. Vous pouvez passer son statut en « Annulé ».");
      return;
    }
    setDeleteConfirmOpen(true);
  }

  function handleConfirmDelete() {
    if (!selected) return;
    deleteEvent.mutate(selected.id, {
      onSuccess: () => {
        setDeleteConfirmOpen(false);
        setSelectedId(null);
        setForm({});
      },
    });
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h4" fontWeight={800}>
          Événements
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={exportCsv}>Export calendrier</Button>
          <Button variant="contained" onClick={newEvent}>
            Nouvel événement
          </Button>
        </Stack>
      </Box>

      {/* 1) Filtres + Événements rapides (au-dessus du calendrier) */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography fontWeight={800} mb={1}>
              Filtres
            </Typography>
            <Stack spacing={1.5}>
              <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
                <Typography variant="body2" color="text.secondary">Période</Typography>
                <Chip label="Mois précédent" onClick={() => setMonthRef((d) => addMonths(d, -1))} variant="outlined" />
                <Chip label="Mois suivant" onClick={() => setMonthRef((d) => addMonths(d, 1))} variant="outlined" />
                <Chip label="Ce mois" color="primary" onClick={() => setMonthRef(startOfMonth(new Date()))} />
                <Typography sx={{ ml: 1 }} fontWeight={700}>{monthLabel}</Typography>
              </Stack>
              <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
                <Typography variant="body2" color="text.secondary">Statut</Typography>
                <Chip label="Tous" onClick={() => setStatusFilter("all")} color={statusFilter === "all" ? "primary" : "default"} variant={statusFilter === "all" ? "filled" : "outlined"} />
                <Chip label="Planifié" onClick={() => setStatusFilter("planifie")} color={statusFilter === "planifie" ? "primary" : "default"} variant={statusFilter === "planifie" ? "filled" : "outlined"} />
                <Chip label="Confirmé" onClick={() => setStatusFilter("confirme")} color={statusFilter === "confirme" ? "primary" : "default"} variant={statusFilter === "confirme" ? "filled" : "outlined"} />
                <Chip label="Annulé" onClick={() => setStatusFilter("annule")} color={statusFilter === "annule" ? "primary" : "default"} variant={statusFilter === "annule" ? "filled" : "outlined"} />
              </Stack>
              <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
                <Typography variant="body2" color="text.secondary">Type</Typography>
                <Chip icon={typeIcon()} label="Tous" onClick={() => setTypeFilter("all")} color={typeFilter === "all" ? "primary" : "default"} variant={typeFilter === "all" ? "filled" : "outlined"} />
                <Chip icon={<MusicNoteIcon />} label="Musique" onClick={() => setTypeFilter("musique")} color={typeFilter === "musique" ? "primary" : "default"} variant={typeFilter === "musique" ? "filled" : "outlined"} />
                <Chip icon={<WineBarIcon />} label="Dégustation" onClick={() => setTypeFilter("degustation")} color={typeFilter === "degustation" ? "primary" : "default"} variant={typeFilter === "degustation" ? "filled" : "outlined"} />
                <Chip icon={<CakeIcon />} label="Anniversaire" onClick={() => setTypeFilter("anniversaire")} color={typeFilter === "anniversaire" ? "primary" : "default"} variant={typeFilter === "anniversaire" ? "filled" : "outlined"} />
                <Chip icon={<BusinessCenterIcon />} label="Conférence" onClick={() => setTypeFilter("conference")} color={typeFilter === "conference" ? "primary" : "default"} variant={typeFilter === "conference" ? "filled" : "outlined"} />
                <Chip icon={<FavoriteIcon />} label="Mariage" onClick={() => setTypeFilter("mariage")} color={typeFilter === "mariage" ? "primary" : "default"} variant={typeFilter === "mariage" ? "filled" : "outlined"} />
              </Stack>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography fontWeight={800} mb={1}>
              Événements rapides
            </Typography>
            <List dense>
              {filtered.map((ev) => (
                <ListItemButton key={ev.id} selected={ev.id === selectedId} onClick={() => { setSelectedId(ev.id); focusDetails(); }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>{typeIcon(ev.type)}</ListItemIcon>
                  <ListItemText primary={ev.nom} secondary={`${ev.date} · ${ev.heures} · ${ev.nb} pers`} />
                  {statutChip(ev)}
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>

      {/* 2) Calendrier du mois */}
      <Box sx={{ mb: 2 }}>
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Button size="small" variant="outlined" onClick={() => setMonthRef((d) => addMonths(d, -1))} startIcon={<ChevronLeftIcon />}>Mois</Button>
              <Typography fontWeight={800}>{monthLabel}</Typography>
              <Button size="small" variant="outlined" onClick={() => setMonthRef((d) => addMonths(d, 1))} endIcon={<ChevronRightIcon />}>Mois</Button>
            </Stack>
          </Stack>
          <CalendarMonth baseDate={monthRef} events={filtered} onSelect={(id) => { setSelectedId(id); focusDetails(); }} />
        </Paper>
      </Box>

      {/* 3) Détails en dessous du calendrier */}
      <Paper sx={{ p: 2, minHeight: 400 }} ref={detailsRef}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography fontWeight={800}>Détails de l'événement</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {selected && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDeleteClick}
                size="small"
              >
                Supprimer
              </Button>
            )}
            <Button variant="outlined" onClick={onDuplicate} disabled={!selected} size="small">Dupliquer</Button>
            <Button variant="contained" onClick={onSave} disabled={!selected || !form.nom || !form.date || !form.heures || !form.contact} size="small">Valider</Button>
          </Stack>
        </Stack>

        {!selected && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
            <Typography color="text.secondary">Sélectionnez un événement pour voir les détails</Typography>
          </Box>
        )}
        {selected && (
          <Stack spacing={1.2}>
            <TextField size="small" label="Nom" value={form.nom || ""} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} inputRef={nameRef} required />
            <TextField size="small" label="Date" type="date" value={form.date || ""} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
            <TextField size="small" label="Heures" value={form.heures || ""} onChange={(e) => setForm((f) => ({ ...f, heures: e.target.value }))} required />
            <TextField size="small" type="number" label="Capacité" value={String(form.nb ?? 0)} onChange={(e) => setForm((f) => ({ ...f, nb: parseInt(e.target.value || "0", 10) }))} />
            <TextField
              size="small"
              type="number"
              label="Tarif convenu / Montant total (Ar)"
              value={form.montantTotal ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, montantTotal: parseFloat(e.target.value || "0") }))}
              helperText="Montant convenu avec le client (saisie manuelle de l'établissement)"
            />
            <Stack direction="row" gap={1}>
              <Select size="small" value={form.statut || "planifie"} onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value as any }))}>
                <MenuItem value="planifie">Planifié</MenuItem>
                <MenuItem value="confirme">Confirmé</MenuItem>
                <MenuItem value="annule">Annulé</MenuItem>
              </Select>
              <Select size="small" value={form.type || "autre"} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))}>
                <MenuItem value="musique">Musique</MenuItem>
                <MenuItem value="degustation">Dégustation</MenuItem>
                <MenuItem value="anniversaire">Anniversaire</MenuItem>
                <MenuItem value="conference">Conférence</MenuItem>
                <MenuItem value="mariage">Mariage</MenuItem>
                <MenuItem value="autre">Autre</MenuItem>
              </Select>
            </Stack>
            <TextField size="small" label="Client" value={form.contact || ""} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} required />
            <TextField size="small" label="Notes" value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} multiline minRows={3} />

            {/* Dates & Séances multiples (Multi-jours) */}
            <Box sx={{ mt: 1, p: 1.5, border: "1px solid #e2e8f0", borderRadius: 2, bgcolor: "#f8fafc" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Dates & Séances multiples (Multi-jours)
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    const currentSessions = [...(form.sessions || [])];
                    const newSession: EvenementSession = {
                      id: `sess_${Date.now()}`,
                      date: form.date || format(new Date(), "yyyy-MM-dd"),
                      heures: form.heures || "19:00–22:00",
                      notes: "",
                    };
                    const updated = [...currentSessions, newSession];
                    setForm((f) => ({ ...f, sessions: updated }));
                  }}
                >
                  Ajouter une séance / date
                </Button>
              </Stack>
              {(form.sessions || []).length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  Événement sur date unique ({form.date || "non définie"}). Cliquez sur "Ajouter une séance / date" si l'événement s'étend sur plusieurs jours ou dates distinctes.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {(form.sessions || []).map((sess, idx) => (
                    <Stack key={sess.id || idx} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
                      <Typography variant="caption" fontWeight={700} sx={{ minWidth: 24 }}>
                        #{idx + 1}
                      </Typography>
                      <TextField
                        size="small"
                        type="date"
                        label="Date"
                        value={sess.date || ""}
                        onChange={(e) => {
                          const updated = (form.sessions || []).map((s, i) =>
                            i === idx ? { ...s, date: e.target.value } : s
                          );
                          setForm((f) => ({ ...f, sessions: updated }));
                        }}
                        sx={{ width: 170 }}
                      />
                      <TextField
                        size="small"
                        label="Heures"
                        value={sess.heures || ""}
                        placeholder="ex: 18:00–22:00"
                        onChange={(e) => {
                          const updated = (form.sessions || []).map((s, i) =>
                            i === idx ? { ...s, heures: e.target.value } : s
                          );
                          setForm((f) => ({ ...f, sessions: updated }));
                        }}
                        sx={{ width: 160 }}
                      />
                      <TextField
                        size="small"
                        label="Notes / Détails séance"
                        value={sess.notes || ""}
                        onChange={(e) => {
                          const updated = (form.sessions || []).map((s, i) =>
                            i === idx ? { ...s, notes: e.target.value } : s
                          );
                          setForm((f) => ({ ...f, sessions: updated }));
                        }}
                        sx={{ flex: 1 }}
                      />
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          const updated = (form.sessions || []).filter((_, i) => i !== idx);
                          setForm((f) => ({ ...f, sessions: updated }));
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>

            {/* Facturation & Devis Proforma */}
            <Box sx={{ mt: 1.5, p: 2, border: "1px solid #e0e7ff", borderRadius: 2, bgcolor: "#f5f3ff" }}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" spacing={1}>
                <Box>
                  <Typography variant="subtitle2" fontWeight={800} color="#4338ca">
                    Facturation Événement
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Tarif convenu : <strong>{(form.montantTotal || selected.montantTotal || 0).toLocaleString("fr-FR")} Ar</strong>
                    {selected.factureId && (linkedInvoice ? ` · Facture ${linkedInvoice.numero} (${linkedInvoice.typeDocument || 'facture'}, ${linkedInvoice.statut})` : " · Facture liée")}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {linkedInvoice && !isProformaDocument(linkedInvoice) ? (
                    <Button
                      size="small"
                      variant="contained"
                      sx={{ bgcolor: "#16a34a", "&:hover": { bgcolor: "#15803d" }, fontWeight: 700 }}
                      startIcon={<ReceiptIcon />}
                      onClick={() => navigate(`/${tenantId}/financier?factureId=${linkedInvoice.id}`)}
                    >
                      📄 Ouvrir Facture ({linkedInvoice.numero})
                    </Button>
                  ) : linkedInvoice && isProformaDocument(linkedInvoice) ? (
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ReceiptIcon />}
                        onClick={() => navigate(`/${tenantId}/financier?factureId=${linkedInvoice.id}`)}
                      >
                        📋 Ouvrir Proforma ({linkedInvoice.numero})
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        sx={{ bgcolor: "#16a34a", "&:hover": { bgcolor: "#15803d" }, fontWeight: 800 }}
                        onClick={() => handleGenerateFacture("facture")}
                        disabled={validateProforma.isPending}
                      >
                        ✓ Valider en Facture Définitive
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="small"
                        variant="contained"
                        sx={{ bgcolor: "#f59e0b", "&:hover": { bgcolor: "#d97706" }, color: "#fff", fontWeight: 700 }}
                        onClick={() => handleGenerateFacture("proforma")}
                      >
                        📋 Proforma (Devis)
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        sx={{ bgcolor: "#4f46e5", "&:hover": { bgcolor: "#4338ca" }, fontWeight: 700 }}
                        onClick={() => handleGenerateFacture("facture")}
                      >
                        📄 Facture Définitive
                      </Button>
                    </>
                  )}
                </Stack>
              </Stack>
            </Box>
          </Stack>
        )}
      </Paper>

      {/* ===== Dialog : Création d'événement ===== */}
      <Dialog open={newEventDialog} onClose={() => setNewEventDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={800}>Nouvel événement</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info" sx={{ fontSize: "0.8rem" }}>
              Remplissez les informations essentielles. L'événement sera créé en statut <strong>Planifié</strong> et pourra être complété ensuite.
            </Alert>
            <TextField
              label="Nom de l'événement *"
              size="small"
              fullWidth
              autoFocus
              value={newEventForm.nom}
              onChange={(e) => setNewEventForm((f) => ({ ...f, nom: e.target.value }))}
              placeholder="Ex : Soirée Jazz, Mariage Dupont..."
            />
            <TextField
              label="Date *"
              type="date"
              size="small"
              fullWidth
              value={newEventForm.date}
              onChange={(e) => setNewEventForm((f) => ({ ...f, date: e.target.value }))}
            />
            <TextField
              label="Heures"
              size="small"
              fullWidth
              value={newEventForm.heures}
              onChange={(e) => setNewEventForm((f) => ({ ...f, heures: e.target.value }))}
              placeholder="Ex : 19:00–22:00"
            />
            <TextField
              label="Client / Contact *"
              size="small"
              fullWidth
              value={newEventForm.contact}
              onChange={(e) => setNewEventForm((f) => ({ ...f, contact: e.target.value }))}
              placeholder="Nom du client ou organisateur"
            />
            <Select
              size="small"
              value={newEventForm.type}
              onChange={(e) => setNewEventForm((f) => ({ ...f, type: e.target.value as any }))}
              fullWidth
            >
              <MenuItem value="musique">Musique</MenuItem>
              <MenuItem value="degustation">Dégustation</MenuItem>
              <MenuItem value="anniversaire">Anniversaire</MenuItem>
              <MenuItem value="conference">Conférence</MenuItem>
              <MenuItem value="mariage">Mariage</MenuItem>
              <MenuItem value="autre">Autre</MenuItem>
            </Select>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewEventDialog(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={!newEventForm.nom.trim() || !newEventForm.date || !newEventForm.contact.trim() || create.isPending}
            onClick={handleConfirmNewEvent}
          >
            {create.isPending ? "Création..." : "Créer l'événement"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Dialog : Confirmation génération document ===== */}
      <Dialog open={confirmFactureDialog.open} onClose={() => setConfirmFactureDialog({ open: false, typeDoc: null })} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>
          {confirmFactureDialog.typeDoc === "proforma" ? "📋 Générer un Devis / Proforma" : "📄 Générer la Facture Définitive"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            {confirmFactureDialog.typeDoc === "facture" && (
              <Alert severity="warning" sx={{ fontSize: "0.8rem" }}>
                Une facture définitive est <strong>immuable</strong> une fois émise. Toute correction devra passer par un avoir ou une facture corrective.
              </Alert>
            )}
            {confirmFactureDialog.typeDoc === "proforma" && (
              <Alert severity="info" sx={{ fontSize: "0.8rem" }}>
                Le devis proforma <strong>n'est pas enregistré</strong> dans les rapports financiers. Il peut être annulé ou remplacé par une facture définitive.
              </Alert>
            )}
            <Typography variant="body2">
              Événement : <strong>{selected?.nom}</strong>
            </Typography>
            <Typography variant="body2">
              Client : <strong>{form.contact || selected?.contact}</strong>
            </Typography>
            <Typography variant="body2" color="#166534" fontWeight={700}>
              Montant : {Number(form.montantTotal ?? selected?.montantTotal ?? 0).toLocaleString("fr-FR")} Ar
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmFactureDialog({ open: false, typeDoc: null })}>Annuler</Button>
          <Button
            variant="contained"
            color={confirmFactureDialog.typeDoc === "facture" ? "primary" : "warning"}
            onClick={handleConfirmGenerateFacture}
            disabled={createFacture.isPending}
          >
            {createFacture.isPending ? "Génération..." : "Confirmer"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Dialog : Confirmation suppression événement ===== */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800} color="error.main">
          Supprimer l'événement
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Alert severity="warning" sx={{ fontSize: "0.8rem" }}>
              Cette action est <strong>irréversible</strong>. L'événement sera définitivement supprimé de la base de données.
            </Alert>
            <Typography variant="body2">
              Êtes-vous sûr de vouloir supprimer l'événement <strong>{selected?.nom}</strong> du {selected?.date} ?
            </Typography>
            <Typography variant="caption" color="text.secondary">
              💡 <em>Conseil de gestion</em> : S'il s'agit d'un événement réel annulé par le client, il est préférable pour la traçabilité de passer son statut en <strong>« Annulé »</strong> plutôt que de le supprimer.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Conserver</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleteEvent.isPending}
          >
            {deleteEvent.isPending ? "Suppression..." : "Supprimer définitivement"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
