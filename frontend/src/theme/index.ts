import { createTheme } from "@mui/material/styles";

export const getTheme = (mode: "light" | "dark") => {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: "#6366f1", // Indigo
        light: "#818cf8",
        dark: "#4f46e5",
      },
      secondary: {
        main: "#a855f7", // Violet/Purple
        light: "#c084fc",
        dark: "#9333ea",
      },
      background: {
        default: isDark ? "#0b0c10" : "#f8fafc",
        paper: isDark ? "#11131f" : "#ffffff",
      },
      text: {
        primary: isDark ? "#f8fafc" : "#0f172a",
        secondary: isDark ? "#94a3b8" : "#475569",
      },
      success: {
        main: "#10b981", // Emerald
      },
      warning: {
        main: "#f59e0b", // Amber
      },
      error: {
        main: "#ef4444", // Rose
      },
      divider: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
    },
    typography: {
      fontFamily: "'Inter', sans-serif",
      h1: { fontFamily: "'Outfit', sans-serif", fontWeight: 700 },
      h2: { fontFamily: "'Outfit', sans-serif", fontWeight: 700 },
      h3: { fontFamily: "'Outfit', sans-serif", fontWeight: 600 },
      h4: { fontFamily: "'Outfit', sans-serif", fontWeight: 600 },
      h5: { fontFamily: "'Outfit', sans-serif", fontWeight: 500 },
      h6: { fontFamily: "'Outfit', sans-serif", fontWeight: 500 },
      button: {
        textTransform: "none",
        fontWeight: 600,
        fontFamily: "'Outfit', sans-serif",
      },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: "16px",
            backgroundImage: "none",
            backgroundColor: isDark ? "rgba(17, 19, 31, 0.65)" : "#ffffff",
            backdropFilter: isDark ? "blur(16px) saturate(120%)" : "none",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.08)",
            boxShadow: isDark
              ? "0 4px 30px rgba(0, 0, 0, 0.4)"
              : "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: "10px",
            padding: "8px 18px",
            boxShadow: "none",
            "&:hover": {
              boxShadow: "none",
            },
          },
          containedPrimary: {
            background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
            color: "#ffffff",
            "&:hover": {
              background: "linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)",
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: "10px",
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.01)",
              "& fieldset": {
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
              },
              "&:hover fieldset": {
                borderColor: "#6366f1",
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
