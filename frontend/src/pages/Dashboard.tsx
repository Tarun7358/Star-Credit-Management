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
  Chip
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
  const { user, isOwner, isTelecaller, isWorker } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      if (isOwner) {
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
    // 1. Fetch leads
    const { data: leads, error: leadsErr } = await supabase
      .from("leads")
      .select("*")
      .eq("agency_id", agencyId);

    if (leadsErr) throw leadsErr;

    // 2. Fetch pending requests count
    const { count: pendingRequests, error: reqsErr } = await supabase
      .from("employee_requests")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .eq("status", "pending");

    if (reqsErr) throw reqsErr;

    // 3. Recent Activities (limit 5)
    const { data: activities, error: actErr } = await supabase
      .from("lead_activities")
      .select(`
        activity_id,
        activity_type,
        remark,
        timestamp,
        users!inner(full_name, role),
        leads!inner(customer_name)
      `)
      .order("timestamp", { ascending: false })
      .limit(5);

    if (actErr) throw actErr;

    // 4. Telecallers performance
    const { data: telecallers, error: tcErr } = await supabase
      .from("users")
      .select(`
        user_id,
        full_name,
        employees (employee_id)
      `)
      .eq("agency_id", agencyId)
      .eq("role", "telecaller");

    if (tcErr) throw tcErr;

    const telecallerPerformance = [];
    for (const tc of (telecallers || [])) {
      const empId = tc.employees?.[0]?.employee_id || "TC-N/A";
      const tcLeads = (leads || []).filter(l => l.assigned_telecaller === tc.user_id);
      const assignedCount = tcLeads.length;
      const convertedCount = tcLeads.filter(l => l.status === "INTERESTED" || l.status === "COMPLETED").length;
      const conversionRate = assignedCount > 0 ? Math.round((convertedCount / assignedCount) * 100) : 0;
      telecallerPerformance.push({
        id: tc.user_id,
        name: tc.full_name,
        employeeId: empId,
        assignedCount,
        conversionRate
      });
    }

    // Calculate Stats
    const totalLeads = leads?.length || 0;
    const assignedLeadsCount = leads?.filter(l => l.assigned_telecaller || l.assigned_worker).length || 0;
    const interestedLeads = leads?.filter(l => l.status === "INTERESTED").length || 0;
    const completedLeads = leads?.filter(l => l.status === "COMPLETED").length || 0;
    const newLeads = leads?.filter(l => l.status === "NEW").length || 0;

    const stats = {
      totalLeads,
      assignedLeads: assignedLeadsCount,
      interestedLeads,
      completedLeads,
      newLeads,
      pendingRequests: pendingRequests || 0
    };

    // Recent Activities Mapping
    const recentActivities = (activities || []).map((act: any) => ({
      id: act.activity_id,
      user: {
        name: act.users?.full_name || "System",
        role: act.users?.role || "SYSTEM"
      },
      details: `${act.activity_type} - ${act.remark || ""}`,
      lead: {
        customerName: act.leads?.customer_name || "Unknown"
      },
      timestamp: act.timestamp
    }));

    // Loan Breakdown
    const loanTypes = Array.from(new Set((leads || []).map(l => l.loan_type)));
    const loanBreakdown = loanTypes.map(type => {
      const typeLeads = (leads || []).filter(l => l.loan_type === type);
      const amountSum = typeLeads.reduce((acc, curr) => acc + Number(curr.loan_amount || 0), 0);
      return {
        name: type,
        value: typeLeads.length,
        amount: amountSum
      };
    });

    // Status Breakdown
    const statusTypes = Array.from(new Set((leads || []).map(l => l.status)));
    const statusBreakdown = statusTypes.map(st => {
      const count = (leads || []).filter(l => l.status === st).length;
      return {
        name: st,
        value: count
      };
    });

    return {
      stats,
      recentActivities,
      telecallerPerformance,
      loanBreakdown,
      statusBreakdown
    };
  };

  const loadTelecallerDashboardData = async (userId: string, _agencyId: string) => {
    // 1. Fetch leads assigned to telecaller
    const { data: leads, error: leadsErr } = await supabase
      .from("leads")
      .select("*")
      .eq("assigned_telecaller", userId);

    if (leadsErr) throw leadsErr;

    // 2. Fetch followups for this telecaller
    const { data: followups, error: fuErr } = await supabase
      .from("followups")
      .select(`
        followup_id,
        next_followup_date,
        status,
        remarks,
        leads!inner(customer_name, mobile, loan_type)
      `)
      .eq("telecaller_id", userId)
      .order("next_followup_date", { ascending: true });

    if (fuErr) throw fuErr;

    // Stats
    const assignedLeadsCount = leads?.length || 0;
    
    // Today's follow-ups: status = PENDING and date is today (local time)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayFollowUps = (followups || []).filter(fu => {
      const date = new Date(fu.next_followup_date);
      return fu.status === "PENDING" && date >= todayStart && date <= todayEnd;
    }).length;

    const missedFollowUps = (followups || []).filter(fu => {
      const date = new Date(fu.next_followup_date);
      return fu.status === "PENDING" && date < todayStart;
    }).length;

    const convertedCount = (leads || []).filter(l => l.status === "INTERESTED" || l.status === "COMPLETED").length;
    const conversionRate = assignedLeadsCount > 0 ? Math.round((convertedCount / assignedLeadsCount) * 100) : 0;

    const stats = {
      assignedLeadsCount,
      todayFollowUps,
      missedFollowUps,
      conversionRate
    };

    const recentFollowUps = (followups || [])
      .filter(fu => fu.status === "PENDING")
      .slice(0, 5)
      .map((fu: any) => ({
        id: fu.followup_id,
        scheduledTime: fu.next_followup_date,
        notes: fu.remarks,
        lead: {
          customerName: fu.leads?.customer_name || "Unknown",
          mobile: fu.leads?.mobile || "",
          loanType: fu.leads?.loan_type || ""
        }
      }));

    return {
      stats,
      recentFollowUps
    };
  };

  const loadWorkerDashboardData = async (userId: string) => {
    // Fetch leads assigned to worker
    const { data: leads, error: leadsErr } = await supabase
      .from("leads")
      .select("*")
      .eq("assigned_worker", userId);

    if (leadsErr) throw leadsErr;

    const assignedCount = leads?.length || 0;
    const completedCount = leads?.filter(l => l.status === "COMPLETED").length || 0;
    // Pending documents: leads where status is 'READY_FOR_WORKER_VISIT' or 'DOCUMENTS_REQUESTED' or is not completed
    const pendingCount = leads?.filter(l => l.status !== "COMPLETED").length || 0;
    const pendingDocsCount = leads?.filter(l => l.status === "READY_FOR_WORKER_VISIT" || l.status === "DOCUMENTS_REQUESTED").length || 0;

    const stats = {
      assignedCount,
      pendingCount,
      pendingDocsCount,
      completedCount
    };

    const assignedLeads = (leads || []).map((lead: any) => ({
      id: lead.lead_id,
      customerName: lead.customer_name,
      mobile: lead.mobile,
      loanType: lead.loan_type,
      bankName: lead.bank_name,
      address: lead.address,
      workerStatus: lead.status
    }));

    return {
      stats,
      assignedLeads
    };
  };

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to leads channel for real-time dashboard updates
    const channel = supabase
      .channel("dashboard-leads-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads"
        },
        () => {
          console.log("Realtime: leads updated, reloading dashboard...");
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
  const COLORS = ["#6366f1", "#a855f7", "#10b981", "#f59e0b", "#ef4444", "#3b82f6"];

  // ==========================================
  // OWNER DASHBOARD VIEW
  // ==========================================
  const renderOwnerDashboard = () => {
    const { stats, recentActivities, telecallerPerformance, loanBreakdown, statusBreakdown } = data;

    const cards = [
      { title: "Total Leads", value: stats.totalLeads, icon: <FileText size={22} />, color: "#6366f1" },
      { title: "Assigned Leads", value: stats.assignedLeads, icon: <Briefcase size={22} />, color: "#3b82f6" },
      { title: "Interested Leads", value: stats.interestedLeads, icon: <UserCheck size={22} />, color: "#10b981" },
      { title: "Completed Leads", value: stats.completedLeads, icon: <CheckCircle size={22} />, color: "#10b981" },
      { title: "New Lead Pool", value: stats.newLeads, icon: <Clock size={22} />, color: "#f59e0b" },
      { title: "Pending Approvals", value: stats.pendingRequests, icon: <Users size={22} />, color: "#ef4444", link: "/employees" }
    ];

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
        {/* Banner greeting */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
              Welcome Back, {user?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Managing operations for <strong>{user?.agency.name}</strong>. Here is today's overview.
            </Typography>
          </Box>
          <Button variant="contained" component={Link} to="/leads" sx={{ gap: 1 }}>
            Import Leads <ArrowUpRight size={16} />
          </Button>
        </Box>

        {/* Info Metrics Cards Grid */}
        <Grid container spacing={3.5}>
          {cards.map((card) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={card.title}>
              <Card sx={{ height: "100%", class: "glass-card-hover" }}>
                <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1, p: 2.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase" }}>
                      {card.title}
                    </Typography>
                    <Box sx={{ color: card.color }}>{card.icon}</Box>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
                    {card.value}
                  </Typography>
                  {card.link && card.value > 0 && (
                    <Typography variant="caption" sx={{ mt: 0.5 }}>
                      <Link to={card.link} style={{ color: card.color, fontWeight: 700, display: "flex", alignItems: "center", gap: 0.5 }}>
                        Review Requests
                      </Link>
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Charts & Lead Status distribution */}
        <Grid container spacing={3.5}>
          {/* Main area status overview */}
          <Grid item xs={12} md={8}>
            <Card sx={{ p: 1, height: "100%" }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, fontFamily: "'Outfit', sans-serif" }}>
                  Lead Volume by Loan Type
                </Typography>
                <Box sx={{ height: 300 }}>
                  {loanBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={loanBreakdown}>
                        <XAxis dataKey="name" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip contentStyle={{ backgroundColor: "#11131f", borderColor: "#6366f1" }} />
                        <Legend />
                        <Bar dataKey="value" name="Number of Leads" fill="#6366f1" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="amount" name="Capital Value (Lakhs)" fill="#a855f7" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box sx={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
                      <Typography variant="body2" color="text.secondary">No lead data imported yet.</Typography>
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
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, fontFamily: "'Outfit', sans-serif" }}>
                  Status Distribution
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
                        <Tooltip contentStyle={{ backgroundColor: "#11131f" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box sx={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
                      <Typography variant="body2" color="text.secondary">No leads to group.</Typography>
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

        {/* Staff Performance Leaderboards & Timeline Activities */}
        <Grid container spacing={3.5}>
          {/* Telecaller Performance Leaderboard */}
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 1, height: "100%" }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontFamily: "'Outfit', sans-serif" }}>
                  Telecalling Staff Performance
                </Typography>
                <List sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {telecallerPerformance.map((tc: any, index: number) => (
                    <Box key={tc.id}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5, alignItems: "center" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Avatar sx={{ bgcolor: "primary.main", width: 32, height: 32, fontSize: "0.85rem" }}>
                            {tc.name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {tc.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ID: {tc.employeeId} • Leads: {tc.assignedCount}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: "right" }}>
                          <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 800 }}>
                            {tc.conversionRate}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Interested Rate
                          </Typography>
                        </Box>
                      </Box>
                      {index < telecallerPerformance.length - 1 && <Divider sx={{ my: 1.5, opacity: 0.5 }} />}
                    </Box>
                  ))}
                  {telecallerPerformance.length === 0 && (
                    <Typography variant="body2" color="text.secondary">No telecallers added yet.</Typography>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Operations Log Timeline */}
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 1, height: "100%" }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5, fontFamily: "'Outfit', sans-serif" }}>
                  Recent System Activity
                </Typography>
                <List sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {recentActivities.map((act: any, index: number) => (
                    <Box key={act.id}>
                      <Box sx={{ display: "flex", gap: 2 }}>
                        <Avatar sx={{ bgcolor: "secondary.main", width: 28, height: 28, fontSize: "0.8rem" }}>
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
                            {act.details} <strong style={{ color: "#6366f1" }}>({act.lead.customerName})</strong>
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
                    <Typography variant="body2" color="text.secondary">No recent activities recorded.</Typography>
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
      { title: "Assigned Leads", value: stats.assignedLeadsCount, icon: <Briefcase size={22} />, color: "#6366f1" },
      { title: "Today's Follow-ups", value: stats.todayFollowUps, icon: <PhoneCall size={22} />, color: "#10b981" },
      { title: "Missed Follow-ups", value: stats.missedFollowUps, icon: <AlertTriangle size={22} />, color: "#ef4444" },
      { title: "Lead Conversion", value: `${stats.conversionRate}%`, icon: <TrendingUp size={22} />, color: "#a855f7" }
    ];

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
              Telecalling Station: {user?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Update lead details, log remarks, and schedule callbacks.
            </Typography>
          </Box>
          <Button variant="contained" component={Link} to="/leads" sx={{ gap: 1 }}>
            View Lead Sheets
          </Button>
        </Box>

        {/* Dashboard Grid */}
        <Grid container spacing={3}>
          {cards.map((card) => (
            <Grid item xs={12} sm={6} md={3} key={card.title}>
              <Card sx={{ class: "glass-card-hover" }}>
                <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1, p: 2.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase" }}>
                      {card.title}
                    </Typography>
                    <Box sx={{ color: card.color }}>{card.icon}</Box>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
                    {card.value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3.5}>
          {/* List of pending follow-ups */}
          <Grid item xs={12} md={7}>
            <Card sx={{ p: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5, fontFamily: "'Outfit', sans-serif", display: "flex", alignItems: "center", gap: 1 }}>
                  <CalendarDays size={20} color="#6366f1" /> Upcoming scheduled follow-ups
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
                              Mobile: {fu.lead.mobile} • Loan: {fu.lead.loanType}
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
                    <Typography variant="body2" color="text.secondary">No pending follow-ups scheduled.</Typography>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Quick instructions panel */}
          <Grid item xs={12} md={5}>
            <Card sx={{ bgcolor: "rgba(99, 102, 241, 0.03)" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5, color: "primary.main", fontFamily: "'Outfit', sans-serif" }}>
                  Operational Guide
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                  1. Access your assigned leads page from the left navigation panel.<br />
                  2. Dial customer phone lines, log their call outcomes directly.<br />
                  3. If customers request worker visits or document collection, update status to <strong>Documents Requested</strong> or <strong>Ready for Worker</strong>.<br />
                  4. Create callback schedules to ensure no customer is left unattended.
                </Typography>
                <Button variant="outlined" component={Link} to="/leads" fullWidth>
                  Start Telecalling
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
    const { stats, assignedLeads } = data;

    const cards = [
      { title: "Assigned Customers", value: stats.assignedCount, icon: <Briefcase size={22} />, color: "#6366f1" },
      { title: "Pending Visits", value: stats.pendingCount, icon: <Clock size={22} />, color: "#f59e0b" },
      { title: "Pending Documents", value: stats.pendingDocsCount, icon: <AlertTriangle size={22} />, color: "#ef4444" },
      { title: "Completed Cases", value: stats.completedCount, icon: <CheckCircle size={22} />, color: "#10b981" }
    ];

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
              Field Operations: {user?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upload customer documents, update statuses, and log visit notes.
            </Typography>
          </Box>
          <Button variant="contained" component={Link} to="/leads">
            Access My Customers
          </Button>
        </Box>

        {/* Dashboard Grid */}
        <Grid container spacing={3}>
          {cards.map((card) => (
            <Grid item xs={12} sm={6} md={3} key={card.title}>
              <Card sx={{ class: "glass-card-hover" }}>
                <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1, p: 2.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase" }}>
                      {card.title}
                    </Typography>
                    <Box sx={{ color: card.color }}>{card.icon}</Box>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
                    {card.value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3.5}>
          {/* List of assigned leads */}
          <Grid item xs={12} md={8}>
            <Card sx={{ p: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontFamily: "'Outfit', sans-serif" }}>
                  My Active Cases
                </Typography>
                <List sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {assignedLeads.map((lead: any, idx: number) => (
                    <Box key={lead.id}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {lead.customerName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Mobile: {lead.mobile} • Loan: {lead.loanType} ({lead.bankName})
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 500 }}>
                            Address: {lead.address}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                          <Chip
                            label={lead.workerStatus}
                            color={lead.workerStatus === "COMPLETED" ? "success" : "warning"}
                            size="small"
                            sx={{ fontWeight: 700 }}
                          />
                          <Button variant="text" component={Link} to={`/leads?id=${lead.id}`} size="small">
                            Edit Case
                          </Button>
                        </Box>
                      </Box>
                      {idx < assignedLeads.length - 1 && <Divider sx={{ my: 1.5, opacity: 0.5 }} />}
                    </Box>
                  ))}
                  {assignedLeads.length === 0 && (
                    <Typography variant="body2" color="text.secondary">No customer leads assigned to you.</Typography>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Quick instructions panel */}
          <Grid item xs={12} md={4}>
            <Card sx={{ bgcolor: "rgba(168, 85, 247, 0.03)" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5, color: "secondary.main", fontFamily: "'Outfit', sans-serif" }}>
                  Field Instructions
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                  1. Click "Edit Case" next to any customer assigned to you.<br />
                  2. View the customer details and travel address.<br />
                  3. Use the Document Upload interface to upload scanned copies of Aadhaar, PAN, Salary Slip, etc.<br />
                  4. Mark cases as <strong>Completed</strong> once documents are submitted to the banks.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  };

  return isOwner ? renderOwnerDashboard() : isTelecaller ? renderTelecallerDashboard() : renderWorkerDashboard();
};
