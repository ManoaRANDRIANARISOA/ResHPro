import { PropsWithChildren, useState, useMemo } from "react";
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  Menu,
  MenuItem,
  ListSubheader,
  ListItemIcon,
  Avatar,
  Chip,
  Stack,
  Tooltip,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import DashboardIcon from "@mui/icons-material/Dashboard";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PeopleIcon from "@mui/icons-material/People";
import LocalLaundryServiceIcon from "@mui/icons-material/LocalLaundryService";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import EventIcon from "@mui/icons-material/Event";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import GroupIcon from "@mui/icons-material/Group";
import SettingsIcon from "@mui/icons-material/Settings";
import { Link, useLocation } from "react-router-dom";
import { useRBAC } from "@/hooks/useRBAC";
import { useAppDispatch } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useUsers } from "@/services/api";

const drawerWidth = 280;

const ROLE_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  admin: { label: "Admin", bg: "#e0e7ff", color: "#3730a3" },
  direction: { label: "Direction", bg: "#ede9fe", color: "#5b21b6" },
  reception: { label: "Réception", bg: "#dbeafe", color: "#1e40af" },
  resp_hebergement: { label: "Resp. Hébergement", bg: "#dbeafe", color: "#1e40af" },
  "responsable hebergement": { label: "Resp. Hébergement", bg: "#dbeafe", color: "#1e40af" },
  resp_resto: { label: "Resp. Restaurant", bg: "#fef3c7", color: "#92400e" },
  "responsable restaurant": { label: "Resp. Restaurant", bg: "#fef3c7", color: "#92400e" },
  chef_salle: { label: "Chef de Salle", bg: "#fef3c7", color: "#92400e" },
  serveur: { label: "Service", bg: "#f1f5f9", color: "#475569" },
  cuisine: { label: "Cuisine", bg: "#ffedd5", color: "#9a3412" },
  bar: { label: "Bar", bg: "#fae8ff", color: "#86198f" },
  comptoir: { label: "Comptoir", bg: "#e0f2fe", color: "#0369a1" },
  economat: { label: "Économat", bg: "#ecfdf5", color: "#065f46" },
  comptable: { label: "Comptable", bg: "#f0fdf4", color: "#166534" },
};

