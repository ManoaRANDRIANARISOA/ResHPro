import { createTheme } from "@mui/material/styles";

// Pastel palette tailored for OKA LODGE
const pastel = {
  primary: { main: "#6E8EF5" }, // pastel blue
  secondary: { main: "#94D3AC" }, // pastel green
  info: { main: "#8EC5FF" },
  success: { main: "#7BD389" },
  warning: { main: "#F7C873" },
  error: { main: "#F29E9E" },
  grey: {
    50: "#FAFAFB",
    100: "#F1F1F4",
    200: "#E6E8EE",
    300: "#D6DAE5",
    400: "#B9C0D4",
    500: "#9AA3BA",
    600: "#7D889F",
    700: "#5F6B85",
    800: "#4B556E",
    900: "#394057",
  },
};

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: pastel.primary,
    secondary: pastel.secondary,
    success: pastel.success,
    warning: pastel.warning,
    error: pastel.error,
    info: pastel.info,
    background: { default: "#F7F8FB", paper: "#FFFFFF" },
    text: { primary: "#1B2430", secondary: pastel.grey[700] },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      'Inter, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999 },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { rounded: { borderRadius: 12 } },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
  },
});
