import { PropsWithChildren, useState } from "react";
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

const drawerWidth = 280;

export function AppLayout({ children }: PropsWithChildren) {
  const { menu, role } = useRBAC();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { logout, user } = useAuth();
  const { publicConfig, tenantId } = useTenant();

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
        sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}
        color="inherit"
      >
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 3 }}>
            <img 
              src={publicConfig?.logoUrl || "/assets/default-logo.jpg"} 
              alt={`Logo ${publicConfig?.nom || 'Etablissement'}`} 
              style={{ height: 40, marginRight: 12, borderRadius: 8, objectFit: "cover" }} 
            />
            <Typography variant="h6" fontWeight={800}>
              {publicConfig?.nom || "Chargement..."}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ mr: 2 }} variant="body2" color="text.secondary">Connecté</Typography>
          <Button variant="text" sx={{ ml: 1 }} disabled>
            Rôle: {role}
          </Button>
          <Typography variant="body2" sx={{ ml: 1 }}>{(user as any)?.name || ''}</Typography>
          <IconButton
            onClick={logout}
            color="inherit"
            sx={{ ml: 1 }}
            title="Déconnexion"
          >
            <LogoutIcon />
          </IconButton>
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
