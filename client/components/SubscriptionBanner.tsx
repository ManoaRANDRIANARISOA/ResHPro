import { useState } from "react";
import { Box, Paper, Typography, Button, Stack, Chip, IconButton } from "@mui/material";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import EmailIcon from "@mui/icons-material/Email";
import CloseIcon from "@mui/icons-material/Close";
import { getSubscriptionDetails } from "@shared/tenant";
import { useTenant } from "@/contexts/TenantContext";

export function SubscriptionBanner() {
  const { publicConfig, config } = useTenant();
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem("reshpro_sub_banner_dismissed") === "true";
  });

  const sub = config?.subscription || publicConfig?.subscription;
  const subDetails = getSubscriptionDetails(sub);

  // 1. CAS PRIORITAIRE : PÉRIODE DE GRÂCE (J+1 à J+5)
  // Bannière rouge urgente et persistante (non masquable) pour avertir l'équipe
  if (subDetails.isGracePeriod) {
    const graceDays = subDetails.graceDaysRemaining;
    const graceText =
      graceDays === 0
        ? "Dernier jour aujourd'hui !"
        : graceDays === 1
        ? "Dernier jour demain !"
        : `${graceDays} jours restants`;

    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2.5,
          borderRadius: 2.5,
          bgcolor: "#fef2f2",
          border: "1.5px solid #f87171",
          boxShadow: "0 4px 12px -2px rgba(220, 38, 38, 0.15)",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack direction="row" alignItems="flex-start" spacing={1.5}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                bgcolor: "#fee2e2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#dc2626",
                flexShrink: 0,
                mt: 0.3,
              }}
            >
              <WarningAmberIcon />
            </Box>
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" mb={0.5}>
                <Typography variant="subtitle2" fontWeight={800} color="#991b1b">
                  Période de Grâce Active — Régularisation Requise
                </Typography>
                <Chip
                  label={`Coupure dans : ${graceText}`}
                  size="small"
                  sx={{
                    bgcolor: "#fee2e2",
                    color: "#991b1b",
                    fontWeight: 800,
                    border: "1px solid #fca5a5",
                    height: 22,
                  }}
                />
              </Stack>
              <Typography variant="caption" color="#7f1d1d" sx={{ display: "block", lineHeight: 1.5 }}>
                L'abonnement de cet établissement a expiré le <b>{subDetails.endDateFormatted}</b>. Vos services restent ouverts pendant la période de grâce de 5 jours. Veuillez régulariser votre abonnement immédiatement pour éviter le blocage complet de votre établissement.
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ alignSelf: { xs: "flex-end", md: "center" }, flexShrink: 0 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<PhoneInTalkIcon />}
              href={`tel:${subDetails.contactCommercial.telephone.replace(/\s+/g, "")}`}
              sx={{
                bgcolor: "#dc2626",
                color: "#ffffff",
                textTransform: "none",
                fontWeight: 700,
                fontSize: "0.82rem",
                borderRadius: 2,
                whiteSpace: "nowrap",
                px: 2,
                "&:hover": { bgcolor: "#b91c1c" },
              }}
            >
              {subDetails.contactCommercial.telephone}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<EmailIcon />}
              href={`mailto:${subDetails.contactCommercial.email}?subject=Régularisation%20Abonnement%20${encodeURIComponent(publicConfig?.nom || "")}`}
              sx={{
                borderColor: "#f87171",
                color: "#991b1b",
                textTransform: "none",
                fontWeight: 700,
                fontSize: "0.82rem",
                borderRadius: 2,
                whiteSpace: "nowrap",
                px: 1.5,
                "&:hover": { bgcolor: "#fee2e2" },
              }}
            >
              Email
            </Button>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  // 2. CAS PRÉVENTIF : ÉCHÉANCE PROCHE (J-10 à J-0)
  if (dismissed || !subDetails.isExpiringSoon || subDetails.isExpired) {
    return null;
  }

  const days = subDetails.daysRemaining;
  const daysText = days === 0 ? "aujourd'hui" : days === 1 ? "demain (1 jour)" : `dans ${days} jours`;

  function handleDismiss() {
    setDismissed(true);
    sessionStorage.setItem("reshpro_sub_banner_dismissed", "true");
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        mb: 2.5,
        borderRadius: 2.5,
        bgcolor: "#fffbeb",
        border: "1px solid #fde68a",
        boxShadow: "0 2px 8px -2px rgba(245, 158, 11, 0.15)",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        spacing={2}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              bgcolor: "#fef3c7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#d97706",
              flexShrink: 0,
            }}
          >
            <NotificationsActiveIcon fontSize="small" />
          </Box>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
              <Typography variant="subtitle2" fontWeight={800} color="#92400e">
                Rappel de renouvellement de souscription
              </Typography>
              <Chip
                label={`Échéance : ${daysText}`}
                size="small"
                sx={{
                  bgcolor: "#fef3c7",
                  color: "#b45309",
                  fontWeight: 700,
                  border: "1px solid #fde68a",
                  height: 22,
                }}
              />
            </Stack>
            <Typography variant="caption" color="#78350f" sx={{ display: "block", mt: 0.2 }}>
              Votre abonnement ResiPro pour cet établissement arrive à son terme le <b>{subDetails.endDateFormatted}</b>. Pour continuer à profiter de l'ensemble de vos services sans interruption, pensez à planifier votre renouvellement.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1} sx={{ alignSelf: { xs: "flex-end", sm: "center" }, flexShrink: 0 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<PhoneInTalkIcon />}
            href={`tel:${subDetails.contactCommercial.telephone.replace(/\s+/g, "")}`}
            sx={{
              borderColor: "#d97706",
              color: "#92400e",
              textTransform: "none",
              fontWeight: 700,
              fontSize: "0.82rem",
              borderRadius: 2,
              whiteSpace: "nowrap",
              flexShrink: 0,
              px: 1.5,
              "&:hover": {
                bgcolor: "#fef3c7",
                borderColor: "#b45309",
              },
            }}
          >
            {subDetails.contactCommercial.telephone}
          </Button>

          <IconButton size="small" onClick={handleDismiss} title="Masquer pour cette session">
            <CloseIcon fontSize="small" sx={{ color: "#92400e" }} />
          </IconButton>
        </Stack>
      </Stack>
    </Paper>
  );
}
