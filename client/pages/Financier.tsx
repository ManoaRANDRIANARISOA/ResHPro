import { Add } from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
  Select,
  MenuItem,
} from "@mui/material";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useCreateFacture, useFactures, useClients, useUpdateFactureStatut, useUpdateFacture } from "@/services/api";
import { Facture } from "@shared/api";
import { exportToCSV, exportToPDF } from "@/lib/export";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  LineChart,
  Line,
  TooltipProps,
} from "recharts";
import {
  useHebergementReservations,
  useRestoReservations,
} from "@/services/api";
import { chambres as chambresData } from "@/services/mock";
import {
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  subDays,
  format,
} from "date-fns";
import { fr } from "date-fns/locale";

// Custom tooltip pour afficher les données en français
function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    return (
      <Box sx={{ bgcolor: 'background.paper', p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="body2" fontWeight={700}>{label}</Typography>
        {payload.map((entry, index) => (
          <Typography key={index} variant="body2" sx={{ color: entry.color }}>
            {entry.name === 'taux' && `Taux: ${entry.value}%`}
            {entry.name === 'reservations' && `Réservations: ${entry.value}`}
            {entry.name === 'revenus' && `Revenus: ${Number(entry.value).toLocaleString()} Ar`}
          </Typography>
        ))}
      </Box>
    );
  }
  return null;
}

function statutChip(f: Facture) {
  if (f.statut === "payee") return <Chip size="small" color="success" label="Payée" />;
  if (f.statut === "annulee") return <Chip size="small" color="default" label="Annulée" />;
  const now = new Date();
  const overdue = !!f.dueDate && now > new Date(f.dueDate);
  if (overdue) return <Chip size="small" color="error" label="En retard" />;
  return <Chip size="small" color="warning" label="Envoyée" />;
}

