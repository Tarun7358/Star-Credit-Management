import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../utils/supabaseClient";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  MenuItem,
  TextField,
  Alert,
  CircularProgress,
  Stack,
  Card,
  Grid
} from "@mui/material";
import { Check, AlertTriangle, Upload, ChevronRight, RefreshCw, UserCheck } from "lucide-react";

interface ExcelImportWizardProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

const steps = ["Upload File", "Map Columns", "Review & Validate"];

const targetFields = [
  { key: "customerName", label: "Customer Name *", required: true },
  { key: "mobile", label: "Mobile Number *", required: true },
  { key: "alternateMobile", label: "Alternate Mobile", required: false },
  { key: "address", label: "Address *", required: true },
  { key: "city", label: "City", required: false },
  { key: "state", label: "State", required: false },
  { key: "pincode", label: "Pincode", required: false },
  { key: "assignedWorker", label: "Assigned Employee (Field worker)", required: false },
  { key: "assignedTelecaller", label: "Telecaller", required: false },
  { key: "team", label: "Team", required: false },
  { key: "priority", label: "Priority", required: false },
  { key: "status", label: "Status", required: false }
];

export const ExcelImportWizard: React.FC<ExcelImportWizardProps> = ({
  open,
  onClose,
  onImportComplete
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [recordsToImport, setRecordsToImport] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Agency users & name mapping states
  const [agencyUsers, setAgencyUsers] = useState<any[]>([]);
  const [unresolvedNames, setUnresolvedNames] = useState<string[]>([]);
  const [resolvedMapping, setResolvedMapping] = useState<Record<string, string>>({}); // name -> user_id

  // Import stats summary
  const [importSummary, setImportSummary] = useState({
    total: 0,
    success: 0,
    duplicates: 0,
    failed: 0,
    missingFields: 0
  });

  useEffect(() => {
    if (open) {
      fetchAgencyUsers();
    }
  }, [open]);

  const fetchAgencyUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase
        .from("users")
        .select("agency_id")
        .eq("user_id", session.user.id)
        .single();
      if (!profile) return;

      const { data: users } = await supabase
        .from("users")
        .select("user_id, full_name, role")
        .eq("agency_id", profile.agency_id);
      if (users) {
        setAgencyUsers(users);
      }
    } catch (err) {
      console.error("Error fetching agency users:", err);
    }
  };

  const resetState = () => {
    setActiveStep(0);
    setFileHeaders([]);
    setParsedRows([]);
    setMappings({});
    setValidationErrors([]);
    setRecordsToImport([]);
    setUnresolvedNames([]);
    setResolvedMapping({});
    setErrorMsg("");
    setImportSummary({
      total: 0,
      success: 0,
      duplicates: 0,
      failed: 0,
      missingFields: 0
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg("");
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          setErrorMsg("The uploaded file does not contain any rows of data.");
          setLoading(false);
          return;
        }

        const headers = Object.keys(data[0]);
        setFileHeaders(headers);
        setParsedRows(data);

        // Auto-match headers to fields by keyword matching
        const initialMappings: Record<string, string> = {};
        targetFields.forEach((field) => {
          const match = headers.find((h) => {
            const hl = h.toLowerCase().replace(/[\s_-]+/g, "");
            const kl = field.key.toLowerCase();
            if (hl.includes(kl) || kl.includes(hl)) return true;
            if (field.key === "customerName" && (hl.includes("name") || hl.includes("client") || hl.includes("customer"))) return true;
            if (field.key === "mobile" && (hl.includes("phone") || hl.includes("contact") || hl.includes("mobile"))) return true;
            if (field.key === "assignedWorker" && (hl.includes("employee") || hl.includes("worker") || hl.includes("field") || hl.includes("executive"))) return true;
            if (field.key === "assignedTelecaller" && (hl.includes("telecaller") || hl.includes("caller"))) return true;
            if (field.key === "pincode" && (hl.includes("pincode") || hl.includes("pin") || hl.includes("zip"))) return true;
            return false;
          });
          if (match) {
            initialMappings[field.key] = match;
          }
        });

        setMappings(initialMappings);
        setActiveStep(1);
      } catch (err) {
        setErrorMsg("Failed to read file. Please ensure it is a valid Excel or CSV sheet.");
      } finally {
        setLoading(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleMappingChange = (fieldKey: string, excelHeader: string) => {
    setMappings((prev) => ({
      ...prev,
      [fieldKey]: excelHeader
    }));
  };

  const findUserByName = (nameStr: string) => {
    if (!nameStr) return null;
    const cleanName = String(nameStr).trim().toLowerCase();
    return agencyUsers.find(
      (u) =>
        u.full_name.toLowerCase() === cleanName ||
        u.full_name.toLowerCase().includes(cleanName) ||
        cleanName.includes(u.full_name.toLowerCase())
    );
  };

  const validateAndPrepare = async () => {
    // Check required fields mapping
    const missingFieldsList = targetFields
      .filter((f) => f.required && !mappings[f.key])
      .map((f) => f.label);

    if (missingFieldsList.length > 0) {
      setErrorMsg(`Please map all required fields: ${missingFieldsList.join(", ")}`);
      return;
    }

    setErrorMsg("");
    setLoading(true);

    try {
      // Fetch existing clients to check for duplicate phone numbers
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session.");

      const { data: profile } = await supabase
        .from("users")
        .select("agency_id")
        .eq("user_id", session.user.id)
        .single();
      if (!profile) throw new Error("Agency profile not found.");

      const { data: existingClients } = await supabase
        .from("clients")
        .select("mobile")
        .eq("agency_id", profile.agency_id);
      
      const existingMobiles = new Set((existingClients || []).map((c: any) => String(c.mobile).trim()));
      const sheetMobiles = new Set<string>();

      // Run row validation
      const prepared: any[] = [];
      const errors: string[] = [];
      const unmatchedNamesSet = new Set<string>();

      let countSuccess = 0;
      let countDuplicates = 0;
      let countFailed = 0;
      let countMissingFields = 0;

      parsedRows.forEach((row, index) => {
        const rowNum = index + 2; // 1-based + header
        const name = row[mappings["customerName"]];
        const mobile = row[mappings["mobile"]];
        const address = row[mappings["address"]];
        const city = row[mappings["city"]] || null;
        const state = row[mappings["state"]] || null;
        const pincode = row[mappings["pincode"]] || null;
        const rawWorker = row[mappings["assignedWorker"]] || "";
        const rawTelecaller = row[mappings["assignedTelecaller"]] || "";
        const team = row[mappings["team"]] || null;
        const priority = row[mappings["priority"]] || null;
        const status = row[mappings["status"]] || "NEW_LEAD";

        let isRowFailed = false;
        let isDuplicate = false;

        // 1. Missing required fields validation
        if (!name) {
          errors.push(`Row ${rowNum}: Customer Name is missing.`);
          isRowFailed = true;
        }
        if (!mobile) {
          errors.push(`Row ${rowNum}: Mobile Number is missing.`);
          isRowFailed = true;
        }
        if (!address) {
          errors.push(`Row ${rowNum}: Address is missing.`);
          isRowFailed = true;
        }

        // 2. Phone validation
        const cleanMobile = String(mobile || "").trim();
        if (mobile && !/^\d{10,}$/.test(cleanMobile)) {
          errors.push(`Row ${rowNum}: Invalid Phone Number (must be numeric and at least 10 digits).`);
          isRowFailed = true;
        }

        // 3. Duplicate checking
        if (mobile && !isRowFailed) {
          if (existingMobiles.has(cleanMobile)) {
            errors.push(`Row ${rowNum}: Mobile ${cleanMobile} already exists in SCM Database.`);
            isDuplicate = true;
          } else if (sheetMobiles.has(cleanMobile)) {
            errors.push(`Row ${rowNum}: Mobile ${cleanMobile} is duplicated inside this spreadsheet.`);
            isDuplicate = true;
          } else {
            sheetMobiles.add(cleanMobile);
          }
        }

        // 4. Employee assignment matching
        if (rawWorker) {
          const matched = findUserByName(rawWorker);
          if (!matched) {
            unmatchedNamesSet.add(String(rawWorker).trim());
          }
        }
        if (rawTelecaller) {
          const matched = findUserByName(rawTelecaller);
          if (!matched) {
            unmatchedNamesSet.add(String(rawTelecaller).trim());
          }
        }

        // 5. Track optional missing fields count
        if (!city || !state || !pincode || !rawWorker || !rawTelecaller || !team || !priority) {
          countMissingFields++;
        }

        if (isRowFailed) {
          countFailed++;
        } else if (isDuplicate) {
          countDuplicates++;
        } else {
          countSuccess++;
        }

        prepared.push({
          customer_name: name || "",
          mobile: cleanMobile,
          alternate_mobile: row[mappings["alternateMobile"]] ? String(row[mappings["alternateMobile"]]) : null,
          address: address || "",
          city,
          state,
          pincode: pincode ? String(pincode) : null,
          rawWorker,
          rawTelecaller,
          team,
          priority,
          status,
          rowNum
        });
      });

      setRecordsToImport(prepared);
      setValidationErrors(errors);
      setUnresolvedNames(Array.from(unmatchedNamesSet));
      setImportSummary({
        total: parsedRows.length,
        success: countSuccess,
        duplicates: countDuplicates,
        failed: countFailed,
        missingFields: countMissingFields
      });

      setLoading(false);
      setActiveStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to validate imported rows.");
      setLoading(false);
    }
  };

  const handleManualMappingChange = (unresolvedName: string, userId: string) => {
    setResolvedMapping((prev) => ({
      ...prev,
      [unresolvedName]: userId
    }));
  };

  const submitImport = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session.");

      const { data: profile } = await supabase
        .from("users")
        .select("agency_id")
        .eq("user_id", session.user.id)
        .single();

      if (!profile) throw new Error("Agency profile not found.");

      const agencyId = profile.agency_id;

      // Filter out duplicate or failed rows for final insertion
      const finalInserts = recordsToImport.filter((r) => {
        // Must have name, mobile, address, and not be duplicate
        const isFailed = !r.customer_name || !r.mobile || !r.address || !/^\d{10,}$/.test(r.mobile);
        return !isFailed;
      });

      if (finalInserts.length === 0) {
        throw new Error("No valid rows to import. All rows are invalid or duplicate.");
      }

      // Map resolved worker and telecaller IDs
      const clientsData = finalInserts.map((r) => {
        let assignedWorkerId = null;
        if (r.rawWorker) {
          assignedWorkerId = resolvedMapping[r.rawWorker] || findUserByName(r.rawWorker)?.user_id || null;
        }

        let assignedTelecallerId = null;
        if (r.rawTelecaller) {
          assignedTelecallerId = resolvedMapping[r.rawTelecaller] || findUserByName(r.rawTelecaller)?.user_id || null;
        }

        return {
          agency_id: agencyId,
          customer_name: r.customer_name,
          mobile: r.mobile,
          alternate_mobile: r.alternate_mobile,
          address: r.address,
          city: r.city,
          state: r.state,
          pincode: r.pincode,
          assigned_worker: assignedWorkerId,
          assigned_telecaller: assignedTelecallerId,
          team: r.team,
          priority: r.priority,
          status: r.status,
          is_archived: false
        };
      });

      const { error: insertClientsErr } = await supabase
        .from("clients")
        .insert(clientsData);

      if (insertClientsErr) throw insertClientsErr;

      onImportComplete();
      onClose();
      resetState();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to commit bulk imports to the database.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Smart Excel / CSV Client Import Wizard
      </DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: "8px" }}>
            {errorMsg}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 8, gap: 2 }}>
            <CircularProgress color="inherit" />
            <Typography variant="body2" color="text.secondary">
              Processing data...
            </Typography>
          </Box>
        ) : (
          <>
            {/* STEP 0: FILE UPLOAD */}
            {activeStep === 0 && (
              <Box
                sx={{
                  border: "2px dashed",
                  borderColor: "divider",
                  borderRadius: "12px",
                  p: 6,
                  textAlign: "center",
                  bgcolor: "background.default",
                  cursor: "pointer",
                  "&:hover": { borderColor: "primary.main", bgcolor: "rgba(0, 0, 0, 0.02)" }
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                />
                <Upload size={48} color="#6b7280" style={{ marginBottom: 16 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  Drag and drop your spreadsheet here
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Supports .XLSX, .XLS, or .CSV file formats
                </Typography>
              </Box>
            )}

            {/* STEP 1: COLUMN MAPPING */}
            {activeStep === 1 && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Map SCM system database columns to the headers inside your uploaded spreadsheet file. Unmapped optional fields will be skipped.
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>System Database Field</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Source Column Header</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {targetFields.map((field) => (
                        <TableRow key={field.key}>
                          <TableCell sx={{ fontWeight: 600 }}>{field.label}</TableCell>
                          <TableCell>
                            <TextField
                              select
                              fullWidth
                              size="small"
                              value={mappings[field.key] || ""}
                              onChange={(e) => handleMappingChange(field.key, e.target.value)}
                            >
                              <MenuItem value="">
                                <em>-- Skip / Unmapped --</em>
                              </MenuItem>
                              {fileHeaders.map((header) => (
                                <MenuItem key={header} value={header}>
                                  {header}
                                </MenuItem>
                              ))}
                            </TextField>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* STEP 2: VALIDATION REVIEW */}
            {activeStep === 2 && (
              <Box>
                {/* Stats Summary Grid */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6} sm={2.4}>
                    <Card variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
                      <Typography variant="caption" color="text.secondary">Total Rows</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>{importSummary.total}</Typography>
                    </Card>
                  </Grid>
                  <Grid item xs={6} sm={2.4}>
                    <Card variant="outlined" sx={{ p: 1.5, textAlign: "center", borderLeft: "4px solid", borderColor: "success.main" }}>
                      <Typography variant="caption" color="success.main" sx={{ fontWeight: 700 }}>Ready to Import</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: "success.main" }}>{importSummary.success}</Typography>
                    </Card>
                  </Grid>
                  <Grid item xs={6} sm={2.4}>
                    <Card variant="outlined" sx={{ p: 1.5, textAlign: "center", borderLeft: "4px solid", borderColor: "warning.main" }}>
                      <Typography variant="caption" color="warning.main" sx={{ fontWeight: 700 }}>Duplicates</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: "warning.main" }}>{importSummary.duplicates}</Typography>
                    </Card>
                  </Grid>
                  <Grid item xs={6} sm={2.4}>
                    <Card variant="outlined" sx={{ p: 1.5, textAlign: "center", borderLeft: "4px solid", borderColor: "error.main" }}>
                      <Typography variant="caption" color="error.main" sx={{ fontWeight: 700 }}>Failed (Invalid)</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: "error.main" }}>{importSummary.failed}</Typography>
                    </Card>
                  </Grid>
                  <Grid item xs={6} sm={2.4}>
                    <Card variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
                      <Typography variant="caption" color="text.secondary">Missing Fields</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>{importSummary.missingFields}</Typography>
                    </Card>
                  </Grid>
                </Grid>

                {/* Unresolved Name Mappings Section */}
                {unresolvedNames.length > 0 && (
                  <Card variant="outlined" sx={{ p: 2, mb: 3, border: "1px solid", borderColor: "warning.main", bgcolor: "rgba(245, 158, 11, 0.03)" }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                      <AlertTriangle color="#F59E0B" size={20} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "warning.main" }}>
                        Unresolved Employee Assignments ({unresolvedNames.length})
                      </Typography>
                    </Stack>
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 2 }}>
                      The following employee names were found in the sheet but do not exist in the database. Map them manually:
                    </Typography>
                    <Grid container spacing={2}>
                      {unresolvedNames.map((name) => (
                        <Grid item xs={12} sm={6} key={name}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, minWidth: "120px" }}>
                              {name}
                            </Typography>
                            <TextField
                              select
                              fullWidth
                              size="small"
                              label="Map to System Employee"
                              value={resolvedMapping[name] || ""}
                              onChange={(e) => handleManualMappingChange(name, e.target.value)}
                            >
                              <MenuItem value="">
                                <em>-- Keep Unassigned --</em>
                              </MenuItem>
                              {agencyUsers.map((u) => (
                                <MenuItem key={u.user_id} value={u.user_id}>
                                  {u.full_name} ({u.role.toUpperCase()})
                                </MenuItem>
                              ))}
                            </TextField>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Card>
                )}

                {/* Validation Warnings Panel */}
                {validationErrors.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" color="error.main" sx={{ fontWeight: 700, mb: 1 }}>
                      Formatting & Duplicate Warnings:
                    </Typography>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        maxHeight: "130px",
                        overflowY: "auto",
                        bgcolor: "rgba(239, 68, 68, 0.03)"
                      }}
                    >
                      {validationErrors.map((err, i) => (
                        <Typography key={i} variant="caption" display="block" color="error">
                          • {err}
                        </Typography>
                      ))}
                    </Paper>
                  </Box>
                )}

                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Data Grid Preview (First 5 Rows):
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Customer Name</TableCell>
                        <TableCell>Mobile</TableCell>
                        <TableCell>Address</TableCell>
                        <TableCell>City/State</TableCell>
                        <TableCell>Employee / Telecaller</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recordsToImport.slice(0, 5).map((row, index) => {
                        const dispWorker = resolvedMapping[row.rawWorker] 
                          ? agencyUsers.find(u => u.user_id === resolvedMapping[row.rawWorker])?.full_name 
                          : findUserByName(row.rawWorker)?.full_name || row.rawWorker || "Unassigned";

                        const dispCaller = resolvedMapping[row.rawTelecaller] 
                          ? agencyUsers.find(u => u.user_id === resolvedMapping[row.rawTelecaller])?.full_name 
                          : findUserByName(row.rawTelecaller)?.full_name || row.rawTelecaller || "Unassigned";

                        return (
                          <TableRow key={index}>
                            <TableCell>{row.customer_name}</TableCell>
                            <TableCell>{row.mobile}</TableCell>
                            <TableCell>{row.address}</TableCell>
                            <TableCell>{row.city || "N/A"}/{row.state || "N/A"}</TableCell>
                            <TableCell>
                              <Typography variant="caption" display="block">FE: {dispWorker}</Typography>
                              <Typography variant="caption" display="block">TC: {dispCaller}</Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        {activeStep > 0 && (
          <Button
            variant="outlined"
            onClick={() => setActiveStep(activeStep - 1)}
            startIcon={<RefreshCw size={16} />}
            disabled={loading}
          >
            Back
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="text" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        {activeStep === 1 && (
          <Button variant="contained" onClick={validateAndPrepare} endIcon={<ChevronRight size={16} />} sx={{ bgcolor: "#000", color: "#fff", "&:hover": { bgcolor: "#222" } }}>
            Validate Data
          </Button>
        )}
        {activeStep === 2 && (
          <Button
            variant="contained"
            color="success"
            onClick={submitImport}
            disabled={loading || importSummary.success === 0}
            startIcon={<Check size={16} />}
            sx={{ bgcolor: "#10b981", color: "#fff", "&:hover": { bgcolor: "#059669" } }}
          >
            Import Client Data
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
