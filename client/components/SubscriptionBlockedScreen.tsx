import { Box, Paper, Typography, Button, Stack, Container, Divider } from "@mui/material";
import LockClockIcon from "@mui/icons-material/LockClock";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import EmailIcon from "@mui/icons-material/Email";
import LogoutIcon from "@mui/icons-material/Logout";
import SecurityIcon from "@mui/icons-material/Security";
import { getSubscriptionDetails } from "@shared/tenant";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";

export function SubscriptionBlockedScreen({ onBypass }: { onBypass?: () => void }) {
  const { tenantId, publicConfig, config, logo } = useTenant();
  const { logout, user } = useAuth();

  const sub = config?.subscription || publicConfig?.subscription;
  const subDetails = getSubscriptionDetails(sub);

  const establishmentName = publicConfig?.nom || config?.nom || tenantId || "Votre Établissement";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 50% 30%, #f8fafc 0%, #e2e8f0 100%)",
        p: 2,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={4}
          sx={{
            p: { xs: 3.5, sm: 5 },
            borderRadius: 4,
            textAlign: "center",
            bgcolor: "#ffffff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
          }}
        >
          {/* LOGO DE L'ÉTABLISSEMENT */}
          <Box sx={{ mb: 3, display: "flex", justifyContent: "center" }}>
            <img
              src={logo}
              alt={establishmentName}
              style={{
                width: 90,
                height: 90,
                objectFit: "cover",
                borderRadius: 20,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                border: "2px solid #f1f5f9",
              }}
            />
          </Box>

          {/* ICÔNE DE SUSPENSION COURTOISE */}
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              bgcolor: "#fef2f2",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2,
            }}
          >
            <LockClockIcon sx={{ fontSize: 32 }} />
          </Box>

          <Typography variant="h5" fontWeight={800} color="#0f172a" gutterBottom>
            Accès Temporairement Restreint
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
            La période de souscription active pour <b>{establishmentName}</b> est arrivée à son terme le{" "}
            <b>{subDetails.endDateFormatted || "récemment"}</b>.
            {subDetails.suspendedReason && (
              <span style={{ display: "block", marginTop: 6, color: "#b91c1c", fontWeight: 600 }}>
                Motif : {subDetails.suspendedReason}
              </span>
            )}
          </Typography>

          {/* ENCART DE RÉASSURANCE CLIENT */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 3,
              borderRadius: 2.5,
              bgcolor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              textAlign: "left",
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <SecurityIcon sx={{ color: "#16a34a", fontSize: 24, flexShrink: 0 }} />
              <Typography variant="caption" color="#166534" fontWeight={600} lineHeight={1.5}>
                <b>Vos données sont intactes & sécurisées :</b> Toutes vos réservations, données de caisse, stocks, fiches salariés et factures sont intégralement préservées et seront instantanément accessibles dès la réactivation.
              </Typography>
            </Stack>
          </Paper>

          <Divider sx={{ my: 2.5 }} />

          {/* CONTACT ASSISTANCE & SERVICE COMMERCIAL */}
          <Typography variant="subtitle2" fontWeight={700} color="#334155" mb={1.5}>
            Pour renouveler ou réactiver immédiatement votre accès :
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="center" mb={3}>
            <Button
              variant="contained"
              startIcon={<PhoneInTalkIcon />}
              href={`tel:${subDetails.contactCommercial.telephone}`}
              sx={{
                bgcolor: "#2563eb",
                fontWeight: 700,
                textTransform: "none",
                borderRadius: 2.5,
                py: 1,
                "&:hover": { bgcolor: "#1d4ed8" },
              }}
            >
              {subDetails.contactCommercial.telephone}
            </Button>
            <Button
              variant="outlined"
              startIcon={<EmailIcon />}
              href={`mailto:${subDetails.contactCommercial.email}?subject=Renouvellement%20Abonnement%20${encodeURIComponent(establishmentName)}`}
              sx={{
                borderColor: "#cbd5e1",
                color: "#334155",
                fontWeight: 700,
                textTransform: "none",
                borderRadius: 2.5,
                py: 1,
                "&:hover": { bgcolor: "#f8fafc" },
              }}
            >
              Envoyer un email
            </Button>
          </Stack>

          {/* ACTIONS SECONDAIRES */}
          <Stack direction="row" justifyContent="center" spacing={2}>
            <Button
              variant="text"
              size="small"
              startIcon={<LogoutIcon />}
              onClick={() => logout()}
              sx={{ color: "#64748b", textTransform: "none", fontWeight: 600 }}
            >
              Se déconnecter
            </Button>

            {user?.superAdmin && onBypass && (
              <Button
                variant="text"
                size="small"
                onClick={onBypass}
                sx={{ color: "#7c3aed", textTransform: "none", fontWeight: 700 }}
              >
                Accéder en mode SuperAdmin
              </Button>
            )}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
