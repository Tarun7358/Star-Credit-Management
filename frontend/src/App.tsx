import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider, useThemeContext } from "./context/ThemeContext";
import { getTheme } from "./theme";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Clients } from "./pages/Clients";
import { Employees } from "./pages/Employees";
import { Reports } from "./pages/Reports";
import VisitsLive from "./pages/VisitsLive";
import VisitsHistory from "./pages/VisitsHistory";
import Settings from "./pages/Settings";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { Box, CircularProgress } from "@mui/material";

// Guard components
const PrivateRoute: React.FC<{ children: React.ReactNode; requiresOwner?: boolean }> = ({
  children,
  requiresOwner = false
}) => {
  const { user, loading, isOwner } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: "flex", width: "100vw", height: "100vh", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
        <CircularProgress size={50} />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiresOwner && !isOwner) {
    return <Navigate to="/" replace />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
};

const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: "flex", width: "100vw", height: "100vh", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
        <CircularProgress size={50} />
      </Box>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { mode } = useThemeContext();
  const theme = getTheme(mode);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {/* Guest Routes */}
          <Route
            path="/login"
            element={
              <GuestRoute>
                <Login />
              </GuestRoute>
            }
          />

          {/* Secure Routes */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <PrivateRoute>
                <Clients />
              </PrivateRoute>
            }
          />
          <Route
            path="/employees"
            element={
              <PrivateRoute>
                <Employees />
              </PrivateRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <PrivateRoute>
                <Reports />
              </PrivateRoute>
            }
          />
          <Route
            path="/visits-live"
            element={
              <PrivateRoute>
                <VisitsLive />
              </PrivateRoute>
            }
          />
          <Route
            path="/visits-history"
            element={
              <PrivateRoute>
                <VisitsHistory />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <Settings />
              </PrivateRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </MuiThemeProvider>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
