import 'package:flutter/material.dart';

class AppConstants {
  // Supabase Configuration
  static const String supabaseUrl = "https://wiwzszumewxnclagfwmj.supabase.co";
  static const String supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpd3pzenVtZXd4bmNsYWdmd21qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MjQ2NTEsImV4cCI6MjA5NjIwMDY1MX0.XCPam3rFUm-GHo4z4ELwMTi7dS94hL6TVbmeG3TvTwI";

  // Responsive breakpoints
  static const double mobileBreakPoint = 600.0;
  static const double tabletBreakPoint = 1024.0;

  // Workflow stages in exact database order
  static const List<String> workflowStages = [
    "NEW_LEAD",
    "VERIFICATION",
    "DOCUMENT_COLLECTION",
    "CREDIT_ANALYSIS",
    "DISPUTE_CREATION",
    "BUREAU_SUBMISSION",
    "REVIEW",
    "FOLLOW_UP",
    "COMPLETED",
  ];

  static const Map<String, String> stageLabels = {
    "NEW_LEAD": "New Lead",
    "VERIFICATION": "Verification",
    "DOCUMENT_COLLECTION": "Document Collection",
    "CREDIT_ANALYSIS": "Credit Analysis",
    "DISPUTE_CREATION": "Report Corrections",
    "BUREAU_SUBMISSION": "Submit to Credit Company",
    "REVIEW": "Review Case",
    "FOLLOW_UP": "Follow-Up",
    "COMPLETED": "Completed",
  };

  // User roles check list
  static const String roleOwner = "OWNER";
  static const String roleManager = "MANAGER";
  static const String roleWorker = "WORKER";
  static const String roleClient = "CLIENT";
  static const String roleTelecaller = "TELECALLER";

  // Design assets / theme configs
  static const Color primaryColor = Color(0xFF000000);
  static const Color secondaryColor = Color(0xFF6B7280);
  static const Color accentColor = Color(0xFF111827);
  static const Color backgroundColor = Color(0xFFF8F8F8);
  static const Color cardColor = Color(0xFFFFFFFF);
}
