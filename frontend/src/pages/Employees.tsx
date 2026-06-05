import React, { useEffect, useState } from "react";
import { supabase, createAdminSignupClient } from "../utils/supabaseClient";
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem
} from "@mui/material";
import { Plus, ToggleLeft, ToggleRight, KeyRound } from "lucide-react";

export const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);

  // Dialog Controls
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  // Form States
  const [employeeForm, setEmployeeForm] = useState({
    employeeId: "",
    name: "",
    phone: "",
    email: "",
    password: "",
    role: "TELECALLER",
    branch: ""
  });

  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [passwordForm, setPasswordForm] = useState({ password: "" });

  const loadData = async () => {
    try {
      // 1. Load active/inactive employees from users/employees
      const { data: empData, error: empErr } = await supabase
        .from("users")
        .select(`
          user_id,
          full_name,
          phone,
          email,
          role,
          status,
          branch,
          created_at,
          employees (
            employee_id,
            designation,
            joining_date,
            active_status
          )
        `)
        .neq("role", "owner");

      if (empErr) throw empErr;

      // Map employees to match frontend structure
      const mappedEmployees = (empData || []).map((u: any) => {
        const emp = u.employees?.[0];
        return {
          id: u.user_id,
          employeeId: emp?.employee_id || "TC-N/A",
          name: u.full_name,
          phone: u.phone,
          email: u.email,
          role: u.role.toUpperCase(),
          status: u.status.toUpperCase(), // 'ACTIVE' or 'INACTIVE'
          branch: u.branch || "Head Office",
          joiningDate: emp?.joining_date || u.created_at
        };
      });

      setEmployees(mappedEmployees);

    } catch (err) {
      console.error("Error loading employees:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 1. Get logged-in owner's agency ID
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session.");

      const { data: ownerProfile, error: profileErr } = await supabase
        .from("users")
        .select("agency_id")
        .eq("user_id", session.user.id)
        .single();

      if (profileErr || !ownerProfile) throw new Error("Owner profile not found.");

      const agencyId = ownerProfile.agency_id;

      // 2. Sign up the employee using the non-session-persisting secondary client
      const adminClient = createAdminSignupClient();
      const { data: signUpData, error: signUpErr } = await adminClient.auth.signUp({
        email: employeeForm.email,
        password: employeeForm.password,
        options: {
          data: {
            full_name: employeeForm.name,
            phone: employeeForm.phone,
            role: employeeForm.role.toLowerCase(),
            agency_id: agencyId,
            status: "active",
            branch: employeeForm.branch
          }
        }
      });

      if (signUpErr || !signUpData.user) {
        throw new Error(signUpErr?.message || "Failed to create user in Auth system.");
      }

      // 3. Trigger handles public.users creation automatically. Now insert public.employees record.
      const { error: empErr } = await supabase
        .from("employees")
        .insert({
          employee_id: employeeForm.employeeId,
          agency_id: agencyId,
          user_id: signUpData.user.id,
          designation: employeeForm.role,
          active_status: true
        });

      if (empErr) throw empErr;

      setCreateDialogOpen(false);
      setEmployeeForm({ employeeId: "", name: "", phone: "", email: "", password: "", role: "TELECALLER", branch: "" });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to create employee");
    }
  };

  const handleToggleStatus = async (emp: any) => {
    const nextStatus = emp.status === "ACTIVE" ? "inactive" : "active";
    try {
      const { error } = await supabase
        .from("users")
        .update({ status: nextStatus })
        .eq("user_id", emp.id);

      if (error) throw error;
      loadData();
    } catch (err) {
      alert("Failed to toggle status");
    }
  };



  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    try {
      // In production, we send a password reset link to the employee's email
      const { error } = await supabase.auth.resetPasswordForEmail(selectedEmployee.email, {
        redirectTo: `${window.location.origin}/login`
      });
      if (error) throw error;
      alert(`Password reset recovery email has been sent to ${selectedEmployee.email}`);
      setPasswordDialogOpen(false);
      setPasswordForm({ password: "" });
    } catch (err: any) {
      alert(err.message || "Failed to trigger password reset");
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
      {/* Header section */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
            Employees Module
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage agency personnel roles, assign system credentials, and configure access permissions.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setCreateDialogOpen(true)} startIcon={<Plus size={18} />}>
          Add Employee
        </Button>
      </Box>

      <TableContainer component={Paper} className="glass-panel">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Employee Details</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Branch</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Contact Info</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Joining Date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((emp) => (
              <TableRow key={emp.id} hover>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Avatar sx={{ bgcolor: emp.role === "OWNER" ? "secondary.main" : "primary.main", width: 34, height: 34 }}>
                      {emp.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{emp.name}</Typography>
                      <Typography variant="caption" color="text.secondary">ID: {emp.employeeId}</Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={emp.role}
                    size="small"
                    color={emp.role === "OWNER" ? "secondary" : emp.role === "TELECALLER" ? "primary" : "info"}
                    sx={{ fontWeight: 700, fontSize: "0.75rem" }}
                  />
                </TableCell>
                <TableCell>{emp.branch}</TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body2">{emp.email}</Typography>
                    <Typography variant="caption" color="text.secondary">{emp.phone}</Typography>
                  </Box>
                </TableCell>
                <TableCell>{new Date(emp.joiningDate).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Chip
                    label={emp.status}
                    size="small"
                    color={emp.status === "ACTIVE" ? "success" : "default"}
                    sx={{ fontWeight: 700, fontSize: "0.75rem" }}
                  />
                </TableCell>
                <TableCell align="center">
                  <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5 }}>
                    <IconButton onClick={() => { setSelectedEmployee(emp); setPasswordDialogOpen(true); }} title="Change Password" color="primary">
                      <KeyRound size={18} />
                    </IconButton>
                    {emp.role !== "OWNER" && (
                      <IconButton onClick={() => handleToggleStatus(emp)} color={emp.status === "ACTIVE" ? "error" : "success"}>
                        {emp.status === "ACTIVE" ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </IconButton>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            {employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                  <Typography variant="body2" color="text.secondary">No employees listed.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ==========================================
          ADD EMPLOYEE DIALOG
          ========================================== */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogTitle sx={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>Add Employee Account</DialogTitle>
        <form onSubmit={handleCreateEmployee}>
          <DialogContent>
            <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2.5, minWidth: 350 }}>
              <TextField
                label="Employee Custom ID"
                required
                placeholder="e.g. EMP102"
                fullWidth
                value={employeeForm.employeeId}
                onChange={(e) => setEmployeeForm({ ...employeeForm, employeeId: e.target.value })}
              />
              <TextField
                label="Full Name"
                required
                fullWidth
                value={employeeForm.name}
                onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
              />
              <TextField
                label="Email Address"
                type="email"
                required
                fullWidth
                value={employeeForm.email}
                onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
              />
              <TextField
                label="Password"
                type="password"
                required
                fullWidth
                value={employeeForm.password}
                onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })}
              />
              <TextField
                label="Phone Number"
                fullWidth
                value={employeeForm.phone}
                onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
              />
              <TextField
                select
                label="Role"
                required
                fullWidth
                value={employeeForm.role}
                onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })}
              >
                <MenuItem value="TELECALLER">Telecalling Staff</MenuItem>
                <MenuItem value="WORKER">Field Worker / Executive</MenuItem>
              </TextField>
              <TextField
                label="Branch Office"
                fullWidth
                placeholder="e.g. Chennai Office"
                value={employeeForm.branch}
                onChange={(e) => setEmployeeForm({ ...employeeForm, branch: e.target.value })}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Create Account</Button>
          </DialogActions>
        </form>
      </Dialog>



      {/* ==========================================
          CHANGE PASSWORD DIALOG
          ========================================== */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)}>
        <DialogTitle sx={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>Reset Password</DialogTitle>
        <form onSubmit={handleResetPassword}>
          <DialogContent>
            <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 300 }}>
              <Typography variant="body2">
                Set a new password for employee <strong>{selectedEmployee?.name}</strong>:
              </Typography>
              <TextField
                label="New Password"
                type="password"
                required
                fullWidth
                value={passwordForm.password}
                onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Update Password</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};
