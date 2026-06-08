import { useEffect, useState, useRef } from "react";
import { supabase } from "../utils/supabaseClient";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Divider,
  Stack,
  Button
} from "@mui/material";
import { Users, Calendar, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

declare const L: any; // Reference global Leaflet

export default function VisitsLive() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    activeWorkers: 0,
    todayVisits: 0,
    completedVisits: 0,
    pendingVisits: 0,
    followUpsRequired: 0
  });
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const mapRef = useRef<any>(null);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch agency_id
      const { data: profile } = await supabase
        .from("users")
        .select("agency_id")
        .eq("user_id", session.user.id)
        .single();
      if (!profile) return;

      const agencyId = profile.agency_id;

      // Today's boundaries
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startIso = startOfDay.toISOString();

      // Fetch clients
      const { data: clientRows } = await supabase
        .from("clients")
        .select("client_id, customer_name, latitude, longitude, address, assigned_worker, status, outstanding_amount")
        .eq("agency_id", agencyId);

      // Fetch visits today
      const { data: visitRows } = await supabase
        .from("customer_visits")
        .select(`
          *,
          client:clients(customer_name, latitude, longitude),
          worker:users!customer_visits_worker_id_fkey(full_name)
        `)
        .gte("check_in_time", startIso);

      const activeClients = clientRows || [];
      const activeVisits = visitRows || [];

      // Calculate Metrics
      const uniqueWorkers = new Set(activeVisits.map((v) => v.worker_id)).size;
      const totalVisits = activeVisits.length;
      const completed = activeVisits.filter((v) => v.check_out_time !== null).length;
      
      const pendingList = activeClients.filter((c) => {
        const hasVisitToday = activeVisits.some((v) => v.client_id === c.client_id);
        return c.assigned_worker && !hasVisitToday;
      });

      const followUps = activeVisits.filter(
        (v) => v.outcome === "Follow-Up Required" || v.final_status === "FOLLOW_UP"
      ).length;

      setMetrics({
        activeWorkers: uniqueWorkers,
        todayVisits: totalVisits,
        completedVisits: completed,
        pendingVisits: pendingList.length,
        followUpsRequired: followUps
      });

      setVisits(activeVisits);
      setClients(activeClients);

      // Status Analytics Chart Data
      const categories: Record<string, number> = {
        "Met Customer": 0,
        "Payment Collected": 0,
        "Promise To Pay": 0,
        "Follow-Up Required": 0,
        "Settlement Discussion": 0,
        "Correction Request Raised": 0,
        "Case Closed": 0,
        "House Locked / Not Home": 0
      };

      activeVisits.forEach((v) => {
        if (v.outcome) {
          if (v.outcome in categories) {
            categories[v.outcome]++;
          } else if (v.category === "CUSTOMER_NOT_AVAILABLE") {
            categories["House Locked / Not Home"]++;
          }
        }
      });

      const chartData = Object.entries(categories).map(([name, value]) => ({
        name,
        value
      }));
      setAnalytics(chartData);

    } catch (err) {
      console.error("Failed to load live tracking details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Initialize Map
  useEffect(() => {
    if (loading) return;

    // Wait for container to render
    setTimeout(() => {
      const container = document.getElementById("visits-map");
      if (!container) return;

      // Clear previous map instance if exists
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      // Initialize Leaflet Map
      // Default center around Bangalore (12.9716, 77.5946) or first valid client coordinates
      const firstValidClient = clients.find((c) => c.latitude && c.longitude);
      const centerLat = firstValidClient ? parseFloat(firstValidClient.latitude) : 12.9716;
      const centerLng = firstValidClient ? parseFloat(firstValidClient.longitude) : 77.5946;

      const map = L.map("visits-map").setView([centerLat, centerLng], 12);
      mapRef.current = map;

      // Add OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);

      // Define icons
      const clientIcon = L.divIcon({
        className: "custom-map-icon client-pin",
        html: '<div style="background-color: #000000; border: 2px solid #ffffff; width: 12px; height: 12px; border-radius: 50%;"></div>',
        iconSize: [12, 12]
      });

      const workerIcon = L.divIcon({
        className: "custom-map-icon worker-pin",
        html: '<div style="background-color: #3b82f6; border: 2px solid #ffffff; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 9px; font-weight: bold;">W</div>',
        iconSize: [16, 16]
      });

      const completedIcon = L.divIcon({
        className: "custom-map-icon completed-pin",
        html: '<div style="background-color: #10b981; border: 2px solid #ffffff; width: 12px; height: 12px; border-radius: 50%;"></div>',
        iconSize: [12, 12]
      });

      // Add Client Markers
      clients.forEach((c) => {
        if (c.latitude && c.longitude) {
          const lat = parseFloat(c.latitude);
          const lng = parseFloat(c.longitude);

          // Check if visited today
          const isVisited = visits.some((v) => v.client_id === c.client_id && v.check_out_time !== null);

          L.marker([lat, lng], { icon: isVisited ? completedIcon : clientIcon })
            .addTo(map)
            .bindPopup(`
              <strong>Client:</strong> ${c.customer_name}<br/>
              <strong>Outstanding:</strong> ₹${c.outstanding_amount || 0}<br/>
              <strong>Status:</strong> ${c.status}<br/>
              <strong>Address:</strong> ${c.address || ""}
            `);
        }
      });

      // Add Active Worker Check-in Markers
      visits.forEach((v) => {
        if (v.check_in_lat && v.check_in_lng) {
          const lat = parseFloat(v.check_in_lat);
          const lng = parseFloat(v.check_in_lng);

          L.marker([lat, lng], { icon: workerIcon })
            .addTo(map)
            .bindPopup(`
              <strong>Worker:</strong> ${v.worker?.full_name || "Field Agent"}<br/>
              <strong>Client visited:</strong> ${v.client?.customer_name || "N/A"}<br/>
              <strong>Check In:</strong> ${new Date(v.check_in_time).toLocaleTimeString()}<br/>
              <strong>Status:</strong> ${v.outcome || v.category || "In Progress"}
            `);

          // Draw connection line from worker to customer actual location
          if (v.client?.latitude && v.client?.longitude) {
            const cLat = parseFloat(v.client.latitude);
            const cLng = parseFloat(v.client.longitude);
            L.polyline([[lat, lng], [cLat, cLng]], {
              color: "#6b7280",
              weight: 2,
              dashArray: "5, 5"
            }).addTo(map);
          }
        }
      });

    }, 200);
  }, [loading, visits, clients]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        <CircularProgress color="inherit" />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, fontFamily: "Outfit, sans-serif" }}>
          Live Field Activity Tracking
        </Typography>
        <Button variant="outlined" onClick={loadData} size="small">
          Refresh Live Data
        </Button>
      </Stack>

      {/* Metrics Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <Users size={24} color="#6b7280" />
                <Box>
                  <Typography variant="caption" color="text.secondary">Active Agents</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{metrics.activeWorkers}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <Calendar size={24} color="#6b7280" />
                <Box>
                  <Typography variant="caption" color="text.secondary">Today's Visits</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>{metrics.todayVisits}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <CheckCircle2 size={24} color="#10B981" />
                <Box>
                  <Typography variant="caption" color="text.secondary">Completed</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: "#10B981" }}>{metrics.completedVisits}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <Clock size={24} color="#f59e0b" />
                <Box>
                  <Typography variant="caption" color="text.secondary">Pending Visits</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: "#f59e0b" }}>{metrics.pendingVisits}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <AlertCircle size={24} color="#ef4444" />
                <Box>
                  <Typography variant="caption" color="text.secondary">Follow-Ups</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: "#ef4444" }}>{metrics.followUpsRequired}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Map View */}
        <Grid item xs={12} md={8}>
          <Card variant="outlined" sx={{ height: 550, position: "relative" }}>
            <CardContent sx={{ p: 0, height: "100%" }}>
              <Typography variant="subtitle2" sx={{ p: 2, fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" }}>
                Live GPS Operational Map
              </Typography>
              {/* Grayscale Map Container */}
              <Box
                id="visits-map"
                sx={{
                  height: "calc(100% - 53px)",
                  width: "100%",
                  "& .leaflet-container": {
                    filter: "grayscale(100%) invert(8%) contrast(95%)",
                    background: "#F8F8F8"
                  }
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Analytics Breakdown */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: 550 }}>
            <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                Visit Outcome Analysis
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ flexGrow: 1, minHeight: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.filter((d) => d.value > 0)} layout="vertical" margin={{ left: -10, right: 10 }}>
                    <XAxis type="number" stroke="#6b7280" style={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" stroke="#6b7280" style={{ fontSize: 9 }} width={110} />
                    <Tooltip contentStyle={{ background: "#000000", color: "#ffffff", border: "none" }} />
                    <Bar dataKey="value" fill="#000000" radius={[0, 4, 4, 0]}>
                      {analytics.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#000000" : "#6b7280"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary">
                This chart displays the status updates logged by field workers during check-out procedures today.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
