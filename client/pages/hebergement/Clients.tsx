import {
  Avatar,
  Box,
  Button,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from "@mui/material";
import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  useClients,
  useCreateClient,
  useUpdateClient,
  useHebergementReservations,
  useChambres,
} from "@/services/api";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";

export default function HebergementClients() {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const { data: clientsData } = useClients();
  const updateClient = useUpdateClient();
  const createClient = useCreateClient();
  const { data: reservationsData } = useHebergementReservations();
  const { data: chambres } = useChambres();
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState<"all" | "hebergement">("all");
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    nom: "",
    telephone: "",
    email: "",
    agenceVoyage: "",
    origine: "",
    type: "Particulier",
  });

  const hebergementClientIds = useMemo(() => {
    const ids = new Set<string>();
    (reservationsData || [])
      .filter((r) => r.type === "hebergement")
      .forEach((r) => ids.add(r.clientId));
    return ids;
  }, [reservationsData]);

  const list = useMemo(() => {
    return (clientsData || [])
      .filter((c) => (filterType === "hebergement" ? hebergementClientIds.has(c.id) : true))
      .filter(
        (c) =>
          c.nom.toLowerCase().includes(q.toLowerCase()) ||
          (c.telephone && c.telephone.includes(q)) ||
          (c.agenceVoyage && c.agenceVoyage.toLowerCase().includes(q.toLowerCase()))
      );
  }, [q, clientsData, filterType, hebergementClientIds]);

  const [selectedId, setSelectedId] = useState(list[0]?.id || "");

  // Met à jour la sélection si la liste change et que selectedId n'est plus valide
  useEffect(() => {
    if (list.length > 0 && !list.some((c) => c.id === selectedId)) {
      setSelectedId(list[0].id);
    }
  }, [list, selectedId]);

  const selected = list.find((c) => c.id === selectedId) || null;
  const history = useMemo(
    () => (reservationsData || []).filter((r) => r.clientId === selectedId),
    [selectedId, reservationsData]
  );

  // Form state pour l'édition dynamique
  const [formData, setFormData] = useState({
    nom: "",
    type: "",
    email: "",
    telephone: "",
    adresse: "",
    pays: "Madagascar",
    tags: "",
    reference: "",
    agenceVoyage: "",
    origine: "",
    notes: "",
  });

  // Mettre à jour le formulaire quand le client sélectionné change
  useEffect(() => {
    if (selected) {
      setFormData({
        nom: selected.nom || "",
        type: selected.type || "",
        email: selected.email || "",
        telephone: selected.telephone || "",
        adresse: selected.adresse || "",
        pays: selected.pays || "Madagascar",
        tags: selected.tags || "",
        reference: selected.reference || "",
        agenceVoyage: selected.agenceVoyage || "",
        origine: selected.origine || "",
        notes: (selected as any).notes || "",
      });
    }
  }, [selected]);

  const isDirty = useMemo(() => {
    if (!selected) return false;
    const base = {
      nom: selected.nom || "",
      type: selected.type || "",
      email: selected.email || "",
      telephone: selected.telephone || "",
      adresse: selected.adresse || "",
      pays: selected.pays || "Madagascar",
      tags: selected.tags || "",
      reference: selected.reference || "",
      agenceVoyage: selected.agenceVoyage || "",
      origine: selected.origine || "",
      notes: (selected as any).notes || "",
    };
    return JSON.stringify(formData) !== JSON.stringify(base);
  }, [formData, selected]);

  async function handleCreateNewClient() {
    if (!newClientForm.nom.trim()) return;
    try {
      const created = await createClient.mutateAsync({
        nom: newClientForm.nom.trim(),
        telephone: newClientForm.telephone.trim() || undefined,
        email: newClientForm.email.trim() || undefined,
        agenceVoyage: newClientForm.agenceVoyage.trim() || undefined,
        origine: newClientForm.origine.trim() || undefined,
        type: newClientForm.type || "Particulier",
      });
      setNewClientModalOpen(false);
      setNewClientForm({
        nom: "",
        telephone: "",
        email: "",
        agenceVoyage: "",
        origine: "",
        type: "Particulier",
      });
      if (created?.id) {
        setSelectedId(created.id);
      }
    } catch (e) {
      console.error("Erreur création client:", e);
    }
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4" fontWeight={800}>
          Hébergement — Clients
        </Typography>
        <Button variant="contained" onClick={() => setNewClientModalOpen(true)}>
          + Nouveau client
        </Button>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "340px 1fr" }, gap: 2 }}>
        <Paper sx={{ p: 2, display: "flex", flexDirection: "column", height: "calc(100vh - 180px)", minHeight: 500 }}>
          <TextField
            size="small"
            placeholder="Rechercher par nom, tél, agence..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            fullWidth
            sx={{ mb: 1.5 }}
          />

          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
            <Chip
              size="small"
              label={`Tous (${clientsData?.length || 0})`}
              color={filterType === "all" ? "primary" : "default"}
              variant={filterType === "all" ? "filled" : "outlined"}
              onClick={() => setFilterType("all")}
            />
            <Chip
              size="small"
              label={`Avec séjour (${hebergementClientIds.size})`}
              color={filterType === "hebergement" ? "primary" : "default"}
              variant={filterType === "hebergement" ? "filled" : "outlined"}
              onClick={() => setFilterType("hebergement")}
            />
          </Stack>

          <List dense sx={{ flex: 1, overflowY: "auto", pr: 0.5 }}>
            {list.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
                Aucun client trouvé
              </Typography>
            )}
            {list.map((c) => {
              const hist = (reservationsData || []).filter((r) => r.clientId === c.id);
              const last = hist[hist.length - 1];
              return (
                <ListItemButton
                  key={c.id}
                  selected={c.id === selectedId}
                  onClick={() => setSelectedId(c.id)}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    border: "1px solid",
                    borderColor: c.id === selectedId ? "primary.main" : "divider",
                  }}
                >
                  <Avatar sx={{ width: 28, height: 28, mr: 1, fontSize: "0.8rem", bgcolor: c.id === selectedId ? "primary.main" : "grey.400" }}>
                    {c.nom ? c.nom[0].toUpperCase() : "?"}
                  </Avatar>
                  <ListItemText
                    primary={c.nom}
                    secondary={
                      <Stack component="span" spacing={0.2}>
                        {c.telephone && (
                          <Typography component="span" variant="caption" color="text.secondary" display="block">
                            📞 {c.telephone}
                          </Typography>
                        )}
                        {c.agenceVoyage && (
                          <Typography component="span" variant="caption" color="primary.main" display="block">
                            ✈️ {c.agenceVoyage}
                          </Typography>
                        )}
                        <Typography component="span" variant="caption" color="text.secondary" display="block">
                          Dernier séjour: {last ? format(new Date(last.dateDebut), "dd MMM yyyy", { locale: fr }) : "—"}
                        </Typography>
                      </Stack>
                    }
                    primaryTypographyProps={{ variant: "body2", fontWeight: 700 }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Paper>

        <Paper sx={{ p: 2, overflowY: "auto", height: "calc(100vh - 180px)", minHeight: 500 }}>
          {!selected && (
            <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
              Sélectionnez un client dans la liste de gauche ou créez-en un nouveau.
            </Typography>
          )}
          {selected && (
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Box>
                  <Typography variant="h5" fontWeight={800}>
                    {selected.nom}
                  </Typography>
                  {selected.agenceVoyage && (
                    <Chip size="small" label={`Partenaire: ${selected.agenceVoyage}`} color="primary" variant="outlined" sx={{ mt: 0.5 }} />
                  )}
                </Box>
                <Stack direction="row" spacing={1}>
                  {(() => {
                    const email = (formData?.email || "").trim();
                    const isValid = /.+@.+\..+/.test(email);
                    return (
                      <Button
                        variant="outlined"
                        component={isValid ? "a" : undefined}
                        href={isValid ? `mailto:${email}` : undefined}
                        disabled={!isValid}
                      >
                        E-mail
                      </Button>
                    );
                  })()}
                  <Button
                    variant="contained"
                    onClick={() => {
                      if (selectedId) {
                        navigate(
                          `/${tenantId}/hebergement/gestion?newReservation=1&clientId=${encodeURIComponent(selectedId)}`
                        );
                      } else {
                        navigate(`/${tenantId}/hebergement/gestion?newReservation=1`);
                      }
                    }}
                  >
                    Nouvelle réservation
                  </Button>
                </Stack>
              </Stack>

              <Divider />

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    size="small"
                    label="Nom complet"
                    fullWidth
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    size="small"
                    label="Type"
                    fullWidth
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    placeholder="Particulier, Entreprise, VIP..."
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    size="small"
                    label="Téléphone"
                    fullWidth
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    placeholder="034 00 000 00"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    size="small"
                    label="E-mail"
                    fullWidth
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="client@email.com"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    size="small"
                    label="Agence de voyage (si partenaire)"
                    fullWidth
                    placeholder="Ex: Madagascar Travel, Lemur Tours, Booking..."
                    value={formData.agenceVoyage}
                    onChange={(e) => setFormData({ ...formData, agenceVoyage: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    size="small"
                    label="Origine (Canal de réservation)"
                    fullWidth
                    placeholder="Site web, Téléphone direct, Recommandation..."
                    value={formData.origine}
                    onChange={(e) => setFormData({ ...formData, origine: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={8}>
                  <TextField
                    size="small"
                    label="Adresse"
                    fullWidth
                    value={formData.adresse}
                    onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    size="small"
                    label="Pays"
                    fullWidth
                    value={formData.pays}
                    onChange={(e) => setFormData({ ...formData, pays: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    size="small"
                    label="Tags"
                    fullWidth
                    placeholder="VIP, Direct, Habitué"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    size="small"
                    label="Référence"
                    fullWidth
                    placeholder="CLI-00000"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  />
                </Grid>
              </Grid>

              <TextField
                size="small"
                label="Préférences / Notes internes"
                fullWidth
                multiline
                minRows={2}
                placeholder="Exemples: Préfère chambre calme, étage élevé, arrivée tardive..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />

              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="contained"
                  disabled={!isDirty || updateClient.isPending}
                  onClick={() => {
                    if (selectedId) {
                      updateClient.mutate({ id: selectedId, ...formData });
                    }
                  }}
                >
                  {updateClient.isPending ? "Sauvegarde..." : isDirty ? "Enregistrer les modifications" : "À jour"}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate(`/${tenantId}/financier?clientId=${encodeURIComponent(selectedId)}`)}
                >
                  Voir les factures
                </Button>
              </Stack>

              <Divider />

              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography fontWeight={700}>Historique des réservations</Typography>
                  <Chip
                    size="small"
                    label={`${history.length} séjour${history.length > 1 ? "s" : ""}`}
                    color="primary"
                    variant="outlined"
                  />
                </Stack>
                {history.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Aucune réservation enregistrée pour ce client.
                  </Typography>
                )}
                {history.length > 0 && (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "100px 1.2fr 130px 130px 110px",
                      py: 0.8,
                      px: 1,
                      fontWeight: 700,
                      fontSize: "0.75rem",
                      color: "text.secondary",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Box>Type</Box>
                    <Box>Détails</Box>
                    <Box>Arrivée</Box>
                    <Box>Départ</Box>
                    <Box>Statut</Box>
                  </Box>
                )}
                {history.map((h) => (
                  <Box
                    key={h.id}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "100px 1.2fr 130px 130px 110px",
                      py: 1,
                      px: 1,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      alignItems: "center",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <Box>
                      <Chip size="small" label={h.type} variant="outlined" />
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {h.type === "hebergement"
                          ? (() => {
                              const ids =
                                h.chambreIds && h.chambreIds.length > 0
                                  ? h.chambreIds
                                  : h.chambreId
                                    ? [h.chambreId]
                                    : [];
                              const matching = (chambres || []).filter((c) => ids.includes(c.id));
                              return matching.length > 0
                                ? matching.map((c) => `Ch. ${c.numero}`).join(", ")
                                : ids.length > 0
                                  ? `Ch. ${ids.join(", ")}`
                                  : "Hébergement";
                            })()
                          : h.type === "restaurant"
                            ? `Table ${h.tableId}`
                            : "Autre"}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2">{format(new Date(h.dateDebut), "dd/MM/yyyy", { locale: fr })}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2">
                        {h.dateFin ? format(new Date(h.dateFin), "dd/MM/yyyy", { locale: fr }) : "-"}
                      </Typography>
                    </Box>
                    <Box>
                      <Chip
                        size="small"
                        label={h.statut}
                        color={h.statut === "terminee" ? "success" : h.statut === "arrivee" ? "primary" : "default"}
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </Stack>
          )}
        </Paper>
      </Box>

      {/* Modal Création Client Rapide */}
      <Dialog open={newClientModalOpen} onClose={() => setNewClientModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>Ajouter un nouveau client</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Nom complet *"
              fullWidth
              value={newClientForm.nom}
              onChange={(e) => setNewClientForm({ ...newClientForm, nom: e.target.value })}
              autoFocus
            />
            <TextField
              size="small"
              label="Numéro de téléphone"
              fullWidth
              value={newClientForm.telephone}
              onChange={(e) => setNewClientForm({ ...newClientForm, telephone: e.target.value })}
              placeholder="034 00 000 00"
            />
            <TextField
              size="small"
              label="E-mail"
              fullWidth
              value={newClientForm.email}
              onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
            />
            <TextField
              size="small"
              label="Agence de voyage (si partenaire)"
              fullWidth
              value={newClientForm.agenceVoyage}
              onChange={(e) => setNewClientForm({ ...newClientForm, agenceVoyage: e.target.value })}
              placeholder="Ex: Booking, Agence A..."
            />
            <TextField
              size="small"
              label="Origine (Canal)"
              fullWidth
              value={newClientForm.origine}
              onChange={(e) => setNewClientForm({ ...newClientForm, origine: e.target.value })}
              placeholder="Site web, Téléphone..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewClientModalOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={!newClientForm.nom.trim() || createClient.isPending}
            onClick={handleCreateNewClient}
          >
            {createClient.isPending ? "Création..." : "Créer le client"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
