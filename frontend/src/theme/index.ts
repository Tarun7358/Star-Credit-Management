import { createTheme } from "@mui/material/styles";

export const getTheme = (mode: "light" | "dark") => {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? "#ffffff" : "#000000",
        light: isDark ? "#ffffff" : "#333333",
        dark: isDark ? "#e5e5e5" : "#000000",
        contrastText: isDark ? "#000000" : "#ffffff",
      },
      secondary: {
        main: isDark ? "#9ca3af" : "#6b7280",
        light: isDark ? "#d1d5db" : "#9ca3af",
        dark: isDark ? "#6b7280" : "#4b5563",
      },
      background: {
        default: isDark ? "#000000" : "#f8f8f8",
        paper: isDark ? "#121212" : "#ffffff",
      },
      text: {
        primary: isDark ? "#f9fafb" : "#111827",
        secondary: isDark ? "#9ca3af" : "#6b7280",
      },
      success: {
        main: "#10b981",
      },
      warning: {
        main: "#f59e0b",
      },
      error: {
        main: "#ef4444",
      },
      info: {
        main: "#3b82f6",
      },
      divider: isDark ? "#2d2d2d" : "#e5e7eb",
    },
    typography: {
      fontFamily: "'Inter', 'Poppins', sans-serif",
      h1: { 
        fontSize: "28px", 
        fontWeight: 700,
        letterSpacing: "-0.02em",
      }, // Dashboard Titles
      h2: { 
        fontSize: "20px", 
        fontWeight: 600,
        letterSpacing: "-0.01em",
      }, // Section Titles
      h3: { 
        fontSize: "24px", 
        fontWeight: 700,
      }, // Card Values
      body1: { 
        fontSize: "14px", 
        fontWeight: 400,
      }, // Body Text
      body2: { 
        fontSize: "14px", 
        fontWeight: 500,
      }, // Labels (Medium)
      subtitle2: {
        fontSize: "14px",
        fontWeight: 500,
      },
      button: {
        textTransform: "none",
        fontWeight: 600,
        fontSize: "14px",
      },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: "12px",
            backgroundImage: "none",
            backgroundColor: isDark ? "#121212" : "#ffffff",
            border: isDark ? "1px solid #2d2d2d" : "1px solid #e5e7eb",
            boxShadow: "none",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: "8px",
            padding: "8px 18px",
            boxShadow: "none",
            fontWeight: 600,
            "&:hover": {
              boxShadow: "none",
            },
          },
          containedPrimary: {
            backgroundColor: isDark ? "#ffffff" : "#000000",
            color: isDark ? "#000000" : "#ffffff",
            "&:hover": {
              backgroundColor: isDark ? "#e5e5e5" : "#222222",
            },
          },
          outlinedPrimary: {
            borderColor: isDark ? "#ffffff" : "#000000",
            color: isDark ? "#ffffff" : "#000000",
            "&:hover": {
              borderColor: isDark ? "#e5e5e5" : "#222222",
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: "8px",
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.01)",
              "& fieldset": {
                borderColor: isDark ? "#2d2d2d" : "#e5e7eb",
              },
              "&:hover fieldset": {
                borderColor: isDark ? "#ffffff" : "#000000",
              },
              "&.Mui-focused fieldset": {
                borderColor: isDark ? "#ffffff" : "#000000",
                borderWidth: "1px",
              },
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
    },
  });
};