export default function Financier() {
  const { data: factures } = useFactures();
  const { data: clients } = useClients();
  const { data: restoAll } = useRestoReservations();
  const { data: hebergementAll } = useHebergementReservations();
  const create = useCreateFacture();
  const updateStatut = useUpdateFactureStatut();
  const updateFacture = useUpdateFacture();
  const [searchParams] = useSearchParams();

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "emise" | "payee" | "annulee" | "retard">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "Hebergement" | "Restaurant" | "Evenement">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const clientIdParam = searchParams.get("clientId");
  const list = useMemo(() => {
    let base = (factures || []).filter(
      (f) =>
        f.clientNom.toLowerCase().includes(q.toLowerCase()) ||
        f.numero.toLowerCase().includes(q.toLowerCase()),
    );
    if (clientIdParam) {
      const client = (clients || []).find((c) => c.id === clientIdParam);
      if (client) base = base.filter((f) => f.clientNom === client.nom);
    }
    if (sourceFilter !== "all") base = base.filter((f) => f.source === sourceFilter);
    if (statusFilter !== "all") {
      base = base.filter((f) => {
        const now = new Date();
        const due = f.dueDate ? new Date(f.dueDate) : null;
        if (statusFilter === "retard") return f.statut === "emise" && !!due && now > due;
        if (statusFilter === "emise") return f.statut === "emise" && (!due || now <= due);
        return f.statut === statusFilter;
      });
    }
    return base;
  }, [factures, q, clientIdParam, clients, statusFilter, sourceFilter]);

  const selected = list.find((f) => f.id === selectedId) || list[0] || null;
  const [selectedStatut, setSelectedStatut] = useState<Facture["statut"]>(selected?.statut || "emise");
  const [selectedNumero, setSelectedNumero] = useState<string>(selected?.numero || "");

  useEffect(() => {
    const fromParam = searchParams.get("factureId");
    if (fromParam) {
      setSelectedId(fromParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selected) setSelectedStatut(selected.statut);
    if (selected) setSelectedNumero(selected.numero);
  }, [selected?.id]);

  const [draft, setDraft] = useState({
    clientNom: "",
    source: "Hebergement" as Facture["source"],
    description: "Nuitée",
    qte: 1,
    pu: 100000,
  });

  function createNow() {
    if (!draft.clientNom) return;
    create.mutate({
      clientNom: draft.clientNom,
      date: new Date().toISOString(),
      source: draft.source,
      lignes: [
        { description: draft.description, qte: draft.qte, pu: draft.pu },
      ],
      statut: "emise",
    }, {
      onSuccess: (f) => {
        setSelectedId(f.id);
        setShowNew(false);
        setDraft({
          clientNom: "",
          source: "Hebergement",
          description: "Nuitée",
          qte: 1,
          pu: 100000,
        });
      }
    });
  }

  const ttc30 = (factures || []).reduce((s, f) => s + f.totalTTC, 0);
  const payees = (factures || [])
    .filter((f) => f.statut === "payee")
    .reduce((s, f) => s + f.totalTTC, 0);
  const enRetard = (factures || [])
    .filter((f) => {
      const now = new Date();
      return f.statut === "emise" && !!f.dueDate && now > new Date(f.dueDate);
    })
    .reduce((s, f) => s + f.totalTTC, 0);

  // Rapports dynamiques
  const restoResa = useMemo(() => {
    const now = new Date();
    const days = eachDayOfInterval({ start: subDays(now, 6), end: now });
    return days.map((d) => {
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const count = (restoAll || []).filter((r) => {
        const rd = new Date(r.dateDebut);
        rd.setHours(0, 0, 0, 0);
        return r.statut !== "annulee" && rd.getTime() === dayStart.getTime();
      }).length;
      const name = format(d, "EEEEE", { locale: fr }).toUpperCase();
      return { name, reservations: count };
    });
  }, [restoAll]);

  const occData = useMemo(() => {
    const now = new Date();
    const mStart = startOfMonth(now);
    const mEnd = endOfMonth(now);
    const totalDays = eachDayOfInterval({ start: mStart, end: mEnd }).length;
    const firstFourRooms = chambresData.slice(0, 4);
    const counts: Record<string, number> = Object.fromEntries(
      firstFourRooms.map((ch) => [ch.id, 0]),
    );
    (hebergementAll || [])
      .filter((r) => r.statut !== "annulee" && r.statut !== "no_show")
      .forEach((r) => {
        if (!r.chambreId || !(r.chambreId in counts)) return;
        const s = new Date(r.dateDebut);
        const e = new Date(r.dateFin ?? r.dateDebut);
        const start = s < mStart ? mStart : s;
        const end = e > mEnd ? mEnd : e;
        const days = eachDayOfInterval({ start, end });
        counts[r.chambreId] = (counts[r.chambreId] || 0) + days.length;
      });
    return firstFourRooms.map((ch) => ({
      name: ch.numero,
      taux: totalDays ? Math.round(((counts[ch.id] || 0) / totalDays) * 100) : 0,
    }));
  }, [hebergementAll]);

  const ca = useMemo(() => {
    const sum = (src: Facture["source"]) =>
      (factures || [])
        .filter((f) => f.source === src && f.statut === "payee")
        .reduce((s, f) => s + f.totalTTC, 0);
    return [
      { name: "Hébergement", revenus: sum("Hebergement") },
      { name: "Restaurant", revenus: sum("Restaurant") },
      { name: "Événements", revenus: sum("Evenement") },
    ];
  }, [factures]);

  function handleExportFactures() {
    const exportData = (factures || []).map(f => ({
      'Numéro': f.numero,
      'Date': new Date(f.date).toLocaleDateString('fr-FR'),
      'Client': f.clientNom,
      'Source': f.source,
      'Montant (Ar)': f.totalTTC.toLocaleString(),
      'Statut': f.statut === 'payee' ? 'Payée' : f.statut === 'annulee' ? 'Annulée' : 'Envoyée'
    }));
    
    exportToCSV(exportData, 'factures');
  }

  function handleExportPDF() {
    const exportData = (factures || []).map(f => ({
      'Numéro': f.numero,
      'Date': new Date(f.date).toLocaleDateString('fr-FR'),
      'Client': f.clientNom,
      'Source': f.source,
      'Montant': `${f.totalTTC.toLocaleString()} Ar`,
      'Statut': f.statut === 'payee' ? 'Payée' : f.statut === 'annulee' ? 'Annulée' : 'Envoyée'
    }));
    
    exportToPDF('Liste des factures', exportData, 'factures');
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} mb={2}>
        Financier
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
          mb: 2,
        }}
      >
        <Paper sx={{ p: 2 }}>
          <Typography fontWeight={700} mb={1}>
            Filtres
          </Typography>
          <TextField
            size="small"
            placeholder="Rechercher une facture, client, réf..."
            fullWidth
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
            <Chip size="small" label="Tous" onClick={() => setStatusFilter("all")} color={statusFilter === "all" ? "primary" : "default"} variant={statusFilter === "all" ? "filled" : "outlined"} />
            <Chip size="small" label="Envoyée" onClick={() => setStatusFilter("emise")} color={statusFilter === "emise" ? "primary" : "default"} variant={statusFilter === "emise" ? "filled" : "outlined"} />
            <Chip size="small" label="Payée" onClick={() => setStatusFilter("payee")} color={statusFilter === "payee" ? "primary" : "default"} variant={statusFilter === "payee" ? "filled" : "outlined"} />
            <Chip size="small" label="Annulée" onClick={() => setStatusFilter("annulee")} color={statusFilter === "annulee" ? "primary" : "default"} variant={statusFilter === "annulee" ? "filled" : "outlined"} />
            <Chip size="small" label="En retard" onClick={() => setStatusFilter("retard")} color={statusFilter === "retard" ? "primary" : "default"} variant={statusFilter === "retard" ? "filled" : "outlined"} />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
            <Chip size="small" label="Tous (source)" onClick={() => setSourceFilter("all")} color={sourceFilter === "all" ? "primary" : "default"} variant={sourceFilter === "all" ? "filled" : "outlined"} />
            <Chip size="small" label="Hébergement" onClick={() => setSourceFilter("Hebergement")} color={sourceFilter === "Hebergement" ? "primary" : "default"} variant={sourceFilter === "Hebergement" ? "filled" : "outlined"} />
            <Chip size="small" label="Restaurant" onClick={() => setSourceFilter("Restaurant")} color={sourceFilter === "Restaurant" ? "primary" : "default"} variant={sourceFilter === "Restaurant" ? "filled" : "outlined"} />
            <Chip size="small" label="Événements" onClick={() => setSourceFilter("Evenement")} color={sourceFilter === "Evenement" ? "primary" : "default"} variant={sourceFilter === "Evenement" ? "filled" : "outlined"} />
          </Stack>
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography fontWeight={700} mb={1}>
            Actions rapides
          </Typography>
          <Stack spacing={1}>
            <Button
              startIcon={<Add />}
              variant="contained"
              onClick={() => setShowNew(true)}
            >
              Nouvelle facture
            </Button>
            <Button variant="outlined" onClick={handleExportPDF}>Exporter PDF</Button>
            <Button variant="outlined" onClick={handleExportFactures}>Exporter Excel</Button>
          </Stack>
        </Paper>
      </Box>

      <Stack spacing={2}>
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap" }}>
            <Chip label={`Total facturé (30j) ${ttc30.toLocaleString()} Ar`} />
            <Chip label={`Payées ${payees.toLocaleString()} Ar`} color="success" />
            <Chip label={`En retard ${enRetard.toLocaleString()} Ar`} color="error" />
          </Stack>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 160px 160px 140px 120px",
              px: 1,
              py: 1,
              color: "text.secondary",
              fontWeight: 700,
            }}
          >
            <Box>Facture</Box>
            <Box>Date</Box>
            <Box>Échéance</Box>
            <Box>Montant</Box>
            <Box>Statut</Box>
          </Box>
          {list.map((f) => (
              <Box
                key={f.id}
                onClick={() => setSelectedId(f.id)}
                sx={{
                  cursor: "pointer",
                  display: "grid",
                  gridTemplateColumns: "1fr 160px 160px 140px 120px",
                  px: 1,
                  py: 1,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  alignItems: "center",
                  bgcolor: selected?.id === f.id ? "action.hover" : undefined,
                }}
              >
                <Box>
                  <Typography fontWeight={700}>{f.numero}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {f.clientNom} · {f.source}
                  </Typography>
                </Box>
                <Box>{new Date(f.date).toLocaleDateString()}</Box>
                <Box>{f.dueDate ? new Date(f.dueDate).toLocaleDateString() : "—"}</Box>
                <Box>{f.totalTTC.toLocaleString()} Ar</Box>
              <Box>{statutChip(f)}</Box>
              </Box>
          ))}
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography fontWeight={700} mb={1}>
            Détail facture sélectionnée
          </Typography>
          {!selected && (
            <Typography color="text.secondary">Sélectionnez une facture</Typography>
          )}
  {selected && (
    <>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 1 }}>
        <TextField size="small" label="Numéro" value={selectedNumero} onChange={(e) => setSelectedNumero(e.target.value)} onBlur={() => selected && updateFacture.mutate({ id: selected.id, numero: selectedNumero })} />
        <TextField size="small" label="Date" value={new Date(selected.date).toLocaleDateString()} InputProps={{ readOnly: true }} />
        <TextField size="small" label="Client" value={selected.clientNom} InputProps={{ readOnly: true }} />
        <TextField size="small" label="Source" value={selected.source} InputProps={{ readOnly: true }} />
        <Select
          size="small"
          value={selectedStatut}
          onChange={(e) => setSelectedStatut(e.target.value as any)}
        >
          <MenuItem value="emise">Envoyée</MenuItem>
          <MenuItem value="payee">Payée</MenuItem>
          <MenuItem value="annulee">Annulée</MenuItem>
        </Select>
        <TextField
          size="small"
          type="date"
          label="Échéance"
          value={selected?.dueDate ? format(new Date(selected.dueDate), "yyyy-MM-dd") : ""}
          onChange={(e) => selected && updateFacture.mutate({ id: selected.id, dueDate: new Date(e.target.value).toISOString() })}
        />
        <Button
          variant="contained"
          onClick={() => updateStatut.mutate({ id: selected.id, statut: selectedStatut })}
        >
          Mettre à jour
        </Button>
      </Stack>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 80px 100px 120px",
                  px: 1,
                  py: 1,
                  color: "text.secondary",
                  fontWeight: 700,
                }}
              >
                <Box>Article</Box>
                <Box>Qté</Box>
                <Box>Prix</Box>
                <Box>Total</Box>
              </Box>
              {selected.lignes.map((l, i) => (
                <Box
                  key={i}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 80px 100px 120px",
                    px: 1,
                    py: 1,
                    borderTop: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Box>{l.description}</Box>
                  <Box>{l.qte}</Box>
                  <Box>{l.pu.toLocaleString()} Ar</Box>
                  <Box>{(l.qte * l.pu).toLocaleString()} Ar</Box>
                </Box>
              ))}
              <Stack alignItems="flex-end" sx={{ mt: 1 }}>
                <Chip label={`Total ${selected.totalTTC.toLocaleString()} Ar`} color="primary" />
              </Stack>
    </>
  )}
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography fontWeight={700} mb={1}>
            Rapports
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                Réservations resto (7j)
              </Typography>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={restoResa}>
                  <XAxis dataKey="name" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="reservations" stroke="#6E8EF5" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                Taux d'occupation par chambre (%)
              </Typography>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={occData}>
                  <XAxis dataKey="name" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="taux" fill="#81C784" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Revenus par activité (Ariary)
              </Typography>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ca}>
                  <XAxis dataKey="name" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenus" fill="#6E8EF5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Grid>
          </Grid>
        </Paper>
      </Stack>

      {showNew && (
        <Paper
          sx={{
            p: 2,
            position: "fixed",
            right: 16,
            bottom: 16,
            width: { xs: "90%", md: 420 },
            zIndex: 50,
          }}
          elevation={6}
        >
          <Typography fontWeight={700} mb={1}>
            Créer une facture
          </Typography>
          <Stack spacing={1}>
            <TextField
              size="small"
              label="Client"
              value={draft.clientNom}
              onChange={(e) =>
                setDraft((d) => ({ ...d, clientNom: e.target.value }))
              }
            />
            <Select
              size="small"
              value={draft.source}
              onChange={(e) =>
                setDraft((d) => ({ ...d, source: e.target.value as any }))
              }
            >
              <MenuItem value="Hebergement">Hébergement</MenuItem>
              <MenuItem value="Restaurant">Restaurant</MenuItem>
              <MenuItem value="Evenement">Événement</MenuItem>
            </Select>
            <TextField
              size="small"
              label="Article"
              value={draft.description}
              onChange={(e) =>
                setDraft((d) => ({ ...d, description: e.target.value }))
              }
            />
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                type="number"
                label="Qté"
                value={draft.qte}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    qte: parseInt(e.target.value || "0", 10),
                  }))
                }
              />
              <TextField
                size="small"
                type="number"
                label="Prix"
                value={draft.pu}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    pu: parseInt(e.target.value || "0", 10),
                  }))
                }
              />
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button variant="text" onClick={() => setShowNew(false)}>
                Annuler
              </Button>
              <Button variant="contained" onClick={createNow}>
                Enregistrer
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
