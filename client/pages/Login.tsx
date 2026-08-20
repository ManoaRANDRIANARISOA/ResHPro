import { useState, FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  TextField,
  Button,
  Typography,
  Container,
  Paper,
  IconButton,
  InputAdornment,
  CircularProgress,
  Alert,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";

export default function Login() {
  const { tenantId, publicConfig, logo } = useTenant();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, logout } = useAuth();
  const { isLoading: tenantLoading, error: tenantError } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();

  const [error, setError] = useState(location.state?.error || "");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        navigate(`/${tenantId}/dashboard`);
      } else {
        setError("Email ou mot de passe incorrect");
      }
    } catch (err) {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f8f9fa 0%, #e8eef3 100%)",
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={3}
          sx={{
            p: 5,
            borderRadius: 3,
            textAlign: "center",
            bgcolor: "white",
          }}
        >
          {tenantError ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography variant="h5" color="error" gutterBottom fontWeight="bold">
                Établissement introuvable
              </Typography>
              <Typography color="text.secondary">
                L'URL que vous avez saisie ne correspond à aucun établissement enregistré.
                Veuillez vérifier l'adresse ou contacter votre administrateur.
              </Typography>
            </Box>
          ) : (
            <>
              {/* Logo */}
              <Box
            sx={{
              mb: 4,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <img
              src={logo}
              alt={`${publicConfig?.nom || 'Etablissement'} Logo`}
              style={{
                width: "180px",
                height: "180px",
                objectFit: "cover",
                borderRadius: "24px",
                boxShadow: "0 4px 14px 0 rgba(0,0,0,0.1)",
              }}
            />
          </Box>

          {/* Titre */}
          <Typography
            variant="h4"
            fontWeight={700}
            sx={{
              mb: 1,
              background: "linear-gradient(135deg, #6E8EF5 0%, #94D3AC 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {publicConfig?.nom || "Bienvenue"}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 4 }}
          >
            Connectez-vous pour accéder à votre espace
          </Typography>

          {/* Formulaire */}
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Adresse e-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              sx={{ mb: 3 }}
              disabled={loading}
            />

            <TextField
              fullWidth
              label="Mot de passe"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              sx={{ mb: 3 }}
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      disabled={loading}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                py: 1.5,
                fontSize: "1rem",
                fontWeight: 600,
                textTransform: "none",
                bgcolor: "#6E8EF5",
                "&:hover": {
                  bgcolor: "#5B7CE4",
                },
              }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: "white" }} />
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>

          {/* Informations supplémentaires */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 3, display: "block" }}
          >
              {publicConfig?.nom || "Système de Gestion"} - ResiPro
            </Typography>
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
