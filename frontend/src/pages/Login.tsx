import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { isSupabaseConfigured } from "../utils/supabaseClient";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Link
} from "@mui/material";
import { ShieldCheck } from "lucide-react";

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [forgotOpen, setForgotOpen] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(loginForm.email, loginForm.password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Failed to login. Please check credentials.");
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
        p: 3,
        background: "radial-gradient(circle at 50% 10%, #1c2135 0%, #0b0c10 80%)"
      }}
    >
      <Card sx={{ maxWidth: 420, width: "100%", p: 2, borderRadius: "16px", backdropFilter: "blur(20px)", bgcolor: "rgba(23, 27, 43, 0.8)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
        <CardContent>
          {/* Logo Header */}
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 4 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                mb: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 20px rgba(99, 102, 241, 0.3)"
              }}
            >
              <ShieldCheck size={38} color="#ffffff" />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: "'Outfit', sans-serif", letterSpacing: -0.5, mb: 0.5 }}>
              Star Credit Management
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", fontSize: "0.75rem" }}>
              Operational Intermediary Portal
            </Typography>
          </Box>

          {/* Notification Alerts */}
          {!isSupabaseConfigured && (
            <Alert severity="warning" sx={{ mb: 3, borderRadius: "10px" }}>
              Supabase is not configured. Please set your <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> in the <code>frontend/.env</code> file, then restart the server.
            </Alert>
          )}
          {error && <Alert severity="error" sx={{ mb: 3, borderRadius: "10px" }}>{error}</Alert>}

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              <TextField
                label="Email Address"
                type="email"
                fullWidth
                required
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              />
              <TextField
                label="Password"
                type="password"
                fullWidth
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading}
                sx={{ py: 1.5, fontSize: "0.95rem", fontWeight: 700, borderRadius: "8px", mt: 1 }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : "Sign In to SCM"}
              </Button>
            </Box>
          </form>

          {/* Forgot Password Link */}
          <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
            <Link
              component="button"
              variant="body2"
              onClick={() => setForgotOpen(true)}
              sx={{ fontWeight: 600, color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
            >
              Forgot Password?
            </Link>
          </Box>
        </CardContent>
      </Card>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotOpen} onClose={() => setForgotOpen(false)} PaperProps={{ sx: { borderRadius: "12px", p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>Password Recovery Information</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.95rem", lineHeight: 1.6 }}>
            Access control for Star Credit Management is invite-based and controlled strictly by administrators.
            <br /><br />
            To recover or reset your account password, please contact your SCM Agency Owner or contact SCM IT Support directly at <strong>support@starcredit.com</strong>.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setForgotOpen(false)} variant="contained" autoFocus>
            Acknowledge
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