export function AppLayout({ children }: PropsWithChildren) {
  const { menu, role } = useRBAC();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { tenantId, publicConfig, logo } = useTenant();
  const { logout, user } = useAuth();
  const { data: usersList } = useUsers();

  // Nom d'affichage de l'utilisateur connecté
  const userName = useMemo(() => {
    if (!user) return "Invité";
    const matched = (usersList || []).find(
      (u) =>
        (user.email && (u.email?.toLowerCase() === user.email.toLowerCase() || u.login?.toLowerCase() === user.email.toLowerCase())) ||
        (user.uid && u.id === user.uid)
    );
    if (matched?.nom) return matched.nom;
    if (user.displayName) return user.displayName;
    if (user.email) {
      const prefix = user.email.split("@")[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1).replace(/[._]/g, " ");
    }
    return "Utilisateur";
  }, [user, usersList]);

  const userInitial = userName.charAt(0).toUpperCase();
  const roleBadge = (role && ROLE_BADGES[role.toLowerCase()]) || {
    label: role ? (role.charAt(0).toUpperCase() + role.slice(1)) : "Staff",
    bg: "#f1f5f9",
    color: "#475569",
  };

  function iconFor(path: string) {
    if (path.startsWith("/hebergement/gestion"))
      return <CalendarMonthIcon fontSize="small" />;
    if (path.startsWith("/hebergement/clients"))
      return <PeopleIcon fontSize="small" />;
    if (path.startsWith("/hebergement/stock"))
      return <LocalLaundryServiceIcon fontSize="small" />;
    if (path.startsWith("/hebergement/tarifs"))
      return <MonetizationOnIcon fontSize="small" />;

    if (path.startsWith("/resto/plan"))
      return <TableRestaurantIcon fontSize="small" />;
    if (path.startsWith("/resto/menu"))
      return <RestaurantMenuIcon fontSize="small" />;
    if (path.startsWith("/resto/stock"))
      return <Inventory2Icon fontSize="small" />;
    if (path.startsWith("/resto/evenements"))
      return <EventIcon fontSize="small" />;

    if (path.startsWith("/financier"))
      return <ReceiptLongIcon fontSize="small" />;
    if (path.startsWith("/admin")) return <GroupIcon fontSize="small" />;
    if (path.startsWith("/parametres"))
      return <SettingsIcon fontSize="small" />;
    return <DashboardIcon fontSize="small" />;
  }

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          bgcolor: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
        color="inherit"
        elevation={0}
      >
        <Toolbar sx={{ justifyContent: "space-between", minHeight: 64, px: { xs: 2, md: 3 } }}>
          {/* LOGO & TENANT NAME */}
          <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5 }}>
            <img 
              src={logo} 
              alt="Logo" 
              style={{ width: 44, height: 44, borderRadius: 12, marginRight: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} 
            />
            <Typography variant="h6" fontWeight={800} color="#0f172a" letterSpacing="-0.3px">
              {publicConfig?.nom || "Chargement..."}
            </Typography>
          </Box>

          {/* USER PROFILE & LOGOUT DECK */}
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {/* User Profile Pill */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.2,
                py: 0.5,
                px: 1.2,
                borderRadius: 999,
                bgcolor: "#f8fafc",
                border: "1px solid #e2e8f0",
                transition: "all 0.2s ease",
                "&:hover": {
                  bgcolor: "#f1f5f9",
                  borderColor: "#cbd5e1",
                },
              }}
            >
              <Box sx={{ position: "relative", display: "inline-flex" }}>
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    background: "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)",
                    color: "#ffffff",
                    boxShadow: "0 2px 5px rgba(79, 70, 229, 0.2)",
                  }}
                >
                  {userInitial}
                </Avatar>
                {/* Online Indicator */}
                <Box
                  sx={{
                    position: "absolute",
                    bottom: -1,
                    right: -1,
                    width: 9,
                    height: 9,
                    bgcolor: "#22c55e",
                    borderRadius: "50%",
                    border: "2px solid #ffffff",
                  }}
                />
              </Box>

              <Box sx={{ pr: 0.5, textAlign: "left" }}>
                <Typography variant="body2" fontWeight={800} color="#0f172a" lineHeight={1.2}>
                  {userName}
                </Typography>
                <Chip
                  size="small"
                  label={roleBadge.label}
                  sx={{
                    height: 18,
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    bgcolor: roleBadge.bg,
                    color: roleBadge.color,
                    mt: 0.2,
                    borderRadius: 1,
                  }}
                />
              </Box>
            </Box>

            {/* Logout Icon Button */}
            <Tooltip title="Se déconnecter" arrow>
              <IconButton
                onClick={logout}
                size="small"
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  color: "#64748b",
                  transition: "all 0.15s ease",
                  "&:hover": {
                    bgcolor: "#fee2e2",
                    borderColor: "#fca5a5",
                    color: "#dc2626",
                  },
                }}
              >
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: "auto", p: 1 }}>
          <List>
            <ListItemButton
              component={Link}
              to={`/${tenantId}/dashboard`}
              selected={location.pathname.startsWith(`/${tenantId}/dashboard`) || location.pathname === `/${tenantId}`}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <DashboardIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Dashboard" />
            </ListItemButton>
          </List>
          <Divider />
          {menu.sections.map((section) => (
            <List
              key={section.label}
              subheader={<ListSubheader>{section.label}</ListSubheader>}
            >
              {section.children.map((item) => (
                <ListItemButton
                  key={item.path}
                  component={Link}
                  to={`/${tenantId}${item.path}`}
                  selected={location.pathname.startsWith(`/${tenantId}${item.path}`)}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {iconFor(item.path)}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              ))}
            </List>
          ))}
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}

function RoleSwitcher({
  value,
  onChange,
}: {
  value: any;
  onChange: (v: any) => void;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const roles = [
    "admin",
    "reception",
    "chef_salle",
    "serveur",
    "cuisine",
    "bar",
    "comptoir",
    "economat",
    "comptable",
    "direction",
  ] as const;
  return (
    <>
      <Button
        variant="text"
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ ml: 1, display:'none' }}
      >
        Rôle: {value}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {roles.map((r) => (
          <MenuItem
            key={r}
            onClick={() => {
              onChange(r as any);
              setAnchor(null);
            }}
          >
            {" "}
            {r}{" "}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
