import React, { useEffect, useState } from "react";
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
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadReportData = async () => {
    try {
      setLoading(true);
      
      // Fetch all leads for the current agency
      const { data: leadsData, error: leadsErr } = await supabase
        .from("leads")
        .select("lead_id, loan_type, loan_amount, status");

      if (leadsErr) throw leadsErr;

      const totalLeads = leadsData?.length || 0;
      const contacted = leadsData?.filter(l => l.status === "CONTACTED").length || 0;
      const interested = leadsData?.filter(l => l.status === "INTERESTED").length || 0;
      const completed = leadsData?.filter(l => l.status === "CLOSED").length || 0;

      // Count total documents in agency
      const { count: docsCount, error: docsErr } = await supabase
        .from("documents")
        .select("*", { count: "exact", head: true });

      if (docsErr) throw docsErr;
      const documentsCollected = docsCount || 0;

      const conversionRate = totalLeads > 0 ? Math.round((completed / totalLeads) * 1000) / 10 : 0;

      // Group by loan type
      const loanTypes = ["HOME", "BIKE", "PERSONAL", "MORTGAGE", "BUSINESS"];
      const breakdown = loanTypes.map(type => {
        const typeLeads = leadsData?.filter(l => l.loan_type === type) || [];
        const totalAmount = typeLeads.reduce((sum, l) => sum + (parseFloat(l.loan_amount) || 0), 0);
        return {
          loanType: type,
          count: typeLeads.length,
          totalAmount: Math.round(totalAmount * 100) / 100
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
    loadReportData();
  }, []);

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
      ["Total Customer Leads Uploaded", String(data.totalLeads)],
      ["Leads Contacted (Completed Call Attempt)", String(data.contacted)],
      ["Leads Expressing Interest", String(data.interested)],
      ["Worker Document Bundles Collected", String(data.documentsCollected)],
      ["Cases Completed & Disbursed", String(data.completed)],
      ["Overall Intermediary Conversion Rate", `${data.conversionRate}%`]
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
    doc.text("2. Loan Type Volume Breakdown", 14, nextY);

    const breakdownHeaders = ["Loan Category", "Total Cases", "Combined Capital Value (Lakhs)"];
    const breakdownRows = data.breakdown.map((item: any) => [
      item.loanType,
      String(item.count),
      `₹${item.totalAmount} Lakhs`
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
      { Metric: "Total Leads Imported", Value: data.totalLeads },
      { Metric: "Leads Contacted", Value: data.contacted },
      { Metric: "Interested Leads", Value: data.interested },
      { Metric: "Documents Collected", Value: data.documentsCollected },
      { Metric: "Completed Cases", Value: data.completed },
      { Metric: "Overall Conversion Rate", Value: `${data.conversionRate}%` }
    ];

    // Breakdown sheet
    const breakdownRows = data.breakdown.map((item: any) => ({
      "Loan Type": item.loanType,
      "Lead Count": item.count,
      "Total Amount (Lakhs)": item.totalAmount
    }));

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    const wsBreakdown = XLSX.utils.json_to_sheet(breakdownRows);

    XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");
    XLSX.utils.book_append_sheet(wb, wsBreakdown, "Category Breakdown");

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
          <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
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
                Total Leads Uploaded
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, fontFamily: "'Outfit', sans-serif" }}>
                {data.totalLeads}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontWeight: 700 }}>
                Lead Conversion
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, fontFamily: "'Outfit', sans-serif", color: "primary.main" }}>
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
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, fontFamily: "'Outfit', sans-serif", color: "secondary.main" }}>
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
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 1, fontFamily: "'Outfit', sans-serif", color: "success.main" }}>
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
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontFamily: "'Outfit', sans-serif" }}>
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
                      <TableCell sx={{ fontWeight: 600 }}>Total Leads Received</TableCell>
                      <TableCell align="right">{data.totalLeads}</TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ fontWeight: 600 }}>Total Contacted</TableCell>
                      <TableCell align="right">{data.contacted}</TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ fontWeight: 600 }}>Interested Leads</TableCell>
                      <TableCell align="right">{data.interested}</TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ fontWeight: 600 }}>Workers Document Collection</TableCell>
                      <TableCell align="right">{data.documentsCollected}</TableCell>
                    </TableRow>
                    <TableRow hover>
                      <TableCell sx={{ fontWeight: 600 }}>Completed Closures</TableCell>
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
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontFamily: "'Outfit', sans-serif" }}>
                Loan Type Breakdown
              </Typography>
              <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Loan Type</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Leads</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Capital (Lakhs)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.breakdown.map((item: any) => (
                      <TableRow key={item.loanType} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{item.loanType}</TableCell>
                        <TableCell align="right">{item.count}</TableCell>
                        <TableCell align="right">₹{item.totalAmount}L</TableCell>
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
