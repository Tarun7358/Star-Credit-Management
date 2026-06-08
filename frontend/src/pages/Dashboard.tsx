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
  Stack,
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
  const { user, isOwner, isManager, isTelecaller, isWorker, isClientManager } = useAuth();
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
        const res = await loadTelecallerDashboardData(user.id);
        setData(res);
      } else if (isWorker) {
        const res = await loadWorkerDashboardData(user.id);
        setData(res);
      } else if (isClientManager) {
        const res = await loadClientManagerDashboardData(user.id);
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



  const loadTelecallerDashboardData = async (userId: string) => {
    // 1. Fetch clients assigned to this telecaller
    const { data: clients, error: clientsErr } = await supabase
      .from("clients")
      .select("*")
      .eq("assigned_telecaller", userId)
      .eq("is_archived", false);

    if (clientsErr) throw clientsErr;

    // 2. Fetch all activities logged by this telecaller
    const { data: actData } = await supabase
      .from("customer_activities")
      .select(`
        *,
        clients(customer_name, mobile)
      `)
      .eq("created_by", userId)
      .order("created_at", { ascending: false });

    const activities = actData || [];

    const now = new Date();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const assignedClientsCount = clients?.length || 0;
    const activeCases = (clients || []).filter(c => c.status !== "COMPLETED").length;
    const closedCases = (clients || []).filter(c => c.status === "COMPLETED").length;
    
    const ptpCases = (clients || []).filter(c => c.current_stage === "PTP").length;
    const followupPending = (clients || []).filter(c => c.current_stage === "Follow-Up").length;
    const paymentReceivedCases = (clients || []).filter(c => c.current_stage === "Payment Received").length;

    // Daily Activities
    const callsMadeToday = activities.filter(a => a.activity_type.includes("Call") && new Date(a.created_at) >= todayStart).length;
    const connectedCallsToday = activities.filter(a => a.activity_type.includes("Call") && a.call_result === "Connected" && new Date(a.created_at) >= todayStart).length;
    const newNotesToday = activities.filter(a => a.activity_type === "Note" && new Date(a.created_at) >= todayStart).length;
    const ptpsToday = activities.filter(a => a.outcome === "PTP" && new Date(a.created_at) >= todayStart).length;
    const collectionsToday = activities.filter(a => a.activity_type === "Payment" && new Date(a.created_at) >= todayStart).length;

    // Callbacks
    const pendingCallbacksList = activities.filter(a =>
      a.status === "PENDING" && a.callback_time && new Date(a.callback_time) >= now
    );
    const missedCallbacksCount = activities.filter(a =>
      a.status === "PENDING" && a.callback_time && new Date(a.callback_time) < now
    ).length;

    // Recovery Details
    const monthlyRecoveryAmount = (clients || []).reduce((acc, c) => acc + (parseFloat(c.total_collections) || 0), 0);
    const monthlyTargetAmount = (clients || []).reduce((acc, c) => acc + (parseFloat(c.outstanding_amount) || 0) + (parseFloat(c.total_collections) || 0), 0);
    const recoveryRate = monthlyTargetAmount > 0 ? Math.round((monthlyRecoveryAmount / monthlyTargetAmount) * 100) : 0;

    const stats = {
      assignedClientsCount,
      activeCases,
      closedCases,
      ptpCases,
      followupPending,
      paymentReceivedCases,
      callsMadeToday,
      connectedCallsToday,
      newNotesToday,
      ptpsToday,
      collectionsToday,
      pendingCallbacks: pendingCallbacksList.length,
      missedCallbacks: missedCallbacksCount,
      monthlyRecoveryAmount,
      monthlyTargetAmount,
      recoveryRate
    };

    const recentFollowUps = pendingCallbacksList.slice(0, 5).map((act: any) => ({
      id: act.activity_id,
      scheduledTime: act.callback_time,
      notes: act.notes,
      lead: {
        customerName: act.clients?.customer_name || "Unknown",
        mobile: act.clients?.mobile || ""
      }
    }));

    return { stats, recentFollowUps, clients: clients || [] };
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
    const { stats, recentFollowUps, clients } = data;

    const cards = [
      { title: "Assigned Portfolio", value: stats.assignedClientsCount, detail: `${stats.activeCases} active • ${stats.closedCases} closed`, icon: <Briefcase size={22} />, color: "text.secondary" },
      { title: "Outreach Today", value: stats.callsMadeToday, detail: `${stats.connectedCallsToday} calls connected`, icon: <PhoneCall size={22} />, color: "success.main" },
      { title: "PTPs Recorded Today", value: stats.ptpsToday, detail: `${stats.collectionsToday} payments received`, icon: <CheckCircle size={22} />, color: "primary.main" },
      { title: "Callbacks / Reminders", value: stats.pendingCallbacks, detail: `${stats.missedCallbacks} overdue callback(s)`, icon: <CalendarDays size={22} />, color: stats.missedCallbacks > 0 ? "error.main" : "warning.main" }
    ];

    const ptpClientsList = (clients || []).filter((c: any) => c.current_stage === "PTP");

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
        {/* Welcome Section */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Telecalling Command Center: {user?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Track your daily outreach metrics, schedule follow-up actions, and monitor case closures.
            </Typography>
          </Box>
          <Button variant="contained" component={Link} to="/clients" sx={{ gap: 1, bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#222" } }}>
            Open Client List <ArrowUpRight size={16} />
          </Button>
        </Box>

        {/* Dashboard Core Stats */}
        <Grid container spacing={3}>
          {cards.map((card) => (
            <Grid item xs={12} sm={6} md={3} key={card.title}>
              <Card className="glass-card-hover" sx={{ p: 0.5 }}>
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
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    {card.detail}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Core Layout Split */}
        <Grid container spacing={3.5}>
          {/* Left Panel: Callbacks and PTP List */}
          <Grid item xs={12} md={8} sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
            {/* Scheduled Callbacks */}
            <Card sx={{ p: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5, display: "flex", alignItems: "center", gap: 1 }}>
                  <CalendarDays size={20} /> Upcoming Callbacks & Reminders
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
                              Notes: "{fu.notes || "No callback notes recorded."}"
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
                                OVERDUE REMINDER
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

            {/* PTP Cases Portfolio */}
            <Card sx={{ p: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Your Promise-To-Pay (PTP) Ledger
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 260, overflowY: "auto" }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ bgcolor: "#F8F8F8" }}>
                        <TableCell sx={{ fontWeight: 700 }}>Customer Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Outstanding Balance</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Total Collections</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>PTP Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ptpClientsList.length > 0 ? (
                        ptpClientsList.map((client: any) => (
                          <TableRow key={client.client_id} hover>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{client.customer_name}</Typography>
                              <Typography variant="caption" color="text.secondary">{client.mobile}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>₹{client.outstanding_amount}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: "success.main" }}>₹{client.total_collections || 0}</Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={`${client.progress_percentage}% Progress`} 
                                size="small" 
                                color="primary" 
                                sx={{ fontWeight: 700, fontSize: "10px" }} 
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                              No active cases in the PTP stage.
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

          {/* Right Panel: Recovery Target Progress & Guidelines */}
          <Grid item xs={12} md={4} sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
            {/* Monthly Target Progression */}
            <Card sx={{ p: 2 }}>
              <CardContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, alignSelf: "flex-start" }}>
                  Monthly Recovery Target
                </Typography>
                <Box sx={{ position: "relative", display: "inline-flex", mt: 2 }}>
                  <CircularProgress
                    variant="determinate"
                    value={stats.recoveryRate}
                    size={140}
                    thickness={6}
                    sx={{
                      color: "primary.main",
                      "& .MuiCircularProgress-circle": {
                        strokeLinecap: "round"
                      }
                    }}
                  />
                  <Box
                    sx={{
                      top: 0,
                      left: 0,
                      bottom: 0,
                      right: 0,
                      position: "absolute",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      {stats.recoveryRate}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Recovery Rate
                    </Typography>
                  </Box>
                </Box>
                <Stack spacing={1} sx={{ width: "100%", mt: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="caption" color="text.secondary">Total Collected</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: "success.main" }}>₹{stats.monthlyRecoveryAmount}</Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="caption" color="text.secondary">Total Portfolio Value</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>₹{stats.monthlyTargetAmount}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Quick Actions Guide */}
            <Card sx={{ bgcolor: "var(--panel-bg)" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5, color: "primary.main" }}>
                  Telecalling Guidelines
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                  • Open client files to review their current pipeline step and historical worker logs.<br />
                  • Always log call outcomes to trigger live state updates.<br />
                  • Utilize <strong>Schedule Follow-Up</strong> to queue reminders for clients requesting callbacks.<br />
                  • Ensure Promises to Pay are registered with exact payment amounts and expected dates.
                </Typography>
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

  const renderClientManagerDashboard = () => {
    if (!data) return null;
    const { stats, recentActivities, employeeActivity, priorityBreakdown, statusBreakdown } = data;
    const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {/* Welcome Section */}
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Client Portfolio Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Performance analytics, tracking, and recovery status for your assigned accounts.
          </Typography>
        </Box>

        {/* Stats Grid */}
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ p: 1 }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Avatar sx={{ bgcolor: "primary.main", width: 44, height: 44 }}>
                  <Briefcase size={22} />
                </Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary">Assigned Accounts</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>{stats.assignedClients}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ p: 1 }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Avatar sx={{ bgcolor: "success.main", width: 44, height: 44 }}>
                  <CheckCircle size={22} />
                </Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary">Closed Cases</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>{stats.closedCases}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ p: 1 }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Avatar sx={{ bgcolor: "warning.main", width: 44, height: 44 }}>
                  <Clock size={22} />
                </Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary">Recovery Rate</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>{stats.recoveryRate}%</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ p: 1 }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Avatar sx={{ bgcolor: "info.main", width: 44, height: 44 }}>
                  <TrendingUp size={22} />
                </Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Operations</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>{stats.callsCompleted + stats.fieldVisits}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Charts Section */}
        <Grid container spacing={3.5}>
          {/* Recovery Trends / Priority Breakdown */}
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 1, height: "100%" }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                  Priority Case Distribution
                </Typography>
                <Box sx={{ width: "100%", height: 260 }}>
                  {priorityBreakdown.length > 0 ? (
                    <ResponsiveContainer>
                      <BarChart data={priorityBreakdown}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={45} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                      <Typography variant="body2" color="text.secondary">No priority data found</Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Case Status Distribution */}
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 1, height: "100%" }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                  Case Status Breakdown
                </Typography>
                <Box sx={{ width: "100%", height: 220, display: "flex", justifyContent: "center", alignItems: "center" }}>
                  {statusBreakdown.length > 0 ? (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={statusBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {statusBreakdown.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No status data found</Typography>
                  )}
                </Box>
                {/* Custom Legends */}
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1, justifyContent: "center" }}>
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

        {/* Team Activity and Recent Interactions */}
        <Grid container spacing={3.5}>
          {/* Staff Performance Summary Table */}
          <Grid item xs={12} md={7}>
            <Card sx={{ p: 1, height: "100%" }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Assigned Team Performance
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
                              No staff activity logged on your cases yet.
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
                  Recent Portfolio Interactions
                </Typography>
                <List sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {recentActivities.map((act: any) => (
                    <Box key={act.id}>
                      <Box sx={{ display: "flex", gap: 2 }}>
                        <Avatar sx={{ bgcolor: "divider", color: "text.primary", width: 28, height: 28, fontSize: "0.8rem" }}>
                          {act.user.name.charAt(0)}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, display: "inline-block", mr: 1 }}>
                            {act.user.name}
                          </Typography>
                          <Chip label={act.user.role} size="small" sx={{ fontSize: "9px", height: "16px" }} />
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {act.details} for <strong>{act.lead.customerName}</strong>
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(act.timestamp).toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  ))}
                  {recentActivities.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No interactions recorded on your cases.
                    </Typography>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  };

  const loadClientManagerDashboardData = async (userId: string) => {
    // 1. Fetch active clients where client_manager_id = userId
    const { data: clients, error: clientsErr } = await supabase
      .from("clients")
      .select("*")
      .eq("client_manager_id", userId)
      .eq("is_archived", false);

    if (clientsErr) throw clientsErr;

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

    // 2. Fetch users who have performed activities on these cases to track team performance
    const uniqueWorkerIds = Array.from(new Set(activities.map(a => a.created_by).filter(Boolean)));
    let staffUsers: any[] = [];
    if (uniqueWorkerIds.length > 0) {
      const { data: usersList, error: usersErr } = await supabase
        .from("users")
        .select(`
          user_id,
          full_name,
          role,
          employees (employee_id)
        `)
        .in("user_id", uniqueWorkerIds);

      if (!usersErr && usersList) {
        staffUsers = usersList;
      }
    }

    // Calculate metrics
    const callsCompleted = activities.filter(a => a.activity_type.includes("Call") && a.status !== "PENDING").length;
    const fieldVisits = activities.filter(
      a =>
        (a.activity_type === "Field Visit" ||
          a.activity_type === "Customer Meeting" ||
          a.activity_type === "Address Verification") &&
        a.status !== "PENDING"
    ).length;
    const closedCases = (clients || []).filter(c => c.status === "COMPLETED").length;
    
    // Recovery rate (closed / total)
    const recoveryRate = clients?.length ? Math.round((closedCases / clients.length) * 100) : 0;

    const stats = {
      assignedClients: clients?.length || 0,
      callsCompleted,
      fieldVisits,
      closedCases,
      recoveryRate
    };

    // Employee Activity Summary calculation
    const employeeActivity: any[] = [];
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

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        <CircularProgress color="inherit" />
      </Box>
    );
  }

  return (isOwner || isManager)
    ? renderOwnerDashboard()
    : isTelecaller
    ? renderTelecallerDashboard()
    : isWorker
    ? renderWorkerDashboard()
    : isClientManager
    ? renderClientManagerDashboard()
    : null;
  };
