import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../utils/supabaseClient";
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Avatar,
  Divider,
  Button,
  List,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from "@mui/material";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";
import {
  Users,
  FileText,
  CheckCircle,
  Clock,
  Briefcase,
  AlertTriangle,
  ArrowUpRight,
  UserCheck,
  PhoneCall,
  CalendarDays,
  TrendingUp
} from "lucide-react";
import { Link } from "react-router-dom";

export const Dashboard: React.FC = () => {
  const { user, isOwner, isManager, isTelecaller, isWorker } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      if (isOwner || isManager) {
        const res = await loadOwnerDashboardData(user.agency.id);
        setData(res);
      } else if (isTelecaller) {
        const res = await loadTelecallerDashboardData(user.id, user.agency.id);
        setData(res);
      } else if (isWorker) {
        const res = await loadWorkerDashboardData(user.id);
        setData(res);
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadOwnerDashboardData = async (agencyId: string) => {
    // 1. Fetch active clients
    const { data: clients, error: clientsErr } = await supabase
      .from("clients")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("is_archived", false);

    if (clientsErr) throw clientsErr;

    // 2. Fetch pending requests
    const { count: pendingRequests, error: reqsErr } = await supabase
      .from("employee_requests")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .eq("status", "pending");

    if (reqsErr) throw reqsErr;

    // 3. Fetch users for agency
    const { data: usersList, error: usersErr } = await supabase
      .from("users")
      .select(`
        user_id,
        full_name,
        role,
        employees (employee_id)
      `)
      .eq("agency_id", agencyId);

    if (usersErr) throw usersErr;

    // 4. Fetch activities for all active clients
    const clientIds = (clients || []).map(c => c.client_id);
    let activities: any[] = [];
    if (clientIds.length > 0) {
      const { data: actData, error: actErr } = await supabase
        .from("customer_activities")
        .select(`
          activity_id,
          activity_type,
          call_result,
          outcome,
          notes,
          callback_time,
          status,
          created_at,
          created_by,
          creator:users!customer_activities_created_by_fkey(full_name, role),
          clients!inner(customer_name)
        `)
        .in("client_id", clientIds)
        .order("created_at", { ascending: false });

      if (actErr) throw actErr;
      activities = actData || [];
    }

    // Calculate metrics
    const callsCompleted = activities.filter(a => a.activity_type.includes("Call") && a.status !== "PENDING").length;
    const pendingFollowUps = activities.filter(a => a.status === "PENDING").length;
    const scheduledCallbacks = activities.filter(
      a => a.status === "PENDING" && a.callback_time && new Date(a.callback_time) > new Date()
    ).length;
    const fieldVisits = activities.filter(
      a =>
        (a.activity_type === "Field Visit" ||
          a.activity_type === "Customer Meeting" ||
          a.activity_type === "Address Verification") &&
        a.status !== "PENDING"
    ).length;
    const closedCases = (clients || []).filter(c => c.status === "COMPLETED").length;

    const stats = {
      assignedClients: clients?.length || 0,
      callsCompleted,
      pendingFollowUps,
      scheduledCallbacks,
      fieldVisits,
      closedCases,
      pendingRequests: pendingRequests || 0
    };

    // Employee Activity Summary calculation
    const employeeActivity: any[] = [];
    const staffUsers = (usersList || []).filter(u => u.role === "worker" || u.role === "telecaller");
    
    staffUsers.forEach((u) => {
      const empId = u.employees?.[0]?.employee_id || "N/A";
      const uCalls = activities.filter(
        a => a.created_by === u.user_id && a.activity_type.includes("Call") && a.status !== "PENDING"
      ).length;
      const uVisits = activities.filter(
        a =>
          a.created_by === u.user_id &&
          (a.activity_type === "Field Visit" ||
            a.activity_type === "Customer Meeting" ||
            a.activity_type === "Address Verification") &&
          a.status !== "PENDING"
      ).length;

      employeeActivity.push({
        id: u.user_id,
        name: u.full_name,
        role: u.role,
        employeeId: empId,
        callsCount: uCalls,
        visitsCount: uVisits
      });
    });

    // Recent activities (limit 5)
    const recentActivities = activities.slice(0, 5).map((act: any) => ({
      id: act.activity_id,
      user: {
        name: act.creator?.full_name || "System",
        role: act.creator?.role || "SYSTEM"
      },
      details: `${act.activity_type} - ${act.notes || ""}`,
      lead: {
        customerName: act.clients?.customer_name || act.client_name || "Unknown"
      },
      timestamp: act.created_at
    }));

    // Status breakdown for Pie Chart
    const statusTypes = Array.from(new Set((clients || []).map(c => c.status || "NEW_LEAD")));
    const statusBreakdown = statusTypes.map(st => {
      const count = (clients || []).filter(c => (c.status || "NEW_LEAD") === st).length;
      return {
        name: st,
        value: count
      };
    });

    // Priority breakdown for Bar Chart
    const priorityTypes = Array.from(new Set((clients || []).map(c => c.priority || "Normal")));
    const priorityBreakdown = priorityTypes.map(p => {
      const count = (clients || []).filter(c => (c.priority || "Normal") === p).length;
      return {
        name: p,
        value: count
      };
    });

    return {
      stats,
      recentActivities,
      employeeActivity,
      priorityBreakdown,
      statusBreakdown
    };
  };



  const loadTelecallerDashboardData = async (userId: string, agencyId: string) => {
    // 1. Fetch clients assigned to this telecaller
    const { data: clients, error: clientsErr } = await supabase
      .from("clients")
      .select("*")
      .eq("assigned_telecaller", userId)
      .eq("is_archived", false);

    if (clientsErr) throw clientsErr;

    const clientIds = (clients || []).map(c => c.client_id);

    // 2. Fetch activities logged by this telecaller
    let activities: any[] = [];
    if (clientIds.length > 0) {
      const { data: actData } = await supabase
        .from("customer_activities")
        .select("*")
        .in("client_id", clientIds)
        .order("created_at", { ascending: false });
      activities = actData || [];
    }

    const now = new Date();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const assignedClientsCount = clients?.length || 0;
    const callsDoneToday = activities.filter(a => {
      const d = new Date(a.created_at);
      return a.activity_type.includes("Call") && d >= todayStart && d <= todayEnd && a.status === "RECORDED";
    }).length;

    const pendingCallbacks = activities.filter(a =>
      a.status === "PENDING" && a.callback_time && new Date(a.callback_time) >= now
    );
    const missedCallbacks = activities.filter(a =>
      a.status === "PENDING" && a.callback_time && new Date(a.callback_time) < now
    ).length;

    const closedCases = (clients || []).filter(c => c.status === "COMPLETED").length;
    const conversionRate = assignedClientsCount > 0 ? Math.round((closedCases / assignedClientsCount) * 100) : 0;

    const stats = {
      assignedClientsCount,
      callsDoneToday,
      pendingCallbacks: pendingCallbacks.length,
      missedCallbacks,
      conversionRate,
      closedCases
    };

    const recentFollowUps = pendingCallbacks.slice(0, 5).map((act: any) => ({
      id: act.activity_id,
      scheduledTime: act.callback_time,
      notes: act.notes,
      lead: {
        customerName: act.client_name || "Unknown",
        mobile: act.client_mobile || ""
      }
    }));

    return { stats, recentFollowUps };
  };

  const loadWorkerDashboardData = async (userId: string) => {
    // Fetch clients assigned to this worker
    const { data: clients, error: clientsErr } = await supabase
      .from("clients")
      .select("*")
      .eq("assigned_worker", userId)
      .eq("is_archived", false);

    if (clientsErr) throw clientsErr;

    const clientIds = (clients || []).map(c => c.client_id);

    // Fetch this worker's activities
    let activities: any[] = [];
    if (clientIds.length > 0) {
      const { data: actData } = await supabase
        .from("customer_activities")
        .select("*")
        .in("client_id", clientIds)
        .eq("created_by", userId)
        .order("created_at", { ascending: false });
      activities = actData || [];
    }

    const assignedCount = clients?.length || 0;
    const completedCount = (clients || []).filter(c => c.status === "COMPLETED").length;
    const pendingCount = (clients || []).filter(c => c.status !== "COMPLETED").length;
    const fieldVisitsDone = activities.filter(
      a => (a.activity_type === "Field Visit" || a.activity_type === "Customer Meeting" || a.activity_type === "Address Verification") && a.status === "RECORDED"
    ).length;
    const pendingFollowUps = activities.filter(a => a.status === "PENDING").length;

    const stats = { assignedCount, pendingCount, completedCount, fieldVisitsDone, pendingFollowUps };

    const assignedClients = (clients || []).map((c: any) => ({
      id: c.client_id,
      customerName: c.customer_name,
      mobile: c.mobile,
      priority: c.priority || "Normal",
      address: c.address,
      workerStatus: c.status
    }));

    return { stats, assignedClients };
  };

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to clients + activities channels for real-time dashboard updates
    const clientsChannel = supabase
      .channel("dashboard-clients-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => {
        fetchDashboardData();
      })
      .subscribe();

    const activitiesChannel = supabase
      .channel("dashboard-activities-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "customer_activities" }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(clientsChannel);
      supabase.removeChannel(activitiesChannel);
    };
  }, [user]);

  if (loading || !data) {
    return (
      <Box sx={{ display: "flex", flexGrow: 1, alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <CircularProgress size={50} />
      </Box>
    );
  }

  // Define colors for Pie Charts
  const COLORS = ["#111827", "#6b7280", "#9ca3af", "#10b981", "#f59e0b", "#ef4444"];

  // ==========================================
  // OWNER / MANAGER DASHBOARD VIEW
  // ==========================================
  const renderOwnerDashboard = () => {
    const { stats, recentActivities, employeeActivity, priorityBreakdown, statusBreakdown } = data;

    const cards = [
      { title: "Active Clients", value: stats.assignedClients, icon: <FileText size={22} />, color: "text.primary" },
      { title: "Calls Completed", value: stats.callsCompleted, icon: <PhoneCall size={22} />, color: "success.main" },
      { title: "Pending Follow-Ups", value: stats.pendingFollowUps, icon: <Clock size={22} />, color: "warning.main" },
      { title: "Upcoming Callbacks", value: stats.scheduledCallbacks, icon: <CalendarDays size={22} />, color: "text.secondary" },
      { title: "Field Visits", value: stats.fieldVisits, icon: <UserCheck size={22} />, color: "text.primary" },
      { title: "Pending Approvals", value: stats.pendingRequests, icon: <Users size={22} />, color: "error.main", link: "/employees" }
    ];

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
        {/* Banner greeting */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Welcome Back, {user?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isManager ? "Manager Dashboard" : "Owner Dashboard"} – <strong>{user?.agency.name}</strong>. Here is today's overview.
            </Typography>
          </Box>
          <Button variant="contained" component={Link} to="/clients" sx={{ gap: 1, bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#222" } }}>
            View Clients <ArrowUpRight size={16} />
          </Button>
        </Box>

        {/* Info Metrics Cards Grid */}
        <Grid container spacing={3.5}>
          {cards.map((card) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={card.title}>
              <Card sx={{ height: "100%" }} className="glass-card-hover">
                <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1, p: 2.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase" }}>
                      {card.title}
                    </Typography>
                    <Box sx={{ color: card.color }}>{card.icon}</Box>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {card.value}
                  </Typography>
                  {card.link && card.value > 0 && (
                    <Typography variant="caption" sx={{ mt: 0.5 }}>
                      <Link to={card.link} style={{ color: "inherit", fontWeight: 700, display: "flex", alignItems: "center", gap: 0.5 }}>
                        Review Requests
                      </Link>
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Charts & Client Status distribution */}
        <Grid container spacing={3.5}>
          {/* Priority Bar Chart */}
          <Grid item xs={12} md={8}>
            <Card sx={{ p: 1, height: "100%" }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                  Client Volume by Priority Level
                </Typography>
                <Box sx={{ height: 300 }}>
                  {priorityBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={priorityBreakdown}>
                        <XAxis dataKey="name" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip contentStyle={{ backgroundColor: "var(--panel-bg)", borderColor: "var(--border-color)", borderRadius: "8px" }} />
                        <Legend />
                        <Bar dataKey="value" name="Number of Clients" fill="#111827" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box sx={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
                      <Typography variant="body2" color="text.secondary">No client data imported yet.</Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Status Breakdown Pie */}
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 1, height: "100%" }}>
              <CardContent sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                  Case Status Distribution
                </Typography>
                <Box sx={{ height: 200, flexGrow: 1, position: "relative" }}>
                  {statusBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {statusBreakdown.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "var(--panel-bg)", borderRadius: "8px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box sx={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
                      <Typography variant="body2" color="text.secondary">No cases to group.</Typography>
                    </Box>
                  )}
                </Box>
                {/* Custom Legends */}
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 2, justifyContent: "center" }}>
                  {statusBreakdown.map((item: any, idx: number) => (
                    <Chip
                      key={item.name}
                      label={`${item.name}: ${item.value}`}
                      size="small"
                      sx={{ bgcolor: `${COLORS[idx % COLORS.length]}20`, color: COLORS[idx % COLORS.length], border: `1px solid ${COLORS[idx % COLORS.length]}50` }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Employee Activity Summary & Recent Operations */}
        <Grid container spacing={3.5}>
          {/* Employee Activity Summary Table */}
          <Grid item xs={12} md={7}>
            <Card sx={{ p: 1, height: "100%" }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Employee Activity Summary
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320, overflowY: "auto" }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ bgcolor: "#F8F8F8" }}>
                        <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Emp. ID</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="center">Calls Made</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="center">Field Visits</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {employeeActivity.length > 0 ? (
                        employeeActivity.map((emp: any) => (
                          <TableRow key={emp.id} hover>
                            <TableCell>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Avatar sx={{ width: 28, height: 28, fontSize: "0.8rem", bgcolor: "#111827", color: "#fff" }}>
                                  {emp.name.charAt(0)}
                                </Avatar>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{emp.name}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip label={emp.role} size="small" variant="outlined" sx={{ textTransform: "capitalize", fontSize: "10px" }} />
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">{emp.employeeId}</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" sx={{ fontWeight: 700, color: emp.callsCount > 0 ? "success.main" : "text.secondary" }}>
                                {emp.callsCount}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" sx={{ fontWeight: 700, color: emp.visitsCount > 0 ? "primary.main" : "text.secondary" }}>
                                {emp.visitsCount}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                              No staff activity logged yet.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Activity Feed */}
          <Grid item xs={12} md={5}>
            <Card sx={{ p: 1, height: "100%" }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5 }}>
                  Recent Customer Interactions
                </Typography>
                <List sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {recentActivities.map((act: any, index: number) => (
                    <Box key={act.id}>
                      <Box sx={{ display: "flex", gap: 2 }}>
                        <Avatar sx={{ bgcolor: "divider", color: "text.primary", width: 28, height: 28, fontSize: "0.8rem" }}>
                          {act.user.name.charAt(0)}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, display: "inline-block", mr: 1 }}>
                            {act.user.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "capitalize" }}>
                            ({act.user.role.toLowerCase()})
                          </Typography>
                          <Typography variant="body2" sx={{ my: 0.5, color: "text.primary", fontWeight: 500 }}>
                            {act.details} <strong style={{ color: "#111827" }}>({act.lead.customerName})</strong>
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(act.timestamp).toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                      {index < recentActivities.length - 1 && <Divider sx={{ my: 2, opacity: 0.5 }} />}
                    </Box>
                  ))}
                  {recentActivities.length === 0 && (
                    <Typography variant="body2" color="text.secondary">No recent interactions recorded.</Typography>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  };

  // ==========================================
  // TELECALLER DASHBOARD VIEW
  // ==========================================
  const renderTelecallerDashboard = () => {
    const { stats, recentFollowUps } = data;

    const cards = [
      { title: "Assigned Clients", value: stats.assignedClientsCount, icon: <Briefcase size={22} />, color: "text.secondary" },
      { title: "Calls Today", value: stats.callsDoneToday, icon: <PhoneCall size={22} />, color: "success.main" },
      { title: "Pending Callbacks", value: stats.pendingCallbacks, icon: <CalendarDays size={22} />, color: "warning.main" },
      { title: "Missed Callbacks", value: stats.missedCallbacks, icon: <AlertTriangle size={22} />, color: "error.main" },
      { title: "Closed Cases", value: stats.closedCases, icon: <CheckCircle size={22} />, color: "success.main" },
      { title: "Conversion Rate", value: `${stats.conversionRate}%`, icon: <TrendingUp size={22} />, color: "text.primary" }
    ];

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Telecalling Station: {user?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Log call outcomes, schedule callbacks, and track your assigned clients.
            </Typography>
          </Box>
          <Button variant="contained" component={Link} to="/clients" sx={{ gap: 1, bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#222" } }}>
            View My Clients
          </Button>
        </Box>

        {/* Dashboard Grid */}
        <Grid container spacing={3}>
          {cards.map((card) => (
            <Grid item xs={12} sm={6} md={2} key={card.title}>
              <Card className="glass-card-hover">
                <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1, p: 2.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase" }}>
                      {card.title}
                    </Typography>
                    <Box sx={{ color: card.color }}>{card.icon}</Box>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {card.value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3.5}>
          {/* List of pending callbacks */}
          <Grid item xs={12} md={7}>
            <Card sx={{ p: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5, display: "flex", alignItems: "center", gap: 1 }}>
                  <CalendarDays size={20} /> Upcoming Scheduled Callbacks
                </Typography>
                <List sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {recentFollowUps.map((fu: any, idx: number) => {
                    const isOverdue = new Date(fu.scheduledTime) < new Date();
                    return (
                      <Box key={fu.id}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {fu.lead.customerName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Mobile: {fu.lead.mobile}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5, color: "text.primary", fontWeight: 500 }}>
                              Notes: "{fu.notes || "No extra instruction."}"
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: "right" }}>
                            <Chip
                              label={new Date(fu.scheduledTime).toLocaleString()}
                              size="small"
                              color={isOverdue ? "error" : "primary"}
                              sx={{ fontWeight: 600, fontSize: "0.75rem" }}
                            />
                            {isOverdue && (
                              <Typography variant="caption" color="error.main" sx={{ display: "block", mt: 0.5, fontWeight: 700 }}>
                                MISSED/OVERDUE
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        {idx < recentFollowUps.length - 1 && <Divider sx={{ my: 1.5, opacity: 0.5 }} />}
                      </Box>
                    );
                  })}
                  {recentFollowUps.length === 0 && (
                    <Typography variant="body2" color="text.secondary">No pending callbacks scheduled. All caught up! ✅</Typography>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Quick guide */}
          <Grid item xs={12} md={5}>
            <Card sx={{ bgcolor: "var(--panel-bg)" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5, color: "primary.main" }}>
                  Operational Guide
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                  1. Open a client file from the <strong>Clients</strong> page.<br />
                  2. Log each call outcome — Connected, No Answer, Callback Requested, etc.<br />
                  3. When a customer requests a callback, schedule the date & time.<br />
                  4. Check this dashboard daily for missed callbacks and overdue follow-ups.
                </Typography>
                <Button variant="outlined" component={Link} to="/clients" fullWidth>
                  Open Client List
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  };

  // ==========================================
  // FIELD WORKER DASHBOARD VIEW
  // ==========================================
  const renderWorkerDashboard = () => {
    const { stats, assignedClients } = data;

    const cards = [
      { title: "Assigned Clients", value: stats.assignedCount, icon: <Briefcase size={22} />, color: "text.secondary" },
      { title: "Pending Cases", value: stats.pendingCount, icon: <Clock size={22} />, color: "warning.main" },
      { title: "Field Visits Done", value: stats.fieldVisitsDone, icon: <UserCheck size={22} />, color: "text.primary" },
      { title: "Pending Follow-Ups", value: stats.pendingFollowUps, icon: <AlertTriangle size={22} />, color: "error.main" },
      { title: "Completed Cases", value: stats.completedCount, icon: <CheckCircle size={22} />, color: "success.main" }
    ];

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Field Operations: {user?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Log field visits, update case statuses, and track your assigned clients.
            </Typography>
          </Box>
          <Button variant="contained" component={Link} to="/clients" sx={{ bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#222" } }}>
            My Client Cases
          </Button>
        </Box>

        {/* Dashboard Grid */}
        <Grid container spacing={3}>
          {cards.map((card) => (
            <Grid item xs={12} sm={6} md={2.4} key={card.title}>
              <Card className="glass-card-hover">
                <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1, p: 2.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase" }}>
                      {card.title}
                    </Typography>
                    <Box sx={{ color: card.color }}>{card.icon}</Box>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {card.value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3.5}>
          {/* List of assigned clients */}
          <Grid item xs={12} md={8}>
            <Card sx={{ p: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  My Active Cases
                </Typography>
                <List sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {(assignedClients || []).map((client: any, idx: number) => (
                    <Box key={client.id}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {client.customerName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Mobile: {client.mobile} • Priority: {client.priority}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 500 }}>
                            Address: {client.address || "—"}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                          <Chip
                            label={client.workerStatus}
                            color={client.workerStatus === "COMPLETED" ? "success" : "warning"}
                            size="small"
                            sx={{ fontWeight: 700 }}
                          />
                          <Button variant="text" component={Link} to="/clients" size="small">
                            Open Case
                          </Button>
                        </Box>
                      </Box>
                      {idx < (assignedClients || []).length - 1 && <Divider sx={{ my: 1.5, opacity: 0.5 }} />}
                    </Box>
                  ))}
                  {(assignedClients || []).length === 0 && (
                    <Typography variant="body2" color="text.secondary">No client cases assigned to you yet.</Typography>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Quick instructions panel */}
          <Grid item xs={12} md={4}>
            <Card sx={{ bgcolor: "var(--panel-bg)" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5, color: "primary.main" }}>
                  Field Instructions
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                  1. Open a client case from the <strong>Clients</strong> page.<br />
                  2. Navigate to the customer address using the <strong>Navigate</strong> button.<br />
                  3. Once at the customer location, select <strong>Field Visit</strong> and verify your GPS.<br />
                  4. Log your visit outcome and any notes.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  };

  return (isOwner || isManager) ? renderOwnerDashboard() : isTelecaller ? renderTelecallerDashboard() : renderWorkerDashboard();
};
