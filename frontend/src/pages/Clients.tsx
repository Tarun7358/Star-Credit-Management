import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../utils/supabaseClient";
import { ExcelImportWizard } from "../components/ExcelImportWizard";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
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
  Stack,
  CircularProgress,
  LinearProgress,
  Alert
} from "@mui/material";
import {
  Plus,
  Search,
  X,
  FileSpreadsheet,
  Shield,
  Clock,
  HelpCircle,
  MapPin,
  Archive,
  Trash2,
  Phone
} from "lucide-react";

const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: "New Lead",
  VERIFICATION: "Verification",
  DOCUMENT_COLLECTION: "Document Collection",
  CREDIT_ANALYSIS: "Credit Analysis",
  DISPUTE_CREATION: "Report Corrections",
  BUREAU_SUBMISSION: "Submit to Credit Company",
  REVIEW: "Review Case",
  FOLLOW_UP: "Follow-Up",
  COMPLETED: "Completed"
};

const STAGE_LIST = ["New Lead", "Contacted", "Follow-Up", "PTP", "Field Visit", "Payment Received", "Closed"];
const STAGE_PROGRESS: Record<string, number> = {
  "New Lead": 15,
  "Contacted": 30,
  "Follow-Up": 45,
  "PTP": 60,
  "Field Visit": 75,
  "Payment Received": 90,
  "Closed": 100
};

