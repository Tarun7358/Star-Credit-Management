import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../utils/supabaseClient";
import * as XLSX from "xlsx";
import {
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Chip,
  IconButton,
  Drawer,
  Typography,
  Divider,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Tab,
  Tabs,
  Stack,
  Avatar
} from "@mui/material";
import {
  FileSpreadsheet,
  Plus,
  Search,
  UserPlus,
  X,
  Phone,
  Calendar,
  FileUp,
  History,
  MapPin,
  CircleDollarSign
} from "lucide-react";

export const Leads: React.FC = () => {
  const { isOwner, isWorker } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    loanType: "",
    bankName: "",
    status: "",
    workerStatus: "",
    telecallerId: "",
    workerId: ""
  });

  // Drawer & Dialog controls
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  // Import states
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [columnMap, setColumnMap] = useState<any>({
    customerName: "",
    mobile: "",
    alternateMobile: "",
    address: "",
    loanType: "",
    loanAmount: "",
    bankName: ""
  });
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);

  // Individual Lead actions state
  const [activeTab, setActiveTab] = useState(0);
  const [statusForm, setStatusForm] = useState({ status: "", workerStatus: "", remarks: "" });
  const [followupForm, setFollowupForm] = useState({ scheduledTime: "", notes: "" });
  const [documentForm, setDocumentForm] = useState({ fileType: "AADHAAR", fileName: "", mockUrl: "" });

  // Bulk assignment state
  const [assignmentForm, setAssignmentForm] = useState({ telecallerId: "", workerId: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Lead Single state
  const [newLeadForm, setNewLeadForm] = useState({
    customerName: "",
    mobile: "",
    alternateMobile: "",
    address: "",
    loanType: "PERSONAL",
    loanAmount: "",
    bankName: ""
  });

  const loadData = async () => {
    try {
      let query = supabase
        .from("leads")
        .select(`
          lead_id,
          customer_name,
          mobile,
          alternate_mobile,
          address,
          loan_type,
          loan_amount,
          bank_name,
          status,
          assigned_telecaller,
          assigned_worker,
          created_at,
          telecaller:users!leads_assigned_telecaller_fkey(full_name),
          worker:users!leads_assigned_worker_fkey(full_name)
        `);

      // Search Query
      if (searchQuery) {
        query = query.or(`customer_name.ilike.%${searchQuery}%,mobile.ilike.%${searchQuery}%,bank_name.ilike.%${searchQuery}%`);
      }

      // Filters
      if (filters.loanType) {
        query = query.eq("loan_type", filters.loanType);
      }
      if (filters.bankName) {
        query = query.ilike("bank_name", `%${filters.bankName}%`);
      }
      if (filters.status) {
        query = query.eq("status", filters.status);
      }
      if (filters.telecallerId) {
        query = query.eq("assigned_telecaller", filters.telecallerId);
      }
      if (filters.workerId) {
        query = query.eq("assigned_worker", filters.workerId);
      }

      const { data: leadsData, error: leadsErr } = await query;
      if (leadsErr) throw leadsErr;

      // Map back to frontend camelCase keys
      const mappedLeads = (leadsData || []).map((l: any) => ({
        id: l.lead_id,
        customerName: l.customer_name,
        mobile: l.mobile,
        alternateMobile: l.alternate_mobile,
        address: l.address,
        loanType: l.loan_type,
        loanAmount: l.loan_amount,
        bankName: l.bank_name,
        status: l.status,
        workerStatus: l.status,
        telecaller: l.telecaller ? { name: l.telecaller.full_name } : null,
        worker: l.worker ? { name: l.worker.full_name } : null,
        createdAt: l.created_at
      }));

      setLeads(mappedLeads);

      if (isOwner) {
        // Load active employees list for assigning dropdown
        const { data: empData, error: empErr } = await supabase
          .from("users")
          .select(`
            user_id,
            full_name,
            role,
            employees (employee_id)
          `)
          .neq("role", "owner");

        if (empErr) throw empErr;

        const mappedEmployees = (empData || []).map((u: any) => ({
          id: u.user_id,
          name: u.full_name,
          role: u.role.toUpperCase(),
          employeeId: u.employees?.[0]?.employee_id || "TC-N/A"
        }));

        setEmployees(mappedEmployees);
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters, searchQuery]);

  // Handle single lead drawer selection
  const handleLeadClick = async (leadId: string) => {
    try {
      const { data: leadData, error: leadErr } = await supabase
        .from("leads")
        .select(`
          lead_id,
          customer_name,
          mobile,
          alternate_mobile,
          address,
          loan_type,
          loan_amount,
          bank_name,
          status,
          assigned_telecaller,
          assigned_worker,
          telecaller:users!leads_assigned_telecaller_fkey(user_id, full_name),
          worker:users!leads_assigned_worker_fkey(user_id, full_name)
        `)
        .eq("lead_id", leadId)
        .single();

      if (leadErr) throw leadErr;

      // Fetch activities
      const { data: acts, error: actsErr } = await supabase
        .from("lead_activities")
        .select(`
          activity_id,
          activity_type,
          remark,
          timestamp,
          users (full_name, role)
        `)
        .eq("lead_id", leadId)
        .order("timestamp", { ascending: false });

      if (actsErr) throw actsErr;

      // Fetch followups
      const { data: fus, error: fusErr } = await supabase
        .from("followups")
        .select(`
          followup_id,
          next_followup_date,
          remarks,
          status
        `)
        .eq("lead_id", leadId)
        .order("next_followup_date", { ascending: false });

      if (fusErr) throw fusErr;

      // Fetch documents
      const { data: docs, error: docsErr } = await supabase
        .from("documents")
        .select(`
          document_id,
          document_type,
          file_name,
          file_url,
          upload_date,
          users:uploaded_by(full_name, role)
        `)
        .eq("lead_id", leadId)
        .order("upload_date", { ascending: false });

      if (docsErr) throw docsErr;

      // Format response structure
      const leadProfile = {
        id: leadData.lead_id,
        customerName: leadData.customer_name,
        mobile: leadData.mobile,
        alternateMobile: leadData.alternate_mobile,
        address: leadData.address,
        loanType: leadData.loan_type,
        loanAmount: leadData.loan_amount,
        bankName: leadData.bank_name,
        status: leadData.status,
        telecaller: leadData.telecaller ? { id: (leadData.telecaller as any).user_id, name: (leadData.telecaller as any).full_name } : null,
        worker: leadData.worker ? { id: (leadData.worker as any).user_id, name: (leadData.worker as any).full_name } : null,
        activities: (acts || []).map(a => ({
          id: a.activity_id,
          action: a.activity_type,
          details: a.remark,
          timestamp: a.timestamp,
          user: {
            name: (a.users as any)?.full_name || "System",
            role: (a.users as any)?.role ? (a.users as any).role.toUpperCase() : "SYSTEM"
          }
        })),
        followUps: (fus || []).map(f => ({
          id: f.followup_id,
          scheduledTime: f.next_followup_date,
          notes: f.remarks,
          status: f.status
        })),
        documents: (docs || []).map((d: any) => ({
          id: d.document_id,
          fileType: d.document_type,
          fileName: d.file_name || "Document.pdf",
          fileUrl: d.file_url,
          uploadedAt: d.upload_date,
          uploadedBy: {
            name: d.users?.full_name || "System",
            role: d.users?.role || "SYSTEM"
          }
        }))
      };

      setSelectedLead(leadProfile);
      setStatusForm({
        status: leadProfile.status,
        workerStatus: leadProfile.status,
        remarks: ""
      });
      setDetailDrawerOpen(true);
      setActiveTab(0);
    } catch (err) {
      console.error("Error fetching lead profile:", err);
    }
  };

  // Row selection checkbox toggles
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLeads(leads.map((l) => l.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleSelectOne = (leadId: string) => {
    setSelectedLeads((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  };

  // Bulk Assignment Handler
  const handleBulkAssign = async () => {
    try {
      const updates: any = {};
      if (assignmentForm.telecallerId) {
        updates.assigned_telecaller = assignmentForm.telecallerId;
      }
      if (assignmentForm.workerId) {
        updates.assigned_worker = assignmentForm.workerId;
      }

      if (Object.keys(updates).length === 0) return;

      const { error } = await supabase
        .from("leads")
        .update(updates)
        .in("lead_id", selectedLeads);

      if (error) throw error;

      // Log activity for each lead
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user.id;
      if (userId) {
        const activityInserts = selectedLeads.map(leadId => ({
          lead_id: leadId,
          user_id: userId,
          activity_type: "ASSIGNMENT",
          remark: `Lead assigned. Telecaller: ${assignmentForm.telecallerId || "No Change"}, Worker: ${assignmentForm.workerId || "No Change"}`
        }));

        await supabase.from("lead_activities").insert(activityInserts);
      }

      setAssignDialogOpen(false);
      setSelectedLeads([]);
      setAssignmentForm({ telecallerId: "", workerId: "" });
      loadData();
    } catch (err) {
      alert("Failed to assign leads");
    }
  };

  // Single Lead create handler
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session.");

      // Fetch owner profile to get agency ID
      const { data: profile } = await supabase
        .from("users")
        .select("agency_id")
        .eq("user_id", session.user.id)
        .single();

      if (!profile) throw new Error("Profile not found.");

      const { error } = await supabase
        .from("leads")
        .insert({
          agency_id: profile.agency_id,
          customer_name: newLeadForm.customerName,
          mobile: newLeadForm.mobile,
          alternate_mobile: newLeadForm.alternateMobile || null,
          address: newLeadForm.address,
          loan_type: newLeadForm.loanType,
          loan_amount: parseFloat(newLeadForm.loanAmount) || 0,
          bank_name: newLeadForm.bankName,
          status: "NEW"
        });

      if (error) throw error;

      setCreateDialogOpen(false);
      setNewLeadForm({
        customerName: "",
        mobile: "",
        alternateMobile: "",
        address: "",
        loanType: "PERSONAL",
        loanAmount: "",
        bankName: ""
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to create lead");
    }
  };

  // Update status/remarks handler
  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session.");

      const { error: updateErr } = await supabase
        .from("leads")
        .update({
          status: statusForm.status
        })
        .eq("lead_id", selectedLead.id);

      if (updateErr) throw updateErr;

      const { error: actErr } = await supabase
        .from("lead_activities")
        .insert({
          lead_id: selectedLead.id,
          user_id: session.user.id,
          activity_type: "STATUS_UPDATE",
          remark: `${statusForm.status} - ${statusForm.remarks || "No remark provided."}`
        });

      if (actErr) throw actErr;

      handleLeadClick(selectedLead.id); // Reload lead profile
      loadData();
    } catch (err) {
      alert("Failed to update status");
    }
  };

  // Add Follow Up callback handler
  const handleFollowupCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session.");

      const { error: fuErr } = await supabase
        .from("followups")
        .insert({
          lead_id: selectedLead.id,
          telecaller_id: session.user.id,
          next_followup_date: followupForm.scheduledTime,
          remarks: followupForm.notes,
          status: "PENDING"
        });

      if (fuErr) throw fuErr;

      await supabase
        .from("lead_activities")
        .insert({
          lead_id: selectedLead.id,
          user_id: session.user.id,
          activity_type: "FOLLOW_UP_SCHEDULED",
          remark: `Scheduled for ${new Date(followupForm.scheduledTime).toLocaleString()}: ${followupForm.notes}`
        });

      setFollowupForm({ scheduledTime: "", notes: "" });
      handleLeadClick(selectedLead.id);
    } catch (err) {
      alert("Failed to schedule follow up");
    }
  };

  // Upload Doc handler (simulated upload)
  const handleDocUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session.");

      const { error: docErr } = await supabase
        .from("documents")
        .insert({
          lead_id: selectedLead.id,
          uploaded_by: session.user.id,
          file_name: documentForm.fileName || `${documentForm.fileType}_attachment.pdf`,
          document_type: documentForm.fileType,
          file_url: `/uploads/${Date.now()}_doc.pdf`
        });

      if (docErr) throw docErr;

      await supabase
        .from("lead_activities")
        .insert({
          lead_id: selectedLead.id,
          user_id: session.user.id,
          activity_type: "DOCUMENT_UPLOADED",
          remark: `Uploaded document of type ${documentForm.fileType}: ${documentForm.fileName}`
        });

      setDocumentForm({ fileType: "AADHAAR", fileName: "", mockUrl: "" });
      handleLeadClick(selectedLead.id);
    } catch (err) {
      alert("Failed to upload document");
    }
  };

  // Excel Upload & Parsing (SheetJS)
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      if (data.length > 0) {
        const headers = Object.keys(data[0] as object);
        setFileHeaders(headers);
        setParsedData(data);

        // Auto mapping guess
        const newMap = { ...columnMap };
        headers.forEach((h) => {
          const lower = h.toLowerCase();
          if (lower.includes("name") || lower.includes("customer")) newMap.customerName = h;
          if (lower.includes("mobile") || lower.includes("phone")) newMap.mobile = h;
          if (lower.includes("alt")) newMap.alternateMobile = h;
          if (lower.includes("address") || lower.includes("location")) newMap.address = h;
          if (lower.includes("type") || lower.includes("loan")) newMap.loanType = h;
          if (lower.includes("amount") || lower.includes("value")) newMap.loanAmount = h;
          if (lower.includes("bank")) newMap.bankName = h;
        });
        setColumnMap(newMap);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session.");

      // Fetch owner profile to get agency ID
      const { data: profile } = await supabase
        .from("users")
        .select("agency_id")
        .eq("user_id", session.user.id)
        .single();

      if (!profile) throw new Error("Profile not found.");

      const inserts = parsedData.map((row) => ({
        agency_id: profile.agency_id,
        customer_name: row[columnMap.customerName] || "",
        mobile: String(row[columnMap.mobile] || ""),
        alternate_mobile: row[columnMap.alternateMobile] ? String(row[columnMap.alternateMobile]) : null,
        address: row[columnMap.address] || "",
        loan_type: String(row[columnMap.loanType] || "PERSONAL").toUpperCase(),
        loan_amount: parseFloat(row[columnMap.loanAmount]) || 0,
        bank_name: row[columnMap.bankName] || "",
        status: "NEW"
      }));

      const { error } = await supabase.from("leads").insert(inserts);
      if (error) throw error;

      setImportDialogOpen(false);
      setParsedData([]);
      loadData();
    } catch (err: any) {
      alert(err.message || "Import failed. Check format.");
    }
  };

  // Status Styles helper
  const getStatusColor = (status: string) => {
    switch (status) {
      case "NEW": return "primary";
      case "CONTACTED": return "info";
      case "INTERESTED": return "success";
      case "NOT_INTERESTED": return "error";
      case "READY_FOR_WORKER": return "secondary";
      case "CLOSED": return "default";
      default: return "default";
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
      {/* Header controls */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
            Leads Console
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View status sheet, filter entries, or trigger workflow assignments.
          </Typography>
        </Box>

        {isOwner && (
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setImportDialogOpen(true)}
              startIcon={<FileSpreadsheet size={18} />}
            >
              Spreadsheet Import
            </Button>
            <Button
              variant="contained"
              onClick={() => setCreateDialogOpen(true)}
              startIcon={<Plus size={18} />}
            >
              Add Single Lead
            </Button>
          </Stack>
        )}
      </Box>

      {/* Leads filters */}
      <Card sx={{ p: 1 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search name, phone, bank..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <Search size={18} style={{ marginRight: 8, color: "gray" }} />
                }}
              />
            </Grid>
            <Grid item xs={6} md={1.8}>
              <TextField
                select
                fullWidth
                size="small"
                label="Loan Type"
                value={filters.loanType}
                onChange={(e) => setFilters({ ...filters, loanType: e.target.value })}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="HOME">Home Loan</MenuItem>
                <MenuItem value="BIKE">Bike Loan</MenuItem>
                <MenuItem value="PERSONAL">Personal Loan</MenuItem>
                <MenuItem value="MORTGAGE">Mortgage Loan</MenuItem>
                <MenuItem value="BUSINESS">Business Loan</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6} md={1.8}>
              <TextField
                select
                fullWidth
                size="small"
                label="Status"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="NEW">New Pool</MenuItem>
                <MenuItem value="CONTACTED">Contacted</MenuItem>
                <MenuItem value="FOLLOW_UP_REQUIRED">Follow Up Req</MenuItem>
                <MenuItem value="INTERESTED">Interested</MenuItem>
                <MenuItem value="NOT_INTERESTED">Not Interested</MenuItem>
                <MenuItem value="READY_FOR_WORKER">Ready for Field</MenuItem>
                <MenuItem value="CLOSED">Closed Case</MenuItem>
              </TextField>
            </Grid>
            {isOwner && (
              <>
                <Grid item xs={6} md={1.8}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Telecaller"
                    value={filters.telecallerId}
                    onChange={(e) => setFilters({ ...filters, telecallerId: e.target.value })}
                  >
                    <MenuItem value="">All Telecallers</MenuItem>
                    {employees.filter(e => e.role === "TELECALLER").map(tc => (
                      <MenuItem key={tc.id} value={tc.id}>{tc.name}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={6} md={1.8}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Field Worker"
                    value={filters.workerId}
                    onChange={(e) => setFilters({ ...filters, workerId: e.target.value })}
                  >
                    <MenuItem value="">All Workers</MenuItem>
                    {employees.filter(e => e.role === "WORKER").map(wk => (
                      <MenuItem key={wk.id} value={wk.id}>{wk.name}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </>
            )}
            <Grid item xs={12} md={1}>
              <Button
                variant="text"
                color="secondary"
                onClick={() => setFilters({ loanType: "", bankName: "", status: "", workerStatus: "", telecallerId: "", workerId: "" })}
                fullWidth
              >
                Reset
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Bulk actions bar (if rows selected) */}
      {selectedLeads.length > 0 && (
        <Box sx={{ display: "flex", p: 2, bgcolor: "rgba(99, 102, 241, 0.08)", borderRadius: "12px", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {selectedLeads.length} Lead records selected
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<UserPlus size={18} />}
            onClick={() => setAssignDialogOpen(true)}
          >
            Assign Selected Staff
          </Button>
        </Box>
      )}

      {/* Leads Table */}
      <TableContainer component={Paper} className="glass-panel">
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              {isOwner && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedLeads.length > 0 && selectedLeads.length < leads.length}
                    checked={leads.length > 0 && selectedLeads.length === leads.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
              )}
              <TableCell sx={{ fontWeight: 700 }}>Customer Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Mobile</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Loan Details</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Bank</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Telecalling</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Field Worker</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Worker Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {leads.map((lead) => {
              const isSelected = selectedLeads.includes(lead.id);
              return (
                <TableRow
                  key={lead.id}
                  hover
                  selected={isSelected}
                  onClick={() => handleLeadClick(lead.id)}
                  sx={{ cursor: "pointer", "&.Mui-selected": { bgcolor: "rgba(99, 102, 241, 0.04)" } }}
                >
                  {isOwner && (
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleSelectOne(lead.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 600 }}>{lead.customerName}</TableCell>
                  <TableCell>{lead.mobile}</TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {lead.loanType}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ₹{lead.loanAmount} Lakhs
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{lead.bankName}</TableCell>
                  <TableCell>
                    <Chip
                      label={lead.status}
                      color={getStatusColor(lead.status) as any}
                      size="small"
                      sx={{ fontWeight: 700, fontSize: "0.75rem" }}
                    />
                  </TableCell>
                  <TableCell>
                    {lead.worker ? lead.worker.name : <Typography variant="caption" color="text.secondary">- Unassigned -</Typography>}
                  </TableCell>
                  <TableCell>
                    {lead.workerId ? (
                      <Chip
                        label={lead.workerStatus}
                        color={lead.workerStatus === "COMPLETED" ? "success" : "warning"}
                        size="small"
                        sx={{ fontWeight: 700, fontSize: "0.75rem" }}
                      />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {leads.length === 0 && (
              <TableRow>
                <TableCell colSpan={isOwner ? 8 : 7} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    No matching lead records found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ==========================================
          LEAD DETAILS SLIDE-OUT DRAWER
          ========================================== */}
      <Drawer
        anchor="right"
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 500 }, borderLeft: "1px solid rgba(255,255,255,0.08)" } }}
      >
        {selectedLead && (
          <Box sx={{ p: 3, display: "flex", flexDirection: "column", height: "100%", bgcolor: "background.paper" }}>
            {/* Drawer Title */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
                Lead Profile
              </Typography>
              <IconButton onClick={() => setDetailDrawerOpen(false)}>
                <X size={20} />
              </IconButton>
            </Box>

            {/* Profile Overview */}
            <Box sx={{ bgcolor: "rgba(255,255,255,0.02)", p: 2.5, borderRadius: "12px", border: "1px solid rgba(255,255,255,0.04)", mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {selectedLead.customerName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 1, my: 1 }}>
                <Phone size={14} /> {selectedLead.mobile} {selectedLead.alternateMobile && ` / ${selectedLead.alternateMobile}`}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 1, my: 1 }}>
                <MapPin size={14} /> {selectedLead.address}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 1, my: 1 }}>
                <CircleDollarSign size={14} /> {selectedLead.loanType} Loan • ₹{selectedLead.loanAmount} Lakhs ({selectedLead.bankName})
              </Typography>
            </Box>

            {/* Tabs for updates / history */}
            <Tabs value={activeTab} onChange={(_e, v) => setActiveTab(v)} variant="fullWidth" sx={{ mb: 2.5 }}>
              <Tab label="Remarks & Status" sx={{ fontWeight: 700 }} />
              <Tab label="Documents" sx={{ fontWeight: 700 }} />
              <Tab label="Activity History" sx={{ fontWeight: 700 }} />
            </Tabs>

            {/* Tab 0: Update status remarks followups */}
            {activeTab === 0 && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5, flexGrow: 1, overflowY: "auto", pr: 0.5 }}>
                {/* Status Update Form */}
                <form onSubmit={handleStatusUpdate}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Update Progress</Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <TextField
                      select
                      fullWidth
                      label="Telecaller Status"
                      size="small"
                      value={statusForm.status}
                      onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                    >
                      <MenuItem value="NEW">New</MenuItem>
                      <MenuItem value="CONTACTED">Contacted</MenuItem>
                      <MenuItem value="NOT_ANSWERED">Not Answered</MenuItem>
                      <MenuItem value="FOLLOW_UP_REQUIRED">Follow-up Required</MenuItem>
                      <MenuItem value="INTERESTED">Interested</MenuItem>
                      <MenuItem value="NOT_INTERESTED">Not Interested</MenuItem>
                      <MenuItem value="DOCUMENTS_REQUESTED">Documents Requested</MenuItem>
                      <MenuItem value="DOCUMENTS_RECEIVED">Documents Received</MenuItem>
                      <MenuItem value="READY_FOR_WORKER">Ready for Worker Visit</MenuItem>
                      <MenuItem value="CLOSED">Closed / Disbursed</MenuItem>
                    </TextField>

                    {selectedLead.workerId && (
                      <TextField
                        select
                        fullWidth
                        label="Field Worker Status"
                        size="small"
                        value={statusForm.workerStatus}
                        onChange={(e) => setStatusForm({ ...statusForm, workerStatus: e.target.value })}
                      >
                        <MenuItem value="ASSIGNED">Assigned</MenuItem>
                        <MenuItem value="CUSTOMER_MET">Customer Met</MenuItem>
                        <MenuItem value="DOCUMENTS_COLLECTED">Documents Collected</MenuItem>
                        <MenuItem value="PENDING_DOCUMENTS">Pending Documents</MenuItem>
                        <MenuItem value="SUBMITTED">Submitted to Bank</MenuItem>
                        <MenuItem value="COMPLETED">Completed</MenuItem>
                      </TextField>
                    )}

                    <TextField
                      fullWidth
                      multiline
                      rows={2.5}
                      label="Call Remarks / Visit Notes"
                      placeholder="Enter update description..."
                      value={statusForm.remarks}
                      onChange={(e) => setStatusForm({ ...statusForm, remarks: e.target.value })}
                    />
                    <Button type="submit" variant="contained" fullWidth>
                      Submit Operational Log
                    </Button>
                  </Box>
                </form>

                <Divider />

                {/* Follow Up form (Telecallers/Owners) */}
                {!isWorker && (
                  <form onSubmit={handleFollowupCreate}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Schedule Call Back</Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <TextField
                        type="datetime-local"
                        fullWidth
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        label="Callback Date & Time"
                        value={followupForm.scheduledTime}
                        onChange={(e) => setFollowupForm({ ...followupForm, scheduledTime: e.target.value })}
                        required
                      />
                      <TextField
                        fullWidth
                        size="small"
                        label="Reminder Description"
                        placeholder="e.g. Ask for banking password/slips"
                        value={followupForm.notes}
                        onChange={(e) => setFollowupForm({ ...followupForm, notes: e.target.value })}
                      />
                      <Button type="submit" variant="outlined" fullWidth startIcon={<Calendar size={16} />}>
                        Schedule Reminder
                      </Button>
                    </Box>
                  </form>
                )}
              </Box>
            )}

            {/* Tab 1: Documents Section */}
            {activeTab === 1 && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3, flexGrow: 1, overflowY: "auto", pr: 0.5 }}>
                {/* Upload Form */}
                <form onSubmit={handleDocUpload}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Attach Document Metadata</Typography>
                  <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                    <TextField
                      select
                      size="small"
                      label="Document Category"
                      sx={{ flexGrow: 1, minWidth: 150 }}
                      value={documentForm.fileType}
                      onChange={(e) => setDocumentForm({ ...documentForm, fileType: e.target.value })}
                    >
                      <MenuItem value="AADHAAR">Aadhaar Card</MenuItem>
                      <MenuItem value="PAN">PAN Card</MenuItem>
                      <MenuItem value="SALARY_SLIP">Salary Slip</MenuItem>
                      <MenuItem value="BANK_STATEMENT">Bank Statement</MenuItem>
                      <MenuItem value="PROPERTY">Property Documents</MenuItem>
                      <MenuItem value="INCOME_PROOF">Income Proof</MenuItem>
                      <MenuItem value="OTHER">Other Documents</MenuItem>
                    </TextField>
                    <TextField
                      size="small"
                      label="File Label"
                      placeholder="e.g. June Salary Slip"
                      sx={{ flexGrow: 1 }}
                      value={documentForm.fileName}
                      onChange={(e) => setDocumentForm({ ...documentForm, fileName: e.target.value })}
                      required
                    />
                    <Button type="submit" variant="contained" startIcon={<FileUp size={16} />} sx={{ width: "100%" }}>
                      Simulate Document Upload
                    </Button>
                  </Box>
                </form>

                <Divider />

                {/* List of current uploaded files */}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Attached Files</Typography>
                  <List sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {selectedLead.documents.map((doc: any) => (
                      <ListItem
                        key={doc.id}
                        sx={{ bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "8px" }}
                      >
                        <ListItemText
                          primary={doc.fileName}
                          secondary={`Uploaded by ${doc.uploadedBy.name} • ${new Date(doc.uploadedAt).toLocaleDateString()}`}
                          primaryTypographyProps={{ fontWeight: 700 }}
                        />
                        <Chip label={doc.fileType} size="small" color="primary" sx={{ fontWeight: 700 }} />
                      </ListItem>
                    ))}
                    {selectedLead.documents.length === 0 && (
                      <Typography variant="body2" color="text.secondary">No documents uploaded yet.</Typography>
                    )}
                  </List>
                </Box>
              </Box>
            )}

            {/* Tab 2: Activity Log Timeline */}
            {activeTab === 2 && (
              <Box sx={{ flexGrow: 1, overflowY: "auto", pr: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Audit Trail & Timeline</Typography>
                <List sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                  {selectedLead.activities.map((act: any) => (
                    <Box key={act.id} sx={{ display: "flex", gap: 1.5 }}>
                      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <Avatar sx={{ width: 24, height: 24, bgcolor: "rgba(99, 102, 241, 0.1)", color: "primary.main" }}>
                          <History size={12} />
                        </Avatar>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                          {act.action.replace(/_/g, " ")}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ my: 0.5, fontSize: "0.85rem" }}>
                          {act.details}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          By {act.user.name} ({act.user.role.toLowerCase()}) • {new Date(act.timestamp).toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                  {selectedLead.activities.length === 0 && (
                    <Typography variant="body2" color="text.secondary">No history log recorded.</Typography>
                  )}
                </List>
              </Box>
            )}
          </Box>
        )}
      </Drawer>

      {/* ==========================================
          BULK ASSIGNMENT DIALOG
          ========================================== */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)}>
        <DialogTitle sx={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>Bulk Lead Assignment</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2.5, minWidth: 300 }}>
            <TextField
              select
              fullWidth
              label="Assign Telecaller"
              value={assignmentForm.telecallerId}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, telecallerId: e.target.value })}
            >
              <MenuItem value="">Keep Unchanged / None</MenuItem>
              {employees.filter(e => e.role === "TELECALLER").map(tc => (
                <MenuItem key={tc.id} value={tc.id}>{tc.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              label="Assign Field Worker"
              value={assignmentForm.workerId}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, workerId: e.target.value })}
            >
              <MenuItem value="">Keep Unchanged / None</MenuItem>
              {employees.filter(e => e.role === "WORKER").map(wk => (
                <MenuItem key={wk.id} value={wk.id}>{wk.name}</MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleBulkAssign}>Confirm Assignment</Button>
        </DialogActions>
      </Dialog>

      {/* ==========================================
          ADD SINGLE LEAD DIALOG
          ========================================== */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogTitle sx={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>Add Customer Lead</DialogTitle>
        <form onSubmit={handleCreateLead}>
          <DialogContent>
            <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 350 }}>
              <TextField
                label="Customer Name"
                required
                fullWidth
                value={newLeadForm.customerName}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, customerName: e.target.value })}
              />
              <TextField
                label="Mobile Number"
                required
                fullWidth
                value={newLeadForm.mobile}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, mobile: e.target.value })}
              />
              <TextField
                label="Alternate Mobile"
                fullWidth
                value={newLeadForm.alternateMobile}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, alternateMobile: e.target.value })}
              />
              <TextField
                label="Address Location"
                required
                fullWidth
                value={newLeadForm.address}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, address: e.target.value })}
              />
              <TextField
                select
                label="Loan Type"
                required
                fullWidth
                value={newLeadForm.loanType}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, loanType: e.target.value })}
              >
                <MenuItem value="HOME">Home Loan</MenuItem>
                <MenuItem value="BIKE">Bike Loan</MenuItem>
                <MenuItem value="PERSONAL">Personal Loan</MenuItem>
                <MenuItem value="MORTGAGE">Mortgage Loan</MenuItem>
                <MenuItem value="BUSINESS">Business Loan</MenuItem>
              </TextField>
              <TextField
                label="Loan Amount (Lakhs)"
                type="number"
                required
                fullWidth
                value={newLeadForm.loanAmount}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, loanAmount: e.target.value })}
              />
              <TextField
                label="Bank Name"
                required
                fullWidth
                value={newLeadForm.bankName}
                onChange={(e) => setNewLeadForm({ ...newLeadForm, bankName: e.target.value })}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Create Lead</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ==========================================
          SPREADSHEET BULK IMPORT DIALOG
          ========================================== */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>Excel Spreadsheet Lead Import</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 3.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyItems: "center", border: "2px dashed rgba(255,255,255,0.08)", p: 4, borderRadius: "12px", textAlign: "center" }}>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                ref={fileInputRef}
                onChange={handleExcelUpload}
                style={{ display: "none" }}
              />
              <Box sx={{ width: "100%", cursor: "pointer" }} onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet size={40} color="#6366f1" style={{ margin: "0 auto 12px" }} />
                <Typography variant="body2" color="text.secondary">
                  Click to select Excel spreadsheet (.xlsx, .xls, .csv)
                </Typography>
              </Box>
            </Box>

            {parsedData.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: "primary.main" }}>
                  Map Excel Columns to SCM Lead Fields ({parsedData.length} records parsed)
                </Typography>
                <Grid container spacing={2}>
                  {Object.keys(columnMap).map((field) => (
                    <Grid item xs={12} sm={4} key={field}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label={`Map SCM [${field}]`}
                        value={columnMap[field]}
                        onChange={(e) => setColumnMap({ ...columnMap, [field]: e.target.value })}
                        required
                      >
                        <MenuItem value="">- Unmapped -</MenuItem>
                        {fileHeaders.map((header) => (
                          <MenuItem key={header} value={header}>{header}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setImportDialogOpen(false); setParsedData([]); }}>Cancel</Button>
          <Button variant="contained" disabled={parsedData.length === 0} onClick={handleConfirmImport}>
            Confirm & Import Leads
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
