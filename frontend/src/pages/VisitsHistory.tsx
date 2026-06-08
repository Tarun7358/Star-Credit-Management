import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tabs,
  Tab,
  Stack
} from "@mui/material";
import { FileText, Lock, Unlock } from "lucide-react";

export default function VisitsHistory() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [visits, setVisits] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  // Override dialog state
  const [overrideClient, setOverrideClient] = useState<any>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // Detail proof dialog state
  const [viewProofVisit, setViewProofVisit] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
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

      // Fetch all customer visits for clients in this agency
      const { data: visitRows } = await supabase
        .from("customer_visits")
        .select(`
          *,
          client:clients!inner(customer_name, address, latitude, longitude, manager_override_allowed, manager_override_reason, agency_id),
          worker:users!customer_visits_worker_id_fkey(full_name)
        `)
        .eq("client.agency_id", agencyId)
        .order("check_in_time", { ascending: false });

      // Fetch all clients in this agency to allow overrides
      const { data: clientRows } = await supabase
        .from("clients")
        .select("client_id, customer_name, address, latitude, longitude, manager_override_allowed, manager_override_reason")
        .eq("agency_id", agencyId)
        .order("customer_name", { ascending: true });

      setVisits(visitRows || []);
      setClients(clientRows || []);
    } catch (err) {
      console.error("Failed to load historical visits:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "In Progress";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const handleOpenOverride = (client: any) => {
    setOverrideClient(client);
    setOverrideReason(client.manager_override_reason || "");
  };

  const handleSaveOverride = async () => {
    if (!overrideClient) return;
    setSubmittingOverride(true);
    try {
      const isEnabling = !overrideClient.manager_override_allowed;
      const { error } = await supabase
        .from("clients")
        .update({
          manager_override_allowed: isEnabling,
          manager_override_reason: isEnabling ? overrideReason : null
        })
        .eq("client_id", overrideClient.client_id);

      if (error) throw error;

      // Log to audit log
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("audit_logs").insert({
          user_id: session.user.id,
          client_id: overrideClient.client_id,
          action: isEnabling ? "MANAGER_OVERRIDE_GRANTED" : "MANAGER_OVERRIDE_REVOKED",
          updated_value: isEnabling ? { reason: overrideReason } : {}
        });
      }

      setOverrideClient(null);
      setOverrideReason("");
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update manager override status.");
    } finally {
      setSubmittingOverride(false);
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
        Field Operations Log & Overrides
      </Typography>

      <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)} sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
        <Tab label="Historical Visit Logs" />
        <Tab label="Location Overrides Settings" />
      </Tabs>

      {/* TAB 0: HISTORICAL VISIT LOGS */}
      {activeTab === 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Date / Time</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Worker Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Client Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Duration</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Verification</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Final Outcome</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Proof</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visits.map((visit) => {
                const isPending = visit.check_out_time === null;

                let verificationChip = (
                  <Chip label="In Progress" color="default" size="small" variant="outlined" />
                );

                if (!isPending) {
                  if (visit.photo_url || visit.signature_url || visit.receipt_url || visit.document_url) {
                    verificationChip = (
                      <Chip label="GPS Verified" color="success" size="small" variant="outlined" />
                    );
                  } else {
                    verificationChip = (
                      <Chip label="Override Mode" color="warning" size="small" variant="outlined" />
                    );
                  }
                }

                return (
                  <TableRow key={visit.visit_id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {new Date(visit.check_in_time).toLocaleDateString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(visit.check_in_time).toLocaleTimeString()}
                      </Typography>
                    </TableCell>
                    <TableCell>{visit.worker?.full_name || "N/A"}</TableCell>
                    <TableCell>{visit.client?.customer_name || "N/A"}</TableCell>
                    <TableCell>{formatDuration(visit.duration_seconds)}</TableCell>
                    <TableCell>{verificationChip}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {visit.outcome || "N/A"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {visit.remarks || ""}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {(visit.photo_url || visit.signature_url || visit.receipt_url || visit.document_url) ? (
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<FileText size={14} />}
                          onClick={() => setViewProofVisit(visit)}
                        >
                          View Proof
                        </Button>
                      ) : (
                        <Typography variant="caption" color="text.secondary">No Proof</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {visits.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    No field operations logs recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* TAB 1: LOCATION OVERRIDES SETTINGS */}
      {activeTab === 1 && (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Customer Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Registered Address</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Coordinates (Lat, Lng)</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>GPS Restriction Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Override Reason</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clients.map((client) => {
                const hasCoordinates = client.latitude && client.longitude;
                return (
                  <TableRow key={client.client_id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{client.customer_name}</TableCell>
                    <TableCell>{client.address}</TableCell>
                    <TableCell>
                      {hasCoordinates ? (
                        <Typography variant="body2">
                          {client.latitude}, {client.longitude}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="error" sx={{ fontWeight: 500 }}>
                          No Coordinates Registered
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.manager_override_allowed ? (
                        <Chip
                          icon={<Unlock size={12} />}
                          label="Override Active (Bypassed)"
                          color="warning"
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Chip
                          icon={<Lock size={12} />}
                          label="Restricted (100m Lock)"
                          color="default"
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell>{client.manager_override_reason || "N/A"}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant={client.manager_override_allowed ? "outlined" : "contained"}
                        color={client.manager_override_allowed ? "inherit" : "warning"}
                        onClick={() => handleOpenOverride(client)}
                      >
                        {client.manager_override_allowed ? "Enforce GPS Lock" : "Authorize Remote Update"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* OVERRIDE AUTHORIZATION DIALOG */}
      <Dialog open={overrideClient !== null} onClose={() => setOverrideClient(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {overrideClient?.manager_override_allowed ? "Enforce GPS Constraints" : "Authorize Remote Visit Override"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {overrideClient?.manager_override_allowed
              ? `Re-enable GPS lock for ${overrideClient?.customer_name}. The worker must be within the 100m radius of the customer's registered location to update cases.`
              : `Bypass location constraint for ${overrideClient?.customer_name}. This allows workers to check-in and submit statuses from any remote coordinates. Please specify a justification below.`}
          </Typography>
          {!overrideClient?.manager_override_allowed && (
            <TextField
              fullWidth
              multiline
              rows={3}
              required
              label="Override Authorization Justification"
              placeholder="e.g. Verified customer is out of town, or cellular coordinates are incorrect at site."
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="text" onClick={() => setOverrideClient(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={submittingOverride || (!overrideClient?.manager_override_allowed && !overrideReason.trim())}
            onClick={handleSaveOverride}
          >
            {overrideClient?.manager_override_allowed ? "Re-Lock location" : "Confirm Override Bypass"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* VIEW VISIT PROOF DIALOG */}
      <Dialog open={viewProofVisit !== null} onClose={() => setViewProofVisit(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Visit Verification Proof Materials
        </DialogTitle>
        <DialogContent dividers>
          {viewProofVisit && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="caption" color="text.secondary">Worker Remarks</Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {viewProofVisit.remarks || "No remarks entered."}
                </Typography>
              </Box>

              {viewProofVisit.photo_url && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Uploaded Customer / Site Photo</Typography>
                  <Box sx={{ mt: 1, border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden", maxHeight: 300, display: "flex", justifyContent: "center", bgcolor: "#f8f8f8" }}>
                    <img src={viewProofVisit.photo_url} alt="Site Photo Proof" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  </Box>
                </Box>
              )}

              {viewProofVisit.signature_url && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Captured Customer Signature</Typography>
                  <Box sx={{ mt: 1, border: "1px solid", borderColor: "divider", borderRadius: 1, p: 2, bgcolor: "#ffffff", display: "flex", justifyContent: "center" }}>
                    <img src={viewProofVisit.signature_url} alt="Customer Signature Proof" style={{ maxHeight: 100 }} />
                  </Box>
                </Box>
              )}

              {viewProofVisit.receipt_url && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Payment Receipt Upload</Typography>
                  <Box sx={{ mt: 1 }}>
                    <Button variant="outlined" size="small" href={viewProofVisit.receipt_url} target="_blank">
                      Open Payment Receipt File
                    </Button>
                  </Box>
                </Box>
              )}

              {viewProofVisit.document_url && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Document Verification Attachment</Typography>
                  <Box sx={{ mt: 1 }}>
                    <Button variant="outlined" size="small" href={viewProofVisit.document_url} target="_blank">
                      Open Attached Document
                    </Button>
                  </Box>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="contained" onClick={() => setViewProofVisit(null)}>
            Close Proof Panel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