export const Clients: React.FC = () => {
  const { isOwner, isManager, isWorker, isClientManager, user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");

  // Dialog & Wizard states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  // Selected client detailed states
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [sensitiveDetails, setSensitiveDetails] = useState<any>(null);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);

  // GPS Verification state
  const [gpsStatus, setGpsStatus] = useState<"idle" | "checking" | "verified" | "too_far" | "no_coords" | "denied">("idle");
  const [workerGps, setWorkerGps] = useState<{ lat: number; lng: number; distance: number } | null>(null);

  // Forms
  const [newClientForm, setNewClientForm] = useState({
    name: "",
    mobile: "",
    altMobile: "",
    address: "",
    dob: "",
    ssn: "",
    creditScore: "",
    privateNotes: "",
    bureauInfo: "",
    outstandingAmount: "",
    dueDate: "",
    latitude: "",
    longitude: "",
    googleMapsLink: "",
    area: "",
    pincode: ""
  });

  const autoLocate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setNewClientForm((prev) => ({
            ...prev,
            latitude: position.coords.latitude.toFixed(6),
            longitude: position.coords.longitude.toFixed(6)
          }));
        },
        (error) => {
          alert("Could not retrieve GPS coordinates: " + error.message);
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const [disputeForm, setDisputeForm] = useState({
    bureau: "EQUIFAX",
    category: "Wrong Personal Details",
    itemDisputed: "",
    internalNotes: "",
    attachmentUrl: "",
    status: "PENDING",
    responseDetails: ""
  });

  const [activityForm, setActivityForm] = useState({
    activityType: "Outbound Call",
    callResult: "Connected",
    outcome: "Information Verified",
    notes: "",
    callbackTime: ""
  });

  // Telecaller Command Center Dialog States
  const [ptpDialogOpen, setPtpDialogOpen] = useState(false);
  const [ptpAmount, setPtpAmount] = useState("");
  const [ptpDate, setPtpDate] = useState("");

  const [followupDialogOpen, setFollowupDialogOpen] = useState(false);
  const [followupDate, setFollowupDate] = useState("");
  const [followupNotes, setFollowupNotes] = useState("");

  const [visitRequestDialogOpen, setVisitRequestDialogOpen] = useState(false);
  const [visitInstructions, setVisitInstructions] = useState("");
  const [visitWorkerId, setVisitWorkerId] = useState("");

  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [escalationNotes, setEscalationNotes] = useState("");

  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [collectedAmount, setCollectedAmount] = useState("");
  const [collectionMode, setCollectionMode] = useState("UPI");

  // ---- GPS Haversine distance utility ----
  const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dphi = ((lat2 - lat1) * Math.PI) / 180;
    const dlambda = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dphi / 2) * Math.sin(dphi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) * Math.sin(dlambda / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const VISIT_RADIUS_METERS = 100;
  const FIELD_ACTIVITY_TYPES = ["Field Visit", "Customer Meeting", "Address Verification"];

  const verifyGpsForVisit = () => {
    if (!selectedClient) return;
    if (!selectedClient.latitude || !selectedClient.longitude) {
      setGpsStatus("no_coords");
      return;
    }
    setGpsStatus("checking");
    setWorkerGps(null);

    if (!navigator.geolocation) {
      setGpsStatus("denied");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const workerLat = position.coords.latitude;
        const workerLng = position.coords.longitude;
        const customerLat = parseFloat(selectedClient.latitude);
        const customerLng = parseFloat(selectedClient.longitude);
        const dist = Math.round(getDistanceMeters(workerLat, workerLng, customerLat, customerLng));

        setWorkerGps({ lat: workerLat, lng: workerLng, distance: dist });
        setGpsStatus(dist <= VISIT_RADIUS_METERS ? "verified" : "too_far");
      },
      () => {
        setGpsStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch clients list
      const { data: clientRows, error: clientErr } = await supabase
        .from("clients")
        .select(`
          *,
          worker:users!clients_assigned_worker_fkey(
            user_id,
            full_name,
            phone,
            role,
            employees(employee_id)
          ),
          telecaller:users!clients_assigned_telecaller_fkey(
            user_id,
            full_name,
            phone,
            role,
            employees(employee_id)
          )
        `)
        .eq("is_archived", false);

      if (clientErr) throw clientErr;
      setClients(clientRows || []);

      // If owner or manager, fetch potential assignees
      if (isOwner || isManager) {
        const { data: staffRows, error: staffErr } = await supabase
          .from("users")
          .select("user_id, full_name, role")
          .neq("role", "client");

        if (staffErr) throw staffErr;
        setStaff(staffRows || []);
      }
    } catch (err) {
      console.error("Failed to load clients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadClientActivitiesAndVisits = async (clientId: string) => {
    try {
      const { data: activityData } = await supabase
        .from("customer_activities")
        .select(`
          *,
          creator:users!customer_activities_created_by_fkey(full_name, role)
        `)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      const acts = activityData || [];
      setActivities(acts);

      const { data: visitData } = await supabase
        .from("customer_visits")
        .select(`
          *,
          worker:users!customer_visits_worker_id_fkey(full_name)
        `)
        .eq("client_id", clientId)
        .order("check_in_time", { ascending: false });

      const visits = visitData || [];
      setVisits(visits);

      const combinedTimeline: any[] = [];
      
      acts.forEach((a: any) => {
        combinedTimeline.push({
          id: a.activity_id,
          type: "activity",
          activity_type: a.activity_type,
          call_result: a.call_result,
          outcome: a.outcome,
          notes: a.notes,
          timestamp: a.created_at,
          gps_verified: a.gps_verified,
          distance_from_customer: a.distance_from_customer,
          creator_name: a.creator?.full_name || "System",
          creator_role: a.creator?.role || "Staff",
          status: a.status
        });
      });

      visits.forEach((v: any) => {
        combinedTimeline.push({
          id: v.visit_id,
          type: "visit",
          activity_type: "Field Visit Check-In",
          call_result: v.check_out_time ? "Check-Out Logged" : "Active Check-In",
          outcome: v.outcome || "Pending Verification",
          notes: v.notes || "Field visit check-in logged.",
          timestamp: v.check_in_time,
          gps_verified: v.gps_verified,
          distance_from_customer: v.distance_from_customer,
          creator_name: v.worker?.full_name || "Field Agent",
          creator_role: "worker",
          status: "RECORDED",
          check_out_time: v.check_out_time,
          duration_seconds: v.duration_seconds,
          photo_url: v.photo_url,
          signature_url: v.signature_url,
          receipt_url: v.receipt_url,
          document_url: v.document_url
        });
      });

      combinedTimeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTimeline(combinedTimeline);
    } catch (err) {
      console.error("Error loading activities/visits:", err);
    }
  };

  const refreshSelectedClient = async (clientId: string) => {
    try {
      const { data: updatedClient } = await supabase
        .from("clients")
        .select(`
          *,
          worker:users!clients_assigned_worker_fkey(
            user_id,
            full_name,
            phone,
            role,
            employees(employee_id)
          ),
          telecaller:users!clients_assigned_telecaller_fkey(
            user_id,
            full_name,
            phone,
            role,
            employees(employee_id)
          )
        `)
        .eq("client_id", clientId)
        .single();
      if (updatedClient) {
        setSelectedClient(updatedClient);
      }
      await loadClientActivitiesAndVisits(clientId);
    } catch (err) {
      console.error("Failed to refresh selected client details:", err);
    }
  };

  // Fetch detailed data on selecting client
  const handleClientSelect = async (client: any) => {
    setSelectedClient(client);
    setSensitiveDetails(null);
    setDisputes([]);
    setActivities([]);
    setTimeline([]);
    setDetailDrawerOpen(true);

    try {
      // 1. Fetch sensitive details (Only accessible if owner, manager, or self)
      if (isOwner || isManager || isClientManager || user?.id === client.client_id) {
        const { data: sensData } = await supabase
          .from("client_sensitive_details")
          .select("*")
          .eq("client_id", client.client_id)
          .maybeSingle();

        if (sensData) setSensitiveDetails(sensData);
      }

      // 2. Fetch disputes
      const { data: disputeData } = await supabase
        .from("disputes")
        .select("*")
        .eq("client_id", client.client_id)
        .order("created_at", { ascending: false });

      if (disputeData) setDisputes(disputeData);

      // 3. Fetch customer activities and visits
      await loadClientActivitiesAndVisits(client.client_id);
    } catch (err) {
      console.error("Error loading selected client details:", err);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session.");

      // Fetch agency_id
      const { data: profile } = await supabase
        .from("users")
        .select("agency_id")
        .eq("user_id", session.user.id)
        .single();

      if (!profile) throw new Error("Profile not found.");

      // Insert general client
      const { data: newClient, error: clientErr } = await supabase
        .from("clients")
        .insert({
          agency_id: profile.agency_id,
          customer_name: newClientForm.name,
          mobile: newClientForm.mobile,
          alternate_mobile: newClientForm.altMobile || null,
          address: newClientForm.address,
          dob: newClientForm.dob || null,
          status: "NEW_LEAD",
          outstanding_amount: parseFloat(newClientForm.outstandingAmount) || 0,
          due_date: newClientForm.dueDate || null,
          latitude: newClientForm.latitude ? parseFloat(newClientForm.latitude) : null,
          longitude: newClientForm.longitude ? parseFloat(newClientForm.longitude) : null,
          google_maps_link: newClientForm.googleMapsLink || null,
          area: newClientForm.area || null,
          pincode: newClientForm.pincode || null
        })
        .select()
        .single();

      if (clientErr) throw clientErr;

      // Insert sensitive details
      const { error: sensitiveErr } = await supabase
        .from("client_sensitive_details")
        .insert({
          client_id: newClient.client_id,
          ssn: newClientForm.ssn || null,
          credit_score: parseInt(newClientForm.creditScore) || null,
          private_notes: newClientForm.privateNotes || null,
          bureau_information: newClientForm.bureauInfo || null
        });

      if (sensitiveErr) throw sensitiveErr;

      setCreateDialogOpen(false);
      setNewClientForm({
        name: "",
        mobile: "",
        altMobile: "",
        address: "",
        dob: "",
        ssn: "",
        creditScore: "",
        privateNotes: "",
        bureauInfo: "",
        outstandingAmount: "",
        dueDate: "",
        latitude: "",
        longitude: "",
        googleMapsLink: "",
        area: "",
        pincode: ""
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to create client.");
    }
  };

  const handleStaffAssignment = async (roleType: "worker" | "telecaller", staffId: string) => {
    if (!selectedClient) return;
    try {
      let field = "";
      if (roleType === "worker") field = "assigned_worker";
      else if (roleType === "telecaller") field = "assigned_telecaller";

      const { error } = await supabase
        .from("clients")
        .update({ [field]: staffId || null })
        .eq("client_id", selectedClient.client_id);

      if (error) throw error;
      setSelectedClient((prev: any) => prev ? { ...prev, [field]: staffId || null } : null);
      loadData();
      alert("Assignments updated successfully.");
    } catch (err: any) {
      alert(err.message || "Assignment failed.");
    }
  };

  // --- TELECALLER COMMAND CENTER HANDLERS ---
  const handleCreatePTP = async () => {
    if (!selectedClient) return;
    if (!ptpAmount || !ptpDate) {
      alert("Please enter both PTP Amount and PTP Date.");
      return;
    }
    try {
      // 1. Update client status, stage, progress
      const { error: clientErr } = await supabase
        .from("clients")
        .update({
          status: "FOLLOW_UP",
          current_stage: "PTP",
          progress_percentage: 60,
          stage_updated_at: new Date().toISOString()
        })
        .eq("client_id", selectedClient.client_id);

      if (clientErr) throw clientErr;

      // 2. Log customer activity
      const { error: actErr } = await supabase
        .from("customer_activities")
        .insert({
          client_id: selectedClient.client_id,
          employee_id: user?.id,
          activity_type: "Outbound Call",
          call_result: "Connected",
          outcome: "PTP",
          notes: `[PTP Created] Promised Amount: ₹${ptpAmount} to be paid on ${ptpDate}.`
        });

      if (actErr) throw actErr;

      setPtpDialogOpen(false);
      setPtpAmount("");
      setPtpDate("");
      
      // Refresh
      await refreshSelectedClient(selectedClient.client_id);
      await loadData();
      alert("PTP successfully recorded.");
    } catch (err: any) {
      alert(err.message || "Failed to create PTP.");
    }
  };

  const handleScheduleFollowup = async () => {
    if (!selectedClient) return;
    if (!followupDate || !followupNotes) {
      alert("Please enter both follow-up date and notes.");
      return;
    }
    try {
      const scheduledTime = new Date(followupDate).toISOString();

      // 1. Update next follow up date
      const { error: clientErr } = await supabase
        .from("clients")
        .update({
          next_follow_up_date: scheduledTime,
          current_stage: "Follow-Up",
          progress_percentage: 45,
          stage_updated_at: new Date().toISOString()
        })
        .eq("client_id", selectedClient.client_id);

      if (clientErr) throw clientErr;

      // 2. Log Callback activity
      const { error: actErr } = await supabase
        .from("customer_activities")
        .insert({
          client_id: selectedClient.client_id,
          employee_id: user?.id,
          activity_type: "Callback",
          notes: `[Reminder] Scheduled follow-up callback. Notes: ${followupNotes}`,
          status: "PENDING",
          scheduled_time: scheduledTime
        });

      if (actErr) throw actErr;

      setFollowupDialogOpen(false);
      setFollowupDate("");
      setFollowupNotes("");

      await refreshSelectedClient(selectedClient.client_id);
      await loadData();
      alert("Follow-up callback scheduled.");
    } catch (err: any) {
      alert(err.message || "Failed to schedule follow-up.");
    }
  };

  const handleRequestVisit = async () => {
    if (!selectedClient) return;
    if (!visitWorkerId || !visitInstructions) {
      alert("Please assign a worker and enter visit instructions.");
      return;
    }
    try {
      // 1. Update client status, stage, worker
      const { error: clientErr } = await supabase
        .from("clients")
        .update({
          assigned_worker: visitWorkerId,
          current_stage: "Field Visit",
          progress_percentage: 75,
          stage_updated_at: new Date().toISOString()
        })
        .eq("client_id", selectedClient.client_id);

      if (clientErr) throw clientErr;

      // 2. Create task for the worker
      const { error: taskErr } = await supabase
        .from("tasks")
        .insert({
          client_id: selectedClient.client_id,
          assigned_worker_id: visitWorkerId,
          title: "Field Visit Request",
          description: visitInstructions,
          status: "PENDING",
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });

      if (taskErr) throw taskErr;

      // 3. Log Activity
      const { error: actErr } = await supabase
        .from("customer_activities")
        .insert({
          client_id: selectedClient.client_id,
          employee_id: user?.id,
          activity_type: "Field Visit",
          outcome: "Field Visit Assigned",
          notes: `[Field Visit Requested] Instructions: ${visitInstructions}`
        });

      if (actErr) throw actErr;

      setVisitRequestDialogOpen(false);
      setVisitInstructions("");
      setVisitWorkerId("");

      await refreshSelectedClient(selectedClient.client_id);
      await loadData();
      alert("Field Visit requested and worker assigned.");
    } catch (err: any) {
      alert(err.message || "Failed to request field visit.");
    }
  };

  const handleEscalateCase = async () => {
    if (!selectedClient) return;
    if (!escalationNotes) {
      alert("Please enter escalation notes.");
      return;
    }
    try {
      // 1. Log activity
      const { error: actErr } = await supabase
        .from("customer_activities")
        .insert({
          client_id: selectedClient.client_id,
          employee_id: user?.id,
          activity_type: "Escalation",
          outcome: "Case Escalated",
          notes: `[Escalated] ${escalationNotes}`
        });

      if (actErr) throw actErr;

      // 2. Update client
      const { error: clientErr } = await supabase
        .from("clients")
        .update({
          status: "REVIEW",
          stage_updated_at: new Date().toISOString()
        })
        .eq("client_id", selectedClient.client_id);

      if (clientErr) throw clientErr;

      setEscalateDialogOpen(false);
      setEscalationNotes("");

      await refreshSelectedClient(selectedClient.client_id);
      await loadData();
      alert("Case escalated.");
    } catch (err: any) {
      alert(err.message || "Failed to escalate case.");
    }
  };

  const handleMarkCollectionReceived = async () => {
    if (!selectedClient) return;
    const amount = parseFloat(collectedAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid positive collected amount.");
      return;
    }
    try {
      const currentOutstanding = selectedClient.outstanding_amount || 0;
      const currentCollections = parseFloat(selectedClient.total_collections) || 0;
      const newOutstanding = Math.max(0, currentOutstanding - amount);
      const newCollections = currentCollections + amount;
      const newStage = newOutstanding <= 0 ? "Closed" : "Payment Received";
      const newProgress = newOutstanding <= 0 ? 100 : 90;
      const newStatus = newOutstanding <= 0 ? "COMPLETED" : "FOLLOW_UP";

      // 1. Update client
      const { error: clientErr } = await supabase
        .from("clients")
        .update({
          outstanding_amount: newOutstanding,
          total_collections: newCollections,
          current_stage: newStage,
          progress_percentage: newProgress,
          status: newStatus,
          last_follow_up_date: new Date().toISOString(),
          stage_updated_at: new Date().toISOString()
        })
        .eq("client_id", selectedClient.client_id);

      if (clientErr) throw clientErr;

      // 2. Log Payment Activity
      const { error: actErr } = await supabase
        .from("customer_activities")
        .insert({
          client_id: selectedClient.client_id,
          employee_id: user?.id,
          activity_type: "Payment",
          outcome: "Payment Collected",
          notes: `[Payment Received] Amount: ₹${amount} collected via ${collectionMode}. Outstanding Balance is now: ₹${newOutstanding}.`
        });

      if (actErr) throw actErr;

      setCollectionDialogOpen(false);
      setCollectedAmount("");

      await refreshSelectedClient(selectedClient.client_id);
      await loadData();
      alert("Collection received and customer records updated.");
    } catch (err: any) {
      alert(err.message || "Failed to record payment collection.");
    }
  };

  const handleAddDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    try {
      const { error } = await supabase
        .from("disputes")
        .insert({
          client_id: selectedClient.client_id,
          bureau: disputeForm.bureau,
          category: disputeForm.category,
          item_disputed: disputeForm.itemDisputed,
          internal_notes: disputeForm.internalNotes || null,
          attachment_url: disputeForm.attachmentUrl || null,
          status: "PENDING",
          response_details: disputeForm.responseDetails || null
        });

      if (error) throw error;

      setDisputeForm({
        bureau: "EQUIFAX",
        category: "Wrong Personal Details",
        itemDisputed: "",
        internalNotes: "",
        attachmentUrl: "",
        status: "PENDING",
        responseDetails: ""
      });
      // Reload Disputes
      const { data } = await supabase
        .from("disputes")
        .select("*")
        .eq("client_id", selectedClient.client_id)
        .order("created_at", { ascending: false });
      if (data) setDisputes(data);
    } catch (err: any) {
      alert(err.message || "Failed to report issue.");
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    if (!activityForm.notes.trim()) {
      alert("Activity notes are required.");
      return;
    }

    const isCall = activityForm.activityType.includes("Call") || activityForm.activityType === "Callback";
    const isCallbackRequested = isCall && activityForm.callResult === "Callback Requested";
    const isFieldVisit = FIELD_ACTIVITY_TYPES.includes(activityForm.activityType);

    if (isCallbackRequested && !activityForm.callbackTime) {
      alert("Callback Date & Time is required when 'Callback Requested' is selected.");
      return;
    }

    // ── GPS Gate: block field visits if not GPS-verified ──
    if (isFieldVisit && gpsStatus !== "verified") {
      if (gpsStatus === "too_far") {
        alert(`❌ GPS Verification Failed\n\nYou are ${workerGps?.distance} meters away from the customer's registered location. You must be within ${VISIT_RADIUS_METERS} meters to log a field visit.\n\nPlease physically travel to the customer location and try again.`);
      } else if (gpsStatus === "no_coords") {
        alert("This customer has no registered GPS location. Please ask your manager to update the customer's coordinates before logging a field visit.");
      } else if (gpsStatus === "denied") {
        alert("GPS permission denied. Please allow location access in your browser to log field visits.");
      } else {
        alert("Please click 'Verify My Location' first before submitting a field visit.");
      }
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session.");

      const formattedCallbackTime = isCallbackRequested ? new Date(activityForm.callbackTime).toISOString() : null;

      // 1. Insert interaction log (RECORDED) — include GPS data if it's a field visit
      const { error: logErr } = await supabase
        .from("customer_activities")
        .insert({
          client_id: selectedClient.client_id,
          client_name: selectedClient.customer_name,
          client_mobile: selectedClient.mobile,
          created_by: session.user.id,
          activity_type: activityForm.activityType,
          call_result: isCall ? activityForm.callResult : null,
          outcome: activityForm.outcome,
          notes: activityForm.notes,
          callback_time: formattedCallbackTime,
          status: "RECORDED",
          ...(isFieldVisit && workerGps ? {
            worker_lat: workerGps.lat,
            worker_lng: workerGps.lng,
            gps_verified: true,
            distance_from_customer: workerGps.distance
          } : {})
        });

      if (logErr) throw logErr;

      // 2. Automatically insert scheduled reminder (PENDING callback activity) if callback is requested
      if (isCallbackRequested) {
        const { error: reminderErr } = await supabase
          .from("customer_activities")
          .insert({
            client_id: selectedClient.client_id,
            client_name: selectedClient.customer_name,
            client_mobile: selectedClient.mobile,
            created_by: session.user.id,
            activity_type: "Callback",
            call_result: "Callback Requested",
            outcome: "Follow-Up Required",
            notes: `[Reminder] Scheduled follow-up callback. Original Notes: ${activityForm.notes}`,
            callback_time: formattedCallbackTime,
            status: "PENDING"
          });

        if (reminderErr) throw reminderErr;
      }

      setActivityForm({
        activityType: "Outbound Call",
        callResult: "Connected",
        outcome: "Information Verified",
        notes: "",
        callbackTime: ""
      });
      setGpsStatus("idle");
      setWorkerGps(null);

      // Reload Activities
      await loadClientActivitiesAndVisits(selectedClient.client_id);
    } catch (err: any) {
      alert(err.message || "Failed to log activity.");
    }
  };

  const handleToggleActivityStatus = async (activityId: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === "PENDING" ? "COMPLETED" : "PENDING";
      const { error } = await supabase
        .from("customer_activities")
        .update({ status: nextStatus })
        .eq("activity_id", activityId);

      if (error) throw error;

      setActivities((prev) =>
        prev.map((act) => (act.activity_id === activityId ? { ...act, status: nextStatus } : act))
      );
    } catch (err: any) {
      alert(err.message || "Failed to update activity status.");
    }
  };

  const handleArchiveCurrentMonth = async () => {
    if (!window.confirm("Are you sure you want to archive all active clients created in the current month?")) return;
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0,0,0,0);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase
        .from("users")
        .select("agency_id")
        .eq("user_id", session.user.id)
        .single();
      if (!profile) return;

      const { error } = await supabase
        .from("clients")
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .gte("created_at", startOfMonth.toISOString())
        .eq("is_archived", false)
        .eq("agency_id", profile.agency_id);

      if (error) throw error;
      alert("Current month data archived successfully!");
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to archive current month data.");
    }
  };

  const handleDeleteArchived = async () => {
    if (!window.confirm("WARNING: This will permanently delete all archived clients. This action cannot be undone. Are you sure?")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase
        .from("users")
        .select("agency_id")
        .eq("user_id", session.user.id)
        .single();
      if (!profile) return;

      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("is_archived", true)
        .eq("agency_id", profile.agency_id);

      if (error) throw error;
      alert("Archived clients permanently deleted!");
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete archived data.");
    }
  };

  // TanStack Columns Configuration
  const columns = useMemo<ColumnDef<any>[]>(() => {
    const baseCols: ColumnDef<any>[] = [
      {
        accessorKey: "customer_name",
        header: "Client Name",
        cell: (info) => (
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {info.getValue() as string}
          </Typography>
        )
      },
      {
        accessorKey: "mobile",
        header: "Mobile"
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: (info) => {
          const val = info.getValue() as string;
          return (
            <Chip
              label={STAGE_LABELS[val] || val}
              color={val === "COMPLETED" ? "success" : "primary"}
              variant="outlined"
              size="small"
            />
          );
        }
      },
      {
        accessorKey: "worker.full_name",
        header: "Assigned Worker",
        cell: (info) => info.getValue() || "Unassigned"
      },
      {
        accessorKey: "manager.full_name",
        header: "Manager",
        cell: (info) => info.getValue() || "Unassigned"
      }
    ];

    return baseCols;
  }, []);

  const table = useReactTable({
    data: clients,
    columns,
    state: {
      globalFilter
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel()
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
      {/* Header controls */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Credit Repair Clients Console
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Process dispute records, progress workflows, or manage client entries.
          </Typography>
        </Box>

        {(isOwner || isManager) && (
          <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 1.5 }}>
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleArchiveCurrentMonth}
              startIcon={<Archive size={18} />}
            >
              Archive Current Month
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={handleDeleteArchived}
              startIcon={<Trash2 size={18} />}
            >
              Delete Archived Data
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setImportWizardOpen(true)}
              startIcon={<FileSpreadsheet size={18} />}
            >
              Spreadsheet Import
            </Button>
            <Button
              variant="contained"
              onClick={() => setCreateDialogOpen(true)}
              startIcon={<Plus size={18} />}
              sx={{ bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#222" } }}
            >
              Add New Client
            </Button>
          </Stack>
        )}
      </Box>

      {/* Global Search Filter */}
      <Card sx={{ p: 1 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              size="small"
              placeholder="Search clients..."
              value={searchFilter}
              onChange={(e) => {
                setSearchFilter(e.target.value);
                setGlobalFilter(e.target.value);
              }}
              InputProps={{
                startAdornment: <Search size={18} style={{ marginRight: 8, color: "gray" }} />
              }}
              sx={{ flexGrow: 1 }}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* TanStack Table UI */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} className="glass-panel">
          <MuiTable>
            <TableHead>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableCell key={header.id} sx={{ fontWeight: 700 }}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableCell>
                  ))}
                  <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} hover>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleClientSelect(row.original)}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </MuiTable>
          {/* Pagination controls */}
          <Box sx={{ display: "flex", justifyContent: "flex-end", p: 2, gap: 1 }}>
            <Button
              size="small"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              size="small"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </Box>
        </TableContainer>
      )}

      {/* Add Client Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Create New Client Profile
        </DialogTitle>
        <form onSubmit={handleCreateClient}>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Client Name"
                  required
                  value={newClientForm.name}
                  onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Mobile Number"
                  required
                  value={newClientForm.mobile}
                  onChange={(e) => setNewClientForm({ ...newClientForm, mobile: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Alternate Mobile"
                  value={newClientForm.altMobile}
                  onChange={(e) => setNewClientForm({ ...newClientForm, altMobile: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  required
                  value={newClientForm.address}
                  onChange={(e) => setNewClientForm({ ...newClientForm, address: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Area"
                  value={newClientForm.area}
                  onChange={(e) => setNewClientForm({ ...newClientForm, area: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Pincode"
                  value={newClientForm.pincode}
                  onChange={(e) => setNewClientForm({ ...newClientForm, pincode: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Latitude"
                  type="number"
                  slotProps={{ htmlInput: { step: "any" } }}
                  value={newClientForm.latitude}
                  onChange={(e) => setNewClientForm({ ...newClientForm, latitude: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Longitude"
                  type="number"
                  slotProps={{ htmlInput: { step: "any" } }}
                  value={newClientForm.longitude}
                  onChange={(e) => setNewClientForm({ ...newClientForm, longitude: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <Button variant="outlined" fullWidth onClick={autoLocate}>
                  Auto-Locate GPS Coordinates
                </Button>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Google Maps Location Link"
                  value={newClientForm.googleMapsLink}
                  onChange={(e) => setNewClientForm({ ...newClientForm, googleMapsLink: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Outstanding Amount (₹)"
                  type="number"
                  value={newClientForm.outstandingAmount}
                  onChange={(e) => setNewClientForm({ ...newClientForm, outstandingAmount: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Due Date"
                  type="date"
                  slotProps={{ inputLabel: { shrink: true } }}
                  value={newClientForm.dueDate}
                  onChange={(e) => setNewClientForm({ ...newClientForm, dueDate: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Date of Birth"
                  placeholder="YYYY-MM-DD"
                  value={newClientForm.dob}
                  onChange={(e) => setNewClientForm({ ...newClientForm, dob: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Credit Score"
                  type="number"
                  value={newClientForm.creditScore}
                  onChange={(e) => setNewClientForm({ ...newClientForm, creditScore: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="SSN / National ID"
                  value={newClientForm.ssn}
                  onChange={(e) => setNewClientForm({ ...newClientForm, ssn: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Bureau Information Summary"
                  value={newClientForm.bureauInfo}
                  onChange={(e) => setNewClientForm({ ...newClientForm, bureauInfo: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Private Owner / Manager Notes"
                  value={newClientForm.privateNotes}
                  onChange={(e) => setNewClientForm({ ...newClientForm, privateNotes: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button variant="text" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="contained" type="submit">
              Save Client Profile
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Excel Wizard */}
      <ExcelImportWizard
        open={importWizardOpen}
        onClose={() => setImportWizardOpen(false)}
        onImportComplete={loadData}
      />

      {/* Detail Drawer */}
      <Drawer
        anchor="right"
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        PaperProps={{ sx: { width: 550, p: 3, overflowY: "auto" } }}
      >
        {selectedClient && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Client File
              </Typography>
              <IconButton onClick={() => setDetailDrawerOpen(false)}>
                <X size={20} />
              </IconButton>
            </Stack>

            <Typography variant="h5" sx={{ fontWeight: 800, color: "primary.main", mb: 1 }}>
              {selectedClient.customer_name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Mobile: {selectedClient.mobile} | Address: {selectedClient.address}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<MapPin size={14} />}
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedClient.address)}`, '_blank')}
              sx={{ mb: 3 }}
            >
              Navigate to Customer
            </Button>

            {/* Client Progress Percentage */}
            {(() => {
              const currentStage = selectedClient.current_stage || (selectedClient.status === "COMPLETED" ? "Closed" : "New Lead");
              const progressPercent = selectedClient.progress_percentage || STAGE_PROGRESS[currentStage] || 15;
              const stageUpdatedAt = selectedClient.stage_updated_at || selectedClient.updated_at;
              const daysInStage = stageUpdatedAt ? Math.max(0, Math.floor((new Date().getTime() - new Date(stageUpdatedAt).getTime()) / (1000 * 60 * 60 * 24))) : 0;

              return (
                <Box sx={{ mb: 4, p: 2, bgcolor: "rgba(99, 102, 241, 0.04)", borderRadius: "12px", border: "1px solid rgba(99, 102, 241, 0.12)" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.primary" }}>
                      Lifecycle Progress
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "primary.main" }}>
                      {progressPercent}%
                    </Typography>
                  </Box>
                  
                  <LinearProgress 
                    variant="determinate" 
                    value={progressPercent} 
                    sx={{ 
                      height: 10, 
                      borderRadius: 5, 
                      bgcolor: "rgba(0,0,0,0.06)", 
                      "& .MuiLinearProgress-bar": {
                        borderRadius: 5,
                        background: "linear-gradient(90deg, #6366F1 0%, #45F3FF 100%)"
                      },
                      mb: 2
                    }} 
                  />

                  <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Current Stage</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: "primary.main" }}>
                        {currentStage}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography variant="caption" color="text.secondary">Time in Stage</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {daysInStage} {daysInStage === 1 ? "day" : "days"}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: "flex", gap: 1, overflowX: "auto", py: 1, mt: 2, "&::-webkit-scrollbar": { height: 4 } }}>
                    {STAGE_LIST.map((stage) => {
                      const isActive = currentStage === stage;
                      return (
                        <Chip
                          key={stage}
                          label={stage}
                          size="small"
                          color={isActive ? "primary" : "default"}
                          variant={isActive ? "filled" : "outlined"}
                          sx={{ 
                            fontSize: "0.68rem", 
                            fontWeight: isActive ? 700 : 400,
                            cursor: "pointer"
                          }}
                          onClick={async () => {
                            try {
                              const p = STAGE_PROGRESS[stage] || 15;
                              const { error } = await supabase
                                .from("clients")
                                .update({
                                  current_stage: stage,
                                  progress_percentage: p,
                                  stage_updated_at: new Date().toISOString()
                                })
                                .eq("client_id", selectedClient.client_id);
                              if (error) throw error;
                              setSelectedClient((prev: any) => ({
                                ...prev,
                                current_stage: stage,
                                progress_percentage: p,
                                stage_updated_at: new Date().toISOString()
                              }));
                              loadData();
                            } catch (err: any) {
                              alert(err.message);
                            }
                          }}
                        />
                      );
                    })}
                  </Box>
                </Box>
              );
            })()}

            <Divider sx={{ my: 3 }} />

            {/* Staff Assignment Actions */}
            {(isOwner || isManager || user?.role === "TELECALLER") && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                  Assign Case Ownership
                </Typography>
                <Grid container spacing={2}>
                  {(isOwner || isManager) && (
                    <Grid item xs={6}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Primary Telecaller"
                        value={selectedClient.assigned_telecaller || ""}
                        onChange={(e) => handleStaffAssignment("telecaller", e.target.value)}
                      >
                        <MenuItem value="">Unassigned</MenuItem>
                        {staff
                          .filter((s) => s.role === "telecaller")
                          .map((t) => (
                            <MenuItem key={t.user_id} value={t.user_id}>
                              {t.full_name}
                            </MenuItem>
                          ))}
                      </TextField>
                    </Grid>
                  )}
                  <Grid item xs={isOwner || isManager ? 6 : 12}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Assigned Field Worker"
                      value={selectedClient.assigned_worker || ""}
                      onChange={(e) => handleStaffAssignment("worker", e.target.value)}
                    >
                      <MenuItem value="">Unassigned</MenuItem>
                      {staff
                        .filter((s) => s.role === "worker")
                        .map((w) => (
                          <MenuItem key={w.user_id} value={w.user_id}>
                            {w.full_name}
                          </MenuItem>
                        ))}
                    </TextField>
                  </Grid>
                </Grid>
              </Box>
            )}

            <Divider sx={{ my: 3 }} />

            {/* Case Ownership Details Panel */}
            {(() => {
              const telecallerName = selectedClient.telecaller?.full_name || "Unassigned";
              const telecallerEmpId = selectedClient.telecaller?.employees?.[0]?.employee_id || "N/A";
              const telecallerPhone = selectedClient.telecaller?.phone || "N/A";
              const tcActiveCases = clients.filter((c: any) => c.assigned_telecaller === selectedClient.assigned_telecaller).length;

              const workerName = selectedClient.worker?.full_name || "Unassigned";
              const workerEmpId = selectedClient.worker?.employees?.[0]?.employee_id || "N/A";
              const workerLastVisit = selectedClient.last_visit_date ? new Date(selectedClient.last_visit_date).toLocaleDateString() : "No visits";
              const workerTotalVisits = visits.length;

              return (
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                    Case Ownership Details
                  </Typography>
                  <Grid container spacing={2}>
                    {/* Primary Telecaller Card */}
                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined" sx={{ p: 2, height: "100%", bgcolor: "rgba(0, 0, 0, 0.02)" }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "primary.main", mb: 1 }}>
                          Primary Telecaller
                        </Typography>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{telecallerName}</Typography>
                          <Typography variant="caption" color="text.secondary">Emp ID: {telecallerEmpId}</Typography>
                          <Typography variant="caption" color="text.secondary">Phone: {telecallerPhone}</Typography>
                          <Typography variant="caption" color="text.secondary">Active Cases: {tcActiveCases}</Typography>
                          <Typography variant="caption" color="text.secondary">Rating: 4.8 / 5.0 ⭐</Typography>
                        </Stack>
                      </Card>
                    </Grid>

                    {/* Assigned Field Worker Card */}
                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined" sx={{ p: 2, height: "100%", bgcolor: "rgba(0, 0, 0, 0.02)" }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "primary.main", mb: 1 }}>
                          Field Worker
                        </Typography>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{workerName}</Typography>
                          <Typography variant="caption" color="text.secondary">Emp ID: {workerEmpId}</Typography>
                          <Typography variant="caption" color="text.secondary">Total Visits: {workerTotalVisits}</Typography>
                          <Typography variant="caption" color="text.secondary">Last Visit: {workerLastVisit}</Typography>
                        </Stack>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>
              );
            })()}

            <Divider sx={{ my: 3 }} />

            {/* Telecaller Command Center */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Telecaller Command Center
              </Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={6}>
                  <Button 
                    fullWidth 
                    variant="contained" 
                    size="small" 
                    sx={{ bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#222" } }}
                    onClick={() => {
                      if (selectedClient.assigned_worker) {
                        setVisitWorkerId(selectedClient.assigned_worker);
                      }
                      setVisitRequestDialogOpen(true);
                    }}
                  >
                    Request Field Visit
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button 
                    fullWidth 
                    variant="contained" 
                    size="small" 
                    sx={{ bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#222" } }}
                    onClick={() => setPtpDialogOpen(true)}
                  >
                    Create PTP
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button 
                    fullWidth 
                    variant="contained" 
                    size="small" 
                    sx={{ bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#222" } }}
                    onClick={() => setFollowupDialogOpen(true)}
                  >
                    Schedule Follow-Up
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button 
                    fullWidth 
                    variant="contained" 
                    size="small" 
                    sx={{ bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#222" } }}
                    onClick={() => setCollectionDialogOpen(true)}
                  >
                    Mark Collection Received
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button 
                    fullWidth 
                    variant="outlined" 
                    size="small" 
                    color="error"
                    onClick={() => setEscalateDialogOpen(true)}
                  >
                    Escalate Case
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button 
                    fullWidth 
                    variant="outlined" 
                    size="small" 
                    onClick={() => {
                      const noteTextarea = document.getElementById("timeline-notes-input");
                      if (noteTextarea) {
                        noteTextarea.focus();
                      }
                    }}
                  >
                    Add Activity Note
                  </Button>
                </Grid>
              </Grid>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Field Worker Progress & Geo Verification Panel */}
            {selectedClient.assigned_worker && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                  Field Worker Progress Tracking
                </Typography>
                {(() => {
                  const workerName = selectedClient.worker?.full_name || "Unassigned";
                  const casesAssigned = clients.filter((c: any) => c.assigned_worker === selectedClient.assigned_worker).length;
                  const visitsCompleted = visits.filter((v: any) => v.check_out_time !== null).length;
                  const visitsPending = Math.max(0, casesAssigned - visitsCompleted);

                  return (
                    <Box sx={{ mb: 2, p: 2, bgcolor: "rgba(0, 0, 0, 0.02)", borderRadius: "8px", border: "1px solid rgba(0, 0, 0, 0.05)" }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                        Status of {workerName}
                      </Typography>
                      <Grid container spacing={1.5} sx={{ mb: 2 }}>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Cases Assigned</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{casesAssigned}</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Completed Visits</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: "success.main" }}>{visitsCompleted}</Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" color="text.secondary">Pending Visits</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: "warning.main" }}>{visitsPending}</Typography>
                        </Grid>
                      </Grid>

                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                        Visit Geo Verifications
                      </Typography>
                      {visits.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">No visit records logged for this case.</Typography>
                      ) : (
                        <Stack spacing={1.5}>
                          {visits.map((v: any) => {
                            const isGpsVerified = v.check_in_lat && v.check_in_lng && selectedClient.latitude && selectedClient.longitude &&
                              getDistanceMeters(parseFloat(v.check_in_lat), parseFloat(v.check_in_lng), selectedClient.latitude, selectedClient.longitude) <= 200;

                            return (
                              <Box key={v.visit_id} sx={{ p: 1, border: "1px solid", borderColor: "divider", borderRadius: "6px", bgcolor: "#fff" }}>
                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {new Date(v.check_in_time).toLocaleDateString()}
                                  </Typography>
                                  <Chip 
                                    label={isGpsVerified ? "GPS Verified" : "Verification Failed"}
                                    size="small"
                                    color={isGpsVerified ? "success" : "error"}
                                    variant="outlined"
                                    sx={{ fontSize: "0.65rem", height: 18 }}
                                  />
                                </Box>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  Check-In: {new Date(v.check_in_time).toLocaleTimeString()} 
                                  {v.check_out_time ? ` | Check-Out: ${new Date(v.check_out_time).toLocaleTimeString()}` : " (Active Now)"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  Coordinates: {parseFloat(v.check_in_lat || 0).toFixed(4)}, {parseFloat(v.check_in_lng || 0).toFixed(4)}
                                </Typography>
                                {v.outcome && (
                                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }} display="block">
                                    Outcome: {v.outcome}
                                  </Typography>
                                )}
                              </Box>
                            );
                          })}
                        </Stack>
                      )}
                    </Box>
                  );
                })()}
              </Box>
            )}

            <Divider sx={{ my: 3 }} />

            {/* Sensitive Information Panel */}
            {sensitiveDetails ? (
              <Box sx={{ mb: 4, p: 2, bgcolor: "rgba(99, 102, 241, 0.04)", borderRadius: "8px", border: "1px solid", borderColor: "divider" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: "primary.main", display: "flex", alignItems: "center", gap: 1 }}>
                  <Shield size={18} /> Sensitive Administrative Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Credit Score</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {sensitiveDetails.credit_score || "Not Analyzed"}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">SSN / ID Number</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {sensitiveDetails.ssn || "N/A"}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Bureau Information Details</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {sensitiveDetails.bureau_information || "No details loaded."}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Private Owner/Manager Notes</Typography>
                    <Typography variant="body2" sx={{ fontStyle: "italic", whiteSpace: "pre-wrap" }}>
                      {sensitiveDetails.private_notes || "No notes logged."}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            ) : (
              isWorker && (
                <Alert severity="info" icon={<Shield size={18} />} sx={{ mb: 3 }}>
                  Worker Access: Sensitive credit indices and admin remarks are isolated and hidden.
                </Alert>
              )
            )}

            <Divider sx={{ my: 3 }} />

            {/* Dispute Logs Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                <HelpCircle size={18} /> Credit Report Correction Requests
              </Typography>

              {/* Information Card */}
              <Card variant="outlined" sx={{ p: 2, mb: 3, bgcolor: "rgba(59, 130, 246, 0.04)", borderColor: "#E5E7EB", borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#111827", mb: 0.5 }}>
                  What is a Credit Report Issue?
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  A credit report issue is any incorrect information found in a customer's credit report. Reporting these issues helps ensure customer records remain accurate and up to date.
                </Typography>
              </Card>

              {/* Add Dispute Form */}
              <Card variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 2 }}>
                  Report New Credit Report Issue
                </Typography>
                <form onSubmit={handleAddDispute}>
                  <Stack spacing={2}>
                    <TextField
                      select
                      size="small"
                      label="Credit Report Company"
                      helperText="Select the company where the issue exists in the customer's credit report."
                      value={disputeForm.bureau}
                      onChange={(e) => setDisputeForm({ ...disputeForm, bureau: e.target.value })}
                      fullWidth
                    >
                      <MenuItem value="EQUIFAX">Equifax</MenuItem>
                      <MenuItem value="EXPERIAN">Experian</MenuItem>
                      <MenuItem value="TRANSUNION">TransUnion</MenuItem>
                    </TextField>

                    <TextField
                      select
                      size="small"
                      label="Issue Category"
                      value={disputeForm.category}
                      onChange={(e) => setDisputeForm({ ...disputeForm, category: e.target.value })}
                      fullWidth
                    >
                      <MenuItem value="Wrong Personal Details">Wrong Personal Details</MenuItem>
                      <MenuItem value="Loan Information Error">Loan Information Error</MenuItem>
                      <MenuItem value="Payment Record Error">Payment Record Error</MenuItem>
                      <MenuItem value="Duplicate Account">Duplicate Account</MenuItem>
                      <MenuItem value="Closed Account Still Active">Closed Account Still Active</MenuItem>
                      <MenuItem value="Other">Other</MenuItem>
                    </TextField>

                    <TextField
                      size="small"
                      label="Issue Found in Credit Report"
                      placeholder="Describe the issue found in the customer's credit report."
                      helperText="Examples: Paid loan still showing unpaid, duplicate loan account, wrong customer name, incorrect payment history."
                      value={disputeForm.itemDisputed}
                      onChange={(e) => setDisputeForm({ ...disputeForm, itemDisputed: e.target.value })}
                      required
                      multiline
                      rows={2}
                      fullWidth
                    />

                    <TextField
                      size="small"
                      label="Internal Notes"
                      placeholder="Add internal comments or staff notes here."
                      value={disputeForm.internalNotes}
                      onChange={(e) => setDisputeForm({ ...disputeForm, internalNotes: e.target.value })}
                      multiline
                      rows={1}
                      fullWidth
                    />

                    <TextField
                      size="small"
                      label="Supporting Document Link"
                      placeholder="Link to supporting proof (e.g. Google Drive/Dropbox/Supabase file link)"
                      value={disputeForm.attachmentUrl}
                      onChange={(e) => setDisputeForm({ ...disputeForm, attachmentUrl: e.target.value })}
                      fullWidth
                    />

                    <Button variant="contained" type="submit" size="medium" sx={{ alignSelf: "flex-start", bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#222" } }}>
                      Report Issue
                    </Button>
                  </Stack>
                </form>
              </Card>

              {disputes.length > 0 ? (
                <Stack spacing={1.5}>
                  {disputes.map((disp) => {
                    const statusLabel =
                      disp.status === "PENDING"
                        ? "Waiting for Review"
                        : disp.status === "SENT" || disp.status === "SUBMITTED"
                        ? "Sent for Verification"
                        : disp.status === "IN_REVIEW"
                        ? "Under Checking"
                        : disp.status === "RESOLVED"
                        ? "Corrected"
                        : disp.status === "REJECTED"
                        ? "Not Approved"
                        : disp.status;
                    
                    const statusColor =
                      disp.status === "RESOLVED"
                        ? "success"
                        : disp.status === "REJECTED"
                        ? "error"
                        : "warning";

                    return (
                      <Card key={disp.dispute_id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {disp.bureau === "EQUIFAX" ? "Equifax" : disp.bureau === "EXPERIAN" ? "Experian" : "TransUnion"}
                          </Typography>
                          <Chip
                            label={statusLabel}
                            size="small"
                            color={statusColor}
                            variant="outlined"
                          />
                        </Stack>
                        
                        {disp.category && (
                          <Typography variant="caption" display="block" sx={{ fontWeight: 600, color: "text.secondary", mb: 0.5 }}>
                            Category: {disp.category}
                          </Typography>
                        )}
                        
                        <Typography variant="body2" sx={{ color: "#111827", mb: disp.internal_notes || disp.attachment_url ? 1.5 : 0 }}>
                          {disp.item_disputed}
                        </Typography>

                        {disp.internal_notes && (
                          <Box sx={{ mb: 1, p: 1, bgcolor: "#F9FAFB", borderRadius: 1 }}>
                            <Typography variant="caption" display="block" sx={{ color: "text.secondary", fontStyle: "italic" }}>
                              Staff Notes: {disp.internal_notes}
                            </Typography>
                          </Box>
                        )}

                        {disp.attachment_url && (
                          <Typography variant="caption" display="block">
                            Supporting Proof:{" "}
                            <a
                              href={disp.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "#3B82F6", textDecoration: "underline", fontWeight: 500 }}
                            >
                              View Document
                            </a>
                          </Typography>
                        )}
                      </Card>
                    );
                  })}
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  No correction requests reported for this client.
                </Typography>
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Customer Activity Log & Follow-Up Tracker */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <Phone size={18} /> Customer Activity Log & Follow-Up Tracker
              </Typography>

              {/* Log New Activity Form */}
              <Card variant="outlined" sx={{ p: 2, mb: 3, bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                  Log New Interaction / Task
                </Typography>
                <form onSubmit={handleAddActivity}>
                  <Stack spacing={2}>
                    <TextField
                      select
                      size="small"
                      label="Activity Type"
                      value={activityForm.activityType}
                      onChange={(e) => {
                        setActivityForm({ ...activityForm, activityType: e.target.value });
                        setGpsStatus("idle");
                        setWorkerGps(null);
                      }}
                      fullWidth
                    >
                      <MenuItem value="Outbound Call">Outbound Call</MenuItem>
                      <MenuItem value="Incoming Call">Incoming Call</MenuItem>
                      <MenuItem value="Callback">Callback</MenuItem>
                      <MenuItem value="Follow-Up Call">Follow-Up Call</MenuItem>
                      <MenuItem value="Customer Meeting">🏢 Customer Meeting (GPS Required)</MenuItem>
                      <MenuItem value="Field Visit">📍 Field Visit (GPS Required)</MenuItem>
                      <MenuItem value="Address Verification">🗺️ Address Verification (GPS Required)</MenuItem>
                    </TextField>

                    {/* GPS Verification Panel — shown only for field visit types */}
                    {FIELD_ACTIVITY_TYPES.includes(activityForm.activityType) && (
                      <Box sx={{ border: "1px solid", borderColor: gpsStatus === "verified" ? "success.main" : gpsStatus === "too_far" || gpsStatus === "denied" ? "error.main" : "warning.main", borderRadius: 2, p: 1.5 }}>
                        {/* No coords registered */}
                        {gpsStatus === "no_coords" && (
                          <Alert severity="warning" sx={{ mb: 1 }}>
                            This customer has no registered GPS coordinates. Please ask your manager to update the customer location before logging a field visit.
                          </Alert>
                        )}

                        {/* Denied / not checked yet */}
                        {(gpsStatus === "idle" || gpsStatus === "denied") && (
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                📍 GPS Verification Required
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                You must be within {VISIT_RADIUS_METERS}m of the customer to log this activity.
                                {gpsStatus === "denied" && " GPS access was denied — please enable location in browser settings."}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              onClick={verifyGpsForVisit}
                              sx={{ ml: 1, whiteSpace: "nowrap" }}
                            >
                              Verify My Location
                            </Button>
                          </Stack>
                        )}

                        {/* Checking */}
                        {gpsStatus === "checking" && (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <CircularProgress size={16} />
                            <Typography variant="body2" color="text.secondary">Fetching your GPS location...</Typography>
                          </Stack>
                        )}

                        {/* Verified */}
                        {gpsStatus === "verified" && workerGps && (
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="body2" sx={{ color: "success.main", fontWeight: 700 }}>
                              ✅ GPS Verified — You are {workerGps.distance}m from customer
                            </Typography>
                          </Stack>
                        )}

                        {/* Too far */}
                        {gpsStatus === "too_far" && workerGps && (
                          <Stack>
                            <Typography variant="body2" sx={{ color: "error.main", fontWeight: 700 }}>
                              ❌ Too Far — You are {workerGps.distance}m away (limit: {VISIT_RADIUS_METERS}m)
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Travel closer to the customer location and try again.
                            </Typography>
                            <Button size="small" variant="text" color="error" onClick={verifyGpsForVisit} sx={{ mt: 0.5, alignSelf: "flex-start", p: 0 }}>
                              Re-check Location
                            </Button>
                          </Stack>
                        )}
                      </Box>
                    )}

                    {/* Show Call Result only if it is a call/callback activity */}
                    {(activityForm.activityType.includes("Call") || activityForm.activityType === "Callback") && (
                      <TextField
                        select
                        size="small"
                        label="Call Result"
                        value={activityForm.callResult}
                        onChange={(e) => setActivityForm({ ...activityForm, callResult: e.target.value })}
                        fullWidth
                      >
                        <MenuItem value="Connected">Connected</MenuItem>
                        <MenuItem value="No Answer">No Answer</MenuItem>
                        <MenuItem value="Busy">Busy</MenuItem>
                        <MenuItem value="Switched Off">Switched Off</MenuItem>
                        <MenuItem value="Wrong Number">Wrong Number</MenuItem>
                        <MenuItem value="Callback Requested">Callback Requested</MenuItem>
                      </TextField>
                    )}

                    {/* Show Callback Date/Time if Callback Requested is selected */}
                    {activityForm.activityType.includes("Call") && activityForm.callResult === "Callback Requested" && (
                      <TextField
                        type="datetime-local"
                        size="small"
                        label="Callback Date & Time"
                        InputLabelProps={{ shrink: true }}
                        value={activityForm.callbackTime}
                        onChange={(e) => setActivityForm({ ...activityForm, callbackTime: e.target.value })}
                        fullWidth
                        required
                      />
                    )}

                    <TextField
                      select
                      size="small"
                      label="Conversation Outcome"
                      value={activityForm.outcome}
                      onChange={(e) => setActivityForm({ ...activityForm, outcome: e.target.value })}
                      fullWidth
                    >
                      <MenuItem value="Information Verified">Information Verified</MenuItem>
                      <MenuItem value="Follow-Up Required">Follow-Up Required</MenuItem>
                      <MenuItem value="Customer Interested">Customer Interested</MenuItem>
                      <MenuItem value="Customer Not Interested">Customer Not Interested</MenuItem>
                      <MenuItem value="Case Closed">Case Closed</MenuItem>
                    </TextField>

                    <TextField
                      size="small"
                      label="Interaction Notes"
                      placeholder="Describe what was discussed or action taken..."
                      multiline
                      rows={2}
                      value={activityForm.notes}
                      onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
                      fullWidth
                      required
                    />

                    <Button variant="contained" type="submit" size="small" sx={{ alignSelf: "flex-end", bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#222" } }}>
                      Log Interaction
                    </Button>
                  </Stack>
                </form>
              </Card>

              {/* Pending Follow-Ups & Callbacks List */}
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
                <Clock size={16} /> Pending Follow-Ups & Reminders
              </Typography>
              {activities.filter(a => a.status === "PENDING").length > 0 ? (
                <Stack spacing={1} sx={{ mb: 3 }}>
                  {activities.filter(a => a.status === "PENDING").map((act) => (
                    <Card
                      key={act.activity_id}
                      variant="outlined"
                      sx={{ p: 1.5, borderLeft: "4px solid", borderColor: "warning.main", bgcolor: "rgba(245, 158, 11, 0.02)" }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {act.activity_type} - {act.call_result || "Pending"}
                          </Typography>
                          {act.callback_time && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              Scheduled for: {new Date(act.callback_time).toLocaleString()}
                            </Typography>
                          )}
                          <Typography variant="caption" display="block" sx={{ fontStyle: "italic", mt: 0.5 }}>
                            {act.notes}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          onClick={() => handleToggleActivityStatus(act.activity_id, act.status)}
                          sx={{ py: 0, px: 1, minWidth: 0, fontSize: "11px" }}
                        >
                          Complete
                        </Button>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 3 }}>
                  No pending follow-ups or callbacks scheduled.
                </Typography>
              )}

              {/* Interaction History Timeline */}
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                Interaction History & Logs
              </Typography>
              {timeline.length > 0 ? (
                <Stack spacing={1.5}>
                  {timeline.map((act) => (
                    <Card
                      key={act.id}
                      variant="outlined"
                      sx={{
                        p: 2,
                        bgcolor: act.status === "COMPLETED" ? "rgba(76, 175, 80, 0.02)" : act.type === "visit" ? "rgba(99, 102, 241, 0.02)" : "inherit",
                        borderLeft: act.type === "visit" 
                          ? `3px solid #6366F1` 
                          : FIELD_ACTIVITY_TYPES.includes(act.activity_type)
                          ? `3px solid ${act.gps_verified ? "#10B981" : "#EF4444"}`
                          : undefined
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {act.activity_type} {act.call_result ? `(${act.call_result})` : ""}
                        </Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {/* GPS badge */}
                          {act.gps_verified !== undefined && (
                            <Chip
                              label={act.gps_verified ? `✅ GPS Verified · ${act.distance_from_customer}m` : "⚠️ Not GPS Verified"}
                              size="small"
                              sx={{
                                fontSize: "10px",
                                bgcolor: act.gps_verified ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                                color: act.gps_verified ? "#10B981" : "#EF4444",
                                border: `1px solid ${act.gps_verified ? "#10B981" : "#EF4444"}`,
                                fontWeight: 700
                              }}
                            />
                          )}
                          <Chip
                            label={act.outcome || act.status}
                            size="small"
                            variant="outlined"
                            color={
                              act.outcome === "Case Closed" || act.outcome === "Payment Collected" || act.outcome === "PTP"
                                ? "success"
                                : act.outcome === "Follow-Up Required"
                                ? "warning"
                                : "default"
                            }
                            sx={{ fontSize: "10px" }}
                          />
                        </Stack>
                      </Stack>
                      <Typography variant="body2" sx={{ color: "text.primary", mb: 1 }}>
                        {act.notes}
                      </Typography>
                      
                      {/* Visit specific details & files */}
                      {act.type === "visit" && (
                        <Box sx={{ mt: 1.5, pt: 1, borderTop: "1px dashed rgba(0,0,0,0.08)" }}>
                          {act.check_out_time && (
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1 }}>
                              <strong>Check-Out:</strong> {new Date(act.check_out_time).toLocaleString()} 
                              {act.duration_seconds && ` · Duration: ${Math.floor(act.duration_seconds / 60)}m ${act.duration_seconds % 60}s`}
                            </Typography>
                          )}
                          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                            {act.photo_url && (
                              <Button
                                size="small"
                                variant="outlined"
                                href={act.photo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ fontSize: "10px", py: 0.2 }}
                              >
                                View Photo Proof
                              </Button>
                            )}
                            {act.signature_url && (
                              <Button
                                size="small"
                                variant="outlined"
                                href={act.signature_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ fontSize: "10px", py: 0.2 }}
                              >
                                View Signature
                              </Button>
                            )}
                            {act.receipt_url && (
                              <Button
                                size="small"
                                variant="outlined"
                                href={act.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ fontSize: "10px", py: 0.2 }}
                              >
                                View Receipt
                              </Button>
                            )}
                            {act.document_url && (
                              <Button
                                size="small"
                                variant="outlined"
                                href={act.document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ fontSize: "10px", py: 0.2 }}
                              >
                                View Document
                              </Button>
                            )}
                          </Stack>
                        </Box>
                      )}

                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        Logged by: {act.creator_name} ({act.creator_role}) on {new Date(act.timestamp).toLocaleString()}
                      </Typography>
                    </Card>
                  ))}
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary" display="block">
                  No activity history logged.
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Drawer>

      {/* PTP Dialog */}
      <Dialog open={ptpDialogOpen} onClose={() => setPtpDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Create Promise To Pay (PTP)</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="PTP Amount (₹)"
              type="number"
              fullWidth
              value={ptpAmount}
              onChange={(e) => setPtpAmount(e.target.value)}
            />
            <TextField
              label="Promise Date"
              type="date"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              value={ptpDate}
              onChange={(e) => setPtpDate(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPtpDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" sx={{ bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#222" } }} onClick={handleCreatePTP}>
            Save PTP
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Follow-up Dialog */}
      <Dialog open={followupDialogOpen} onClose={() => setFollowupDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Schedule Callback Follow-Up</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Follow-Up Date & Time"
              type="datetime-local"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              value={followupDate}
              onChange={(e) => setFollowupDate(e.target.value)}
            />
            <TextField
              label="Follow-Up Notes"
              multiline
              rows={3}
              fullWidth
              value={followupNotes}
              onChange={(e) => setFollowupNotes(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFollowupDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" sx={{ bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#222" } }} onClick={handleScheduleFollowup}>
            Schedule Callback
          </Button>
        </DialogActions>
      </Dialog>

      {/* Request Visit Dialog */}
      <Dialog open={visitRequestDialogOpen} onClose={() => setVisitRequestDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Assign & Request Field Visit</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Field Worker"
              fullWidth
              value={visitWorkerId}
              onChange={(e) => setVisitWorkerId(e.target.value)}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {staff
                .filter((s) => s.role === "worker")
                .map((w) => (
                  <MenuItem key={w.user_id} value={w.user_id}>
                    {w.full_name}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              label="Visit Instructions / Details"
              multiline
              rows={3}
              fullWidth
              value={visitInstructions}
              onChange={(e) => setVisitInstructions(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVisitRequestDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" sx={{ bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#222" } }} onClick={handleRequestVisit}>
            Request Visit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Escalate Case Dialog */}
      <Dialog open={escalateDialogOpen} onClose={() => setEscalateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Escalate Case to Owner/Manager</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Reason for Escalation"
              multiline
              rows={4}
              fullWidth
              placeholder="Describe why this customer file requires escalation..."
              value={escalationNotes}
              onChange={(e) => setEscalationNotes(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEscalateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleEscalateCase}>
            Escalate Case
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mark Collection Received Dialog */}
      <Dialog open={collectionDialogOpen} onClose={() => setCollectionDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Record Payment Collection</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Collected Amount (₹)"
              type="number"
              fullWidth
              value={collectedAmount}
              onChange={(e) => setCollectedAmount(e.target.value)}
            />
            <TextField
              select
              label="Payment Mode"
              fullWidth
              value={collectionMode}
              onChange={(e) => setCollectionMode(e.target.value)}
            >
              <MenuItem value="UPI">UPI (GPay / PhonePe / Paytm)</MenuItem>
              <MenuItem value="Cash">Cash Handover</MenuItem>
              <MenuItem value="Card">Debit / Credit Card</MenuItem>
              <MenuItem value="Net Banking">Net Banking Transfer</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCollectionDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" sx={{ bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#222" } }} onClick={handleMarkCollectionReceived}>
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
