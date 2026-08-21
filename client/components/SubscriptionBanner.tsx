import { useState } from "react";
import { Box, Paper, Typography, Button, Stack, Chip, IconButton } from "@mui/material";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
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

  // N'afficher la bannière que si l'abonnement expire bientôt (J-10 à J-1) et n'est pas encore bloqué
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

        <Stack direction="row" alignItems="center" spacing={1} sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<PhoneInTalkIcon />}
            href={`tel:${subDetails.contactCommercial.telephone}`}
            sx={{
              borderColor: "#d97706",
              color: "#92400e",
              textTransform: "none",
              fontWeight: 700,
              fontSize: "0.78rem",
              borderRadius: 2,
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
