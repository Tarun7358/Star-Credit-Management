import React, { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  Avatar,
  Stack,
  Divider,
  Switch,
  FormControlLabel,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from "@mui/material";
import { User, Key, Bell, Smartphone, History, Check } from "lucide-react";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [loginLogs, setLoginLogs] = useState<any[]>([]);

  // Form states
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");

  // Password change states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Notification toggles
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch user profile from public.users table
      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (userData) {
        setProfile(userData);
        setFullName(userData.full_name || "");
        setPhone(userData.phone || "");
        setDepartment(userData.department || "");
        setEmergencyContact(userData.emergency_contact || "");
        setProfilePhotoUrl(userData.profile_photo_url || "");
      }

      // Fetch login history
      const { data: historyRows } = await supabase
        .from("login_history")
        .select("*")
        .eq("user_id", session.user.id)
        .order("timestamp", { ascending: false })
        .limit(10);

      setLoginLogs(historyRows || []);
    } catch (err) {
      console.error("Failed to load settings details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      const { error } = await supabase
        .from("users")
        .update({
          full_name: fullName,
          phone,
          department,
          emergency_contact: emergencyContact,
          profile_photo_url: profilePhotoUrl
        })
        .eq("user_id", profile.user_id);

      if (error) throw error;
      alert("Profile updated successfully!");
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update profile.");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setPasswordSuccess("Password changed successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password.");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        <CircularProgress color="inherit" />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, fontFamily: "Outfit, sans-serif", mb: 3 }}>
        Personal Profile & Settings
      </Typography>

      <Grid container spacing={3}>
        {/* Left column: Profile details */}
        <Grid item xs={12} md={8}>
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
                <User size={18} />
                Personal Profile Information
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <form onSubmit={handleUpdateProfile}>
                <Grid container spacing={3}>
                  <Grid item xs={12} sx={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <Avatar
                      src={profilePhotoUrl || undefined}
                      sx={{ width: 80, height: 80, bgcolor: "#000000", fontWeight: 700 }}
                    >
                      {fullName ? fullName[0].toUpperCase() : "U"}
                    </Avatar>
                    <TextField
                      fullWidth
                      size="small"
                      label="Profile Avatar Image URL"
                      placeholder="https://example.com/avatar.jpg"
                      value={profilePhotoUrl}
                      onChange={(e) => setProfilePhotoUrl(e.target.value)}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      label="Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      disabled
                      label="Email Address (Login ID)"
                      value={profile?.email || ""}
                      helperText="Login emails cannot be modified online."
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      label="Phone Number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Emergency Contact Number"
                      placeholder="Emergency contact"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Department"
                      placeholder="e.g. Field Operations, Recovery"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      disabled
                      label="Designation / Role"
                      value={(profile?.role || "Worker").toUpperCase()}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Button variant="contained" type="submit" sx={{ bgcolor: "#000000", color: "#ffffff", "&:hover": { bgcolor: "#333333" } }}>
                      Save Profile Changes
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </CardContent>
          </Card>

          {/* Login logs / Session history */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
                <History size={18} />
                Recent Login History (Audit Trail)
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <List>
                {loginLogs.map((log) => (
                  <ListItem key={log.login_id} divider>
                    <ListItemIcon>
                      <Smartphone size={20} />
                    </ListItemIcon>
                    <ListItemText
                      primary={log.device_info || "Web Browser Portal Session"}
                      secondary={`IP: ${log.ip_address || "N/A"} | Date: ${new Date(log.timestamp).toLocaleString()}`}
                    />
                  </ListItem>
                ))}
                {loginLogs.length === 0 && (
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                    No login history recorded yet.
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Right column: Security & settings config */}
        <Grid item xs={12} md={4}>
          {/* Change Password */}
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
                <Key size={18} />
                Security (Change Password)
              </Typography>
              <Divider sx={{ mb: 3 }} />

              {passwordError && (
                <Typography variant="body2" color="error" sx={{ mb: 2, fontWeight: 500 }}>
                  {passwordError}
                </Typography>
              )}
              {passwordSuccess && (
                <Typography variant="body2" color="success.main" sx={{ mb: 2, fontWeight: 500, display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Check size={14} />
                  {passwordSuccess}
                </Typography>
              )}

              <form onSubmit={handleChangePassword}>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    required
                    type="password"
                    label="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <TextField
                    fullWidth
                    required
                    type="password"
                    label="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <Button variant="outlined" type="submit" fullWidth>
                    Update Account Password
                  </Button>
                </Stack>
              </form>
            </CardContent>
          </Card>

          {/* Account Preferences */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
                <Bell size={18} />
                System Settings Preferences
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Stack spacing={2}>
                <FormControlLabel
                  control={<Switch checked={emailNotif} onChange={(e) => setEmailNotif(e.target.checked)} />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>Email Alerts</Typography>
                      <Typography variant="caption" color="text.secondary">Send daily visit logs summary</Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  control={<Switch checked={pushNotif} onChange={(e) => setPushNotif(e.target.checked)} />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>Push Notifications</Typography>
                      <Typography variant="caption" color="text.secondary">Notify on check-ins / overrides</Typography>
                    </Box>
                  }
                />

                <Divider sx={{ my: 1 }} />

                <FormControlLabel
                  control={<Switch checked={true} disabled />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>System Theme</Typography>
                      <Typography variant="caption" color="text.secondary">Always uses SCM Executive Edition theme</Typography>
                    </Box>
                  }
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
