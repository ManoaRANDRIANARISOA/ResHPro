import "./global.css";

import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import NotFound from "./pages/NotFound";
import { ThemeProvider, CssBaseline, createTheme } from "@mui/material";
import { theme as defaultTheme } from "@/theme/mui";
import { Provider } from "react-redux";
import { store } from "@/store";
import { AppLayout } from "@/layout/AppLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import RestoPlan from "@/pages/restaurant/Plan";
import RestoMenu from "@/pages/restaurant/Menu";
import FichesTechniques from "@/pages/restaurant/FichesTechniques";
import StockDashboard from "@/pages/stock/Dashboard";
import RestoEvenements from "@/pages/restaurant/Evenements";
import AnalyseEcarts from "@/pages/restaurant/AnalyseEcarts";
import Placeholder from "@/components/Placeholder";
import GestionChambres from "@/pages/hebergement/GestionChambres";
import HebergementClients from "@/pages/hebergement/Clients";
import HebergementStock from "@/pages/hebergement/Stock";
import HebergementTarifs from "@/pages/hebergement/Tarifs";
import Financier from "@/pages/Financier";
import AdminPage from "@/pages/Admin";
import RestoStock from "@/pages/restaurant/Stock";
import RouteGuard from "@/components/RouteGuard";
import SuperAdminDashboard from "@/pages/superadmin/Dashboard";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { tenantId } = useTenant();

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="login" replace />;
  }

  if (!user.superAdmin && user.tenantId !== tenantId) {
    logout(); // Force disconnect
    return <Navigate to="login" replace state={{ error: "Non autorisé: Ce compte n'appartient pas à cet établissement." }} />;
  }

  return <>{children}</>;
}

function AuthenticatedTenantRoutes() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/hebergement/gestion" element={
          <RouteGuard allowed={["admin","reception","economat","direction"]}><GestionChambres /></RouteGuard>
        } />
        <Route path="/hebergement/clients" element={
          <RouteGuard allowed={["admin","reception","economat","direction"]}><HebergementClients /></RouteGuard>
        } />
        <Route path="/hebergement/stock" element={
          <RouteGuard allowed={["admin","economat","direction"]}><HebergementStock /></RouteGuard>
        } />
        <Route path="/hebergement/tarifs" element={
          <RouteGuard allowed={["admin","direction"]}><HebergementTarifs /></RouteGuard>
        } />

        <Route path="/resto/plan" element={
          <RouteGuard allowed={["admin","reception","chef_salle","serveur","cuisine","bar","comptoir","direction"]}><RestoPlan /></RouteGuard>
        } />
        <Route path="/resto/menu" element={
          <RouteGuard allowed={["admin","chef_salle","serveur","cuisine","bar","comptoir","direction"]}><RestoMenu /></RouteGuard>
        } />
        <Route path="/resto/fiches-techniques" element={
          <RouteGuard allowed={["admin","chef_salle","cuisine","direction"]}><FichesTechniques /></RouteGuard>
        } />
        <Route path="/resto/stock" element={
          <RouteGuard allowed={["admin","comptoir","direction"]}><RestoStock /></RouteGuard>
        } />
        <Route path="/stock/dashboard" element={
          <RouteGuard allowed={["admin","economat","direction"]}><StockDashboard /></RouteGuard>
        } />
        <Route path="/resto/evenements" element={
          <RouteGuard allowed={["admin","chef_salle","serveur","cuisine","bar","comptoir","direction"]}><RestoEvenements /></RouteGuard>
        } />
        <Route path="/resto/ecarts" element={
          <RouteGuard allowed={["admin","economat","direction"]}><AnalyseEcarts /></RouteGuard>
        } />

        <Route path="/financier" element={
          <RouteGuard allowed={["admin","comptable","comptoir","direction","reception"]}><Financier /></RouteGuard>
        } />
        <Route path="/admin" element={
          <RouteGuard allowed={["admin"]}><AdminPage /></RouteGuard>
        } />
        <Route path="/parametres" element={<Placeholder title="Paramètres" />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

function DynamicThemeProvider({ children }: { children: React.ReactNode }) {
  const { publicConfig } = useTenant();
  
  // Disabled dynamic theme overriding for now as requested
  const dynamicTheme = defaultTheme;

  return (
    <ThemeProvider theme={dynamicTheme}>
      {children}
    </ThemeProvider>
  );
}

function TenantGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, error } = useTenant();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
        <h2>Chargement de l'établissement...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', textAlign: 'center' }}>
        <h1 style={{ color: '#d32f2f' }}>404 - Établissement introuvable</h1>
        <p>L'établissement que vous essayez d'accéder n'existe pas ou l'URL est incorrecte.</p>
        <p style={{ color: '#666', fontSize: '0.9em' }}>Veuillez vérifier le lien fourni par votre administrateur.</p>
      </div>
    );
  }

  return <>{children}</>;
}

function TenantRoutes() {
  return (
    <TenantGuard>
      <DynamicThemeProvider>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route path="*" element={
            <AuthGuard>
              <AuthenticatedTenantRoutes />
            </AuthGuard>
          } />
        </Routes>
      </DynamicThemeProvider>
    </TenantGuard>
  );
}

const App = () => (
  <Provider store={store}>
    <QueryClientProvider client={queryClient}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
              {/* Route super-admin sans tenant */}
              <Route path="/superadmin/*" element={<SuperAdminDashboard />} />
              
              {/* Routes avec tenant */}
              <Route path="/:tenantId/*" element={
                <TenantProvider>
                  <TenantRoutes />
                </TenantProvider>
              } />
              
              {/* Racine → page d'accueil ou redirection vers le tenant par défaut (temporaire) */}
              <Route path="/" element={<Navigate to="/oka-lodge/login" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
    </QueryClientProvider>
  </Provider>
);

createRoot(document.getElementById("root")!).render(<App />);
