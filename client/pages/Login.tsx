import { useState, FormEvent } from "react";
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

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const success = await login(email, password);
      if (!success) {
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
          {/* Logo */}
          <Box
            sx={{
              mb: 4,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <img
              src="/assets/logo-oka.jpg"
              alt="Ôka forest lodge Logo"
              style={{
                width: "180px",
                height: "180px",
                objectFit: "contain",
              }}
            />
          </Box>

          {/* Titre */}
          <Typography
            variant="h4"
            fontWeight={700}
            sx={{
              mb: 1,
              background: "linear-gradient(135deg, #FFA500 0%, #2D8B44 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Bienvenue
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
                background: "linear-gradient(135deg, #FFA500 0%, #FF8C00 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #FF8C00 0%, #FF7800 100%)",
                },
                boxShadow: "0 4px 12px rgba(255, 165, 0, 0.3)",
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
            Ôka forest lodge - Système de Gestion
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
