import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Stack,
  Chip,
} from "@mui/material";
import {
  CalendarMonth,
  ReceiptLong,
  AccessTime,
  AccountBalanceWallet,
  People,
  Badge,
} from "@mui/icons-material";
import { PlanningView } from "./components/PlanningView";
import { PaieView } from "./components/PaieView";
import { PointagesView } from "./components/PointagesView";
import { AvancesView } from "./components/AvancesView";
import { EmployesView } from "./components/EmployesView";
import { useTenant } from "@/contexts/TenantContext";

export default function RHPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") || "planning";
  const [activeTab, setActiveTab] = useState<string>(tabParam);

  const { tenantId } = useTenant();

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue);
    setSearchParams({ tab: newValue });
  };

  return (
    <Box>
      {/* PAGE HEADER */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        mb={3}
        spacing={1}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="h4" fontWeight={800} color="#0f172a" letterSpacing="-0.5px">
              Ressources Humaines & Paie
            </Typography>
            <Chip
              size="small"
              label="Module Avancé"
              sx={{
                bgcolor: "#e0e7ff",
                color: "#3730a3",
                fontWeight: 700,
                fontSize: "0.72rem",
              }}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Planning interactif des équipes, gestion des présences, génération des fiches de paie et suivi des acomptes.
          </Typography>
        </Box>
      </Stack>

      {/* NAVIGATION TABS */}
      <Paper sx={{ mb: 3, borderRadius: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 2,
            borderBottom: 1,
            borderColor: "divider",
            "& .MuiTab-root": {
              fontWeight: 700,
              fontSize: "0.875rem",
              minHeight: 54,
              textTransform: "none",
            },
          }}
        >
          <Tab
            value="planning"
            icon={<CalendarMonth fontSize="small" />}
            iconPosition="start"
            label="Planning & Tâches"
          />
          <Tab
            value="paie"
            icon={<ReceiptLong fontSize="small" />}
            iconPosition="start"
            label="Gestion de la Paie"
          />
          <Tab
            value="pointages"
            icon={<AccessTime fontSize="small" />}
            iconPosition="start"
            label="Présences & Pointages"
          />
          <Tab
            value="avances"
            icon={<AccountBalanceWallet fontSize="small" />}
            iconPosition="start"
            label="Avances sur Salaire"
          />
          <Tab
            value="employes"
            icon={<People fontSize="small" />}
            iconPosition="start"
            label="Personnel & Contrats"
          />
        </Tabs>
      </Paper>

      {/* TAB PANELS */}
      <Box>
        {activeTab === "planning" && <PlanningView />}
        {activeTab === "paie" && <PaieView />}
        {activeTab === "pointages" && <PointagesView />}
        {activeTab === "avances" && <AvancesView />}
        {activeTab === "employes" && <EmployesView />}
      </Box>
    </Box>
  );
}
