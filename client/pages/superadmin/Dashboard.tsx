import { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  FormControlLabel,
  Checkbox,
  Stack,
  Card,
  CardContent,
  Chip,
  Alert,
} from "@mui/material";
import { useAllTenants, useProvisionTenant } from "@/services/firestore/superadmin";

export default function SuperAdminDashboard() {
  const { data: tenants, isLoading, refetch } = useAllTenants();
  const provision = useProvisionTenant();

  const [form, setForm] = useState({
    tenantId: "",
    nom: "",
    themePrimary: "#000000",
    themeSecondary: "#333333",
    logoUrl: "",
    invoicePrefix: "INV",
    modules: {
      hebergement: true,
      restaurant: true,
      stock: true,
      fichesTechniques: true,
      analyseEcarts: true,
    }
  });

  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  function handleProvision() {
    if (!form.tenantId || !form.nom) return;
    
    provision.mutate(form, {
      onSuccess: (id) => {
        setCreatedUrl(`${window.location.origin}/${id}/login`);
        refetch();
        setForm({
          ...form,
          tenantId: "",
          nom: "",
          invoicePrefix: "INV"
        });
      }
    });
  }

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: "auto" }}>
      <Typography variant="h3" fontWeight={800} mb={4}>
        Interface Super-Admin
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" fontWeight={700} mb={3}>
              Provisionner un nouveau Locataire (Tenant)
            </Typography>

            <Stack spacing={2}>
              <TextField 
                label="Identifiant URL (ex: kanana)" 
                fullWidth 
                required
                value={form.tenantId}
                onChange={(e) => setForm({ ...form, tenantId: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "") })}
                helperText={`Sera utilisé dans l'URL : /${form.tenantId || "{id}"}/login`}
              />
              <TextField 
                label="Nom de l'établissement" 
                fullWidth 
                required
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
              />
              <Stack direction="row" spacing={2}>
                <TextField 
                  label="NIF de l'établissement" 
                  fullWidth 
                  placeholder="À fournir par le client"
                  value={(form as any).nif || ""}
                  onChange={(e) => setForm({ ...form, nif: e.target.value } as any)}
                />
                <TextField 
                  label="STAT de l'établissement" 
                  fullWidth 
                  placeholder="À fournir par le client"
                  value={(form as any).stat || ""}
                  onChange={(e) => setForm({ ...form, stat: e.target.value } as any)}
                />
              </Stack>
              <TextField 
                label="Adresse de l'établissement" 
                fullWidth 
                value={(form as any).adresse || ""}
                onChange={(e) => setForm({ ...form, adresse: e.target.value } as any)}
              />
              <Stack direction="row" spacing={2}>
                <TextField 
                  label="RIB de l'établissement" 
                  fullWidth 
                  placeholder="RIB"
                  value={(form as any).rib || ""}
                  onChange={(e) => setForm({ ...form, rib: e.target.value } as any)}
                />
                <TextField 
                  label="Numéro MVola" 
                  fullWidth 
                  placeholder="MVola"
                  value={(form as any).mvola || ""}
                  onChange={(e) => setForm({ ...form, mvola: e.target.value } as any)}
                />
              </Stack>
              <TextField 
                label="URL de la signature/cachet" 
                fullWidth 
                placeholder="https://..."
                value={(form as any).cachetSignatureUrl || ""}
                onChange={(e) => setForm({ ...form, cachetSignatureUrl: e.target.value } as any)}
              />
              <TextField 
                label="URL du Logo" 
                fullWidth 
                value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              />
              <TextField 
                label="Préfixe Facture (ex: KAN)" 
                fullWidth 
                value={form.invoicePrefix}
                onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })}
              />
              
              <Stack direction="row" spacing={2}>
                <TextField 
                  label="Couleur Primaire" 
                  type="color"
                  fullWidth 
                  value={form.themePrimary}
                  onChange={(e) => setForm({ ...form, themePrimary: e.target.value })}
                />
                <TextField 
                  label="Couleur Secondaire" 
                  type="color"
                  fullWidth 
                  value={form.themeSecondary}
                  onChange={(e) => setForm({ ...form, themeSecondary: e.target.value })}
                />
              </Stack>

              <Typography variant="subtitle2" mt={2} fontWeight={700}>Modules Actifs</Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
                <FormControlLabel 
                  control={<Checkbox checked={form.modules.hebergement} onChange={(e) => setForm({...form, modules: {...form.modules, hebergement: e.target.checked}})} />} 
                  label="Hébergement" 
                />
                <FormControlLabel 
                  control={<Checkbox checked={form.modules.restaurant} onChange={(e) => setForm({...form, modules: {...form.modules, restaurant: e.target.checked}})} />} 
                  label="Restaurant" 
                />
                <FormControlLabel 
                  control={<Checkbox checked={form.modules.stock} onChange={(e) => setForm({...form, modules: {...form.modules, stock: e.target.checked}})} />} 
                  label="Économat/Stock" 
                />
                <FormControlLabel 
                  control={<Checkbox checked={form.modules.fichesTechniques} onChange={(e) => setForm({...form, modules: {...form.modules, fichesTechniques: e.target.checked}})} />} 
                  label="Fiches Techniques" 
                />
                <FormControlLabel 
                  control={<Checkbox checked={form.modules.analyseEcarts} onChange={(e) => setForm({...form, modules: {...form.modules, analyseEcarts: e.target.checked}})} />} 
                  label="Analyse Écarts" 
                />
              </Stack>

              <Button 
                variant="contained" 
                color="primary" 
                size="large" 
                sx={{ mt: 2 }}
                onClick={handleProvision}
                disabled={provision.isPending || !form.tenantId || !form.nom}
              >
                {provision.isPending ? "Provisionnement..." : "Créer le Locataire"}
              </Button>
            </Stack>

            {createdUrl && (
              <Alert severity="success" sx={{ mt: 3 }}>
                Locataire créé avec succès !
                <br/>
                Lien de connexion : <a href={createdUrl} target="_blank" rel="noreferrer"><b>{createdUrl}</b></a>
              </Alert>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, height: "100%", bgcolor: "grey.50" }}>
            <Typography variant="h5" fontWeight={700} mb={3}>
              Locataires Existants
            </Typography>

            {isLoading ? (
              <Typography>Chargement...</Typography>
            ) : (
              <Grid container spacing={2}>
                {tenants?.map((t: any) => (
                  <Grid item xs={12} sm={6} key={t.id}>
                    <Card variant="outlined" sx={{ borderColor: t.publicConfig?.theme?.primary || "divider", borderWidth: 2 }}>
                      <CardContent>
                        <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                          <img 
                            src={t.publicConfig?.logoUrl || "/assets/default-logo.jpg"} 
                            alt={t.id} 
                            style={{ width: 40, height: 40, objectFit: "cover", borderRadius: "50%" }} 
                          />
                          <Box>
                            <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
                              {t.publicConfig?.nom || t.id}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              /{t.id}
                            </Typography>
                          </Box>
                        </Stack>

                        <Stack direction="row" flexWrap="wrap" gap={1} mb={2}>
                          {t.config?.modules?.hebergement && <Chip size="small" label="Hébergement" />}
                          {t.config?.modules?.restaurant && <Chip size="small" label="Restaurant" />}
                          {t.config?.modules?.stock && <Chip size="small" label="Stock" />}
                          {t.config?.modules?.fichesTechniques && <Chip size="small" label="Fiches Techniques" />}
                          {t.config?.modules?.analyseEcarts && <Chip size="small" label="Analyse Écarts" />}
                        </Stack>
                        
                        <Button variant="outlined" size="small" fullWidth href={`/${t.id}/login`} target="_blank">
                          Accéder
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
