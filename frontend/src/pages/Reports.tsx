import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../utils/supabaseClient";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Stack
} from "@mui/material";
import { Download, TableProperties } from "lucide-react";

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadReportData = async () => {
    try {
      setLoading(true);
      if (!user?.agency?.id) return;
      
      // Fetch all clients for the current agency
      const { data: clientsData, error: clientsErr } = await supabase
        .from("clients")
        .select("client_id, status, priority")
        .eq("agency_id", user.agency.id)
        .eq("is_archived", false);

      if (clientsErr) throw clientsErr;

      const totalLeads = clientsData?.length || 0;
      const contacted = clientsData?.filter(c => c.status !== "NEW_LEAD").length || 0;
      const interested = clientsData?.filter(c => !["NEW_LEAD", "VERIFICATION"].includes(c.status)).length || 0;
      const completed = clientsData?.filter(c => c.status === "COMPLETED").length || 0;

      // Documents collected are cases that progressed to DOCUMENT_COLLECTION or later
      const documentsCollected = clientsData?.filter(c => 
        !["NEW_LEAD", "VERIFICATION"].includes(c.status)
      ).length || 0;

      const conversionRate = totalLeads > 0 ? Math.round((completed / totalLeads) * 1000) / 10 : 0;

      // Group by workflow stages
      const stages = [
        { key: "NEW_LEAD", label: "New Lead" },
        { key: "VERIFICATION", label: "Verification" },
        { key: "DOCUMENT_COLLECTION", label: "Document Collection" },
        { key: "CREDIT_ANALYSIS", label: "Credit Analysis" },
        { key: "DISPUTE_CREATION", label: "Report Corrections" },
        { key: "BUREAU_SUBMISSION", label: "Submit to Credit Company" },
        { key: "REVIEW", label: "Review Case" },
        { key: "FOLLOW_UP", label: "Follow-Up" },
        { key: "COMPLETED", label: "Completed" }
      ];

      const breakdown = stages.map(stage => {
        const stageClients = clientsData?.filter(c => c.status === stage.key) || [];
        return {
          stageLabel: stage.label,
          count: stageClients.length
        };
      });

      setData({
        totalLeads,
        contacted,
        interested,
        documentsCollected,
        completed,
        conversionRate,
        breakdown
      });
    } catch (err) {
      console.error("Error loading monthly reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadReportData();
    }
  }, [user]);

  // PDF Export using jsPDF and jspdf-autotable
  const exportPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleDateString("en-IN");

    // Title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(99, 102, 241); // Indigo Primary color
    doc.text("Star Credit Management (SCM)", 14, 20);

    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text(`Monthly Operational Performance Report • Generated on ${dateStr}`, 14, 27);
    doc.line(14, 30, 196, 30);

    // Summary Section
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("1. Executive Summary Metrics", 14, 40);

    const summaryData = [
      ["Metric Description", "Value"],
      ["Total Active Customers", String(data.totalLeads)],
      ["Customers Contacted (Status past New)", String(data.contacted)],
      ["Customers In Process (Documents/Analysis/Disputes)", String(data.interested)],
      ["Worker Document Bundles Collected", String(data.documentsCollected)],
      ["Cases Completed & Resolved", String(data.completed)],
      ["Overall Resolution / Conversion Rate", `${data.conversionRate}%`]
    ];

    autoTable(doc, {
      startY: 45,
      head: [summaryData[0]],
      body: summaryData.slice(1),
      theme: "striped",
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 10, cellPadding: 4 }
    });

    // Breakdown Section
    const nextY = (doc as any).lastAutoTable.finalY + 12;
    doc.text("2. Workflow Stage Volume Breakdown", 14, nextY);

    const breakdownHeaders = ["Workflow Stage", "Total Active Cases"];
    const breakdownRows = data.breakdown.map((item: any) => [
      item.stageLabel,
      String(item.count)
    ]);

    autoTable(doc, {
      startY: nextY + 5,
      head: [breakdownHeaders],
      body: breakdownRows,
      theme: "grid",
      headStyles: { fillColor: [168, 85, 247] }, // Purple Secondary
      styles: { fontSize: 10, cellPadding: 4 }
    });

    // Signature Block
    const signY = (doc as any).lastAutoTable.finalY + 30;
    doc.setFontSize(11);
    doc.text("Prepared & Verified By:", 14, signY);
    doc.line(14, signY + 12, 70, signY + 12);
    doc.text("Operations Manager, SCM", 14, signY + 18);

    doc.text("Authorized Approval:", 130, signY);
    doc.line(130, signY + 12, 186, signY + 12);
    doc.text("Agency Managing Director", 130, signY + 18);

    doc.save(`SCM_Monthly_Report_${Date.now()}.pdf`);
  };

  // Excel Export using SheetJS
  const exportExcel = () => {
    if (!data) return;

    // Summary sheet
    const summaryRows = [
      { Metric: "Total Active Customers", Value: data.totalLeads },
      { Metric: "Customers Contacted", Value: data.contacted },
      { Metric: "Customers In Process", Value: data.interested },
      { Metric: "Documents Collected", Value: data.documentsCollected },
      { Metric: "Completed Cases", Value: data.completed },
      { Metric: "Overall Conversion Rate", Value: `${data.conversionRate}%` }
    ];

    // Breakdown sheet
    const breakdownRows = data.breakdown.map((item: any) => ({
      "Workflow Stage": item.stageLabel,
      "Active Cases": item.count
    }));

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    const wsBreakdown = XLSX.utils.json_to_sheet(breakdownRows);

    XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");
    XLSX.utils.book_append_sheet(wb, wsBreakdown, "Stage Breakdown");

    XLSX.writeFile(wb, `SCM_Operational_Data_${Date.now()}.xlsx`);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", flexGrow: 1, alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Reports Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generate and export monthly performance metrics, audit figures, and customer category datasets.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" color="primary" onClick={exportExcel} startIcon={<TableProperties size={18} />}>
            Export Excel
          </Button>
          <Button variant="contained" color="primary" onClick={exportPDF} startIcon={<Download size={18} />}>
            Download PDF Report
          </Button>
        </Stack>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3.5}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700 }}>
                Total Active Customers
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1 }}>
                {data.totalLeads}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700 }}>
                Resolution Rate
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: "primary.main" }}>
                {data.conversionRate}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700 }}>
                Docs Collected
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: "secondary.main" }}>
                {data.documentsCollected}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700 }}>
                Completed Cases
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, color: "success.main" }}>
                {data.completed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Grid containing tables */}
      <Grid container spacing={3.5}>
        <Grid item xs={12} md={7}>
          <Card sx={{ p: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Monthly Conversion Breakdown
              </Typography>
              <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Metrics Description</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow hover>
                      <TableCell sx={{ fontWeight: 600 }}>Total Active Customers</TableCell>
                      <TableCell align="right">{data.totalLeads}</TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ fontWeight: 600 }}>Total Contacted</TableCell>
                      <TableCell align="right">{data.contacted}</TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ fontWeight: 600 }}>In Process Cases</TableCell>
                      <TableCell align="right">{data.interested}</TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ fontWeight: 600 }}>Workers Document Collection</TableCell>
                      <TableCell align="right">{data.documentsCollected}</TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ fontWeight: 600 }}>Completed Resolved</TableCell>
                      <TableCell align="right">{data.completed}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card sx={{ p: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Workflow Stage Breakdown
              </Typography>
              <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Workflow Stage</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Active Cases</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.breakdown.map((item: any) => (
                      <TableRow key={item.stageLabel} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{item.stageLabel}</TableCell>
                        <TableCell align="right">{item.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
