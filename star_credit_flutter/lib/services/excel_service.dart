import 'dart:typed_data';
import 'package:excel/excel.dart' as ex;
import 'package:supabase_flutter/supabase_flutter.dart';

class ExcelService {
  // Target fields for Credit CRM system
  static const List<Map<String, dynamic>> targetFields = [
    {"key": "customerName", "label": "Customer Name *", "required": true},
    {"key": "mobile", "label": "Mobile Number *", "required": true},
    {"key": "alternateMobile", "label": "Alternate Mobile", "required": false},
    {"key": "address", "label": "Address *", "required": true},
    {"key": "dob", "label": "Date of Birth (YYYY-MM-DD)", "required": false},
    {"key": "creditScore", "label": "Credit Score", "required": false},
    {"key": "ssn", "label": "SSN / ID Number", "required": false},
    {"key": "bureauInformation", "label": "Bureau Information", "required": false},
    {"key": "privateNotes", "label": "Private Notes", "required": false},
  ];

  /// Parses XLSX/XLS file bytes and returns sheet headers and row data.
  Future<Map<String, dynamic>> parseSpreadsheet(Uint8List fileBytes) async {
    try {
      final excel = ex.Excel.decodeBytes(fileBytes);
      if (excel.tables.isEmpty) {
        throw Exception("Excel file does not contain any sheets.");
      }

      // Read first sheet
      final String sheetName = excel.tables.keys.first;
      final ex.Sheet? sheet = excel.tables[sheetName];
      if (sheet == null || sheet.maxRows <= 0) {
        throw Exception("No data rows found in sheet '$sheetName'.");
      }

      // Extract headers from first row
      final List<String> headers = [];
      final firstRow = sheet.rows.first;
      for (var cell in firstRow) {
        headers.add(cell?.value?.toString().trim() ?? '');
      }

      // Extract row records
      final List<Map<String, dynamic>> rows = [];
      for (int i = 1; i < sheet.maxRows; i++) {
        final row = sheet.rows[i];
        final Map<String, dynamic> rowData = {};
        for (int col = 0; col < headers.length; col++) {
          if (col < row.length) {
            rowData[headers[col]] = row[col]?.value;
          } else {
            rowData[headers[col]] = null;
          }
        }
        // Only add non-empty rows
        if (rowData.values.any((val) => val != null && val.toString().trim().isNotEmpty)) {
          rows.add(rowData);
        }
      }

      return {
        "headers": headers,
        "rows": rows,
      };
    } catch (e) {
      throw Exception("Failed to read Excel/CSV file: $e");
    }
  }

  /// Auto-maps system fields to sheet headers based on string matches
  Map<String, String> autoMapHeaders(List<String> headers) {
    final Map<String, String> mappings = {};

    for (var field in targetFields) {
      final String key = field["key"];
      
      for (var h in headers) {
        final String cleanH = h.toLowerCase().replaceAll(RegExp(r'\s+'), '');
        final String cleanKey = key.toLowerCase();

        // Check for direct or substring matches
        if (cleanH.contains(cleanKey) || cleanKey.contains(cleanH)) {
          mappings[key] = h;
          break;
        }

        // Custom alias matching
        if (key == "customerName" && (cleanH.contains("name") || cleanH.contains("client") || cleanH.contains("customer"))) {
          mappings[key] = h;
          break;
        }
        if (key == "mobile" && (cleanH.contains("phone") || cleanH.contains("contact") || cleanH.contains("mobile"))) {
          mappings[key] = h;
          break;
        }
        if (key == "alternateMobile" && (cleanH.contains("alt") || cleanH.contains("secondary"))) {
          mappings[key] = h;
          break;
        }
      }
    }

    return mappings;
  }

  /// Validates mapped values, performs formatting checks and queries database for duplicate entries
  Future<Map<String, dynamic>> validateAndPrepare({
    required List<Map<String, dynamic>> parsedRows,
    required Map<String, String> mappings,
    required String agencyId,
    required SupabaseClient supabase,
  }) async {
    final List<Map<String, dynamic>> validatedRecords = [];
    final List<String> errors = [];

    // Verify all required mappings exist
    final missingFields = targetFields
        .where((f) => f["required"] == true && !mappings.containsKey(f["key"]))
        .map((f) => f["label"])
        .toList();

    if (missingFields.isNotEmpty) {
      return {
        "isValid": false,
        "records": <Map<String, dynamic>>[],
        "errors": ["Missing required field mappings: ${missingFields.join(', ')}"]
      };
    }

    // Load existing client mobile numbers for duplicate check
    final List<String> existingMobiles = [];
    try {
      final List<dynamic> dbClients = await supabase
          .from('clients')
          .select('mobile')
          .eq('agency_id', agencyId);
      for (var c in dbClients) {
        existingMobiles.add(c['mobile'].toString().trim());
      }
    } catch (e) {
      // If load fails, proceed without db duplicate warnings
    }

    for (int i = 0; i < parsedRows.length; i++) {
      final row = parsedRows[i];
      final int rowNum = i + 2; // Excel row number (1-based + header)

      final name = row[mappings["customerName"]]?.toString().trim();
      final mobile = row[mappings["mobile"]]?.toString().trim();
      final address = row[mappings["address"]]?.toString().trim();

      // Required field validations
      if (name == null || name.isEmpty) {
        errors.add("Row $rowNum: Customer Name is missing.");
      }
      if (mobile == null || mobile.isEmpty) {
        errors.add("Row $rowNum: Mobile Number is missing.");
      }
      if (address == null || address.isEmpty) {
        errors.add("Row $rowNum: Address is missing.");
      }

      // Duplicate detection
      bool isDuplicate = false;
      if (mobile != null && existingMobiles.contains(mobile)) {
        isDuplicate = true;
        errors.add("Row $rowNum: Mobile number '$mobile' is a duplicate. (Already exists in database)");
      }

      // SSN check
      final ssnVal = row[mappings["ssn"]]?.toString().trim();
      // Date of birth parse
      final dobVal = row[mappings["dob"]]?.toString().trim();
      DateTime? parsedDob;
      if (dobVal != null && dobVal.isNotEmpty) {
        parsedDob = DateTime.tryParse(dobVal);
        if (parsedDob == null) {
          errors.add("Row $rowNum: DOB '$dobVal' is invalid. Expected format YYYY-MM-DD.");
        }
      }

      // Credit score parse
      final scoreVal = row[mappings["creditScore"]]?.toString().trim();
      int? parsedScore;
      if (scoreVal != null && scoreVal.isNotEmpty) {
        parsedScore = int.tryParse(scoreVal);
        if (parsedScore == null || parsedScore < 300 || parsedScore > 850) {
          errors.add("Row $rowNum: Credit score '$scoreVal' is invalid. Expected integer between 300 and 850.");
        }
      }

      validatedRecords.add({
        "customer_name": name ?? '',
        "mobile": mobile ?? '',
        "alternate_mobile": row[mappings["alternateMobile"]]?.toString().trim(),
        "address": address ?? '',
        "dob": parsedDob,
        "credit_score": parsedScore,
        "ssn": ssnVal,
        "private_notes": row[mappings["privateNotes"]]?.toString().trim(),
        "bureau_information": row[mappings["bureauInformation"]]?.toString().trim(),
        "is_duplicate": isDuplicate,
        "rowNum": rowNum,
      });
    }

    return {
      "isValid": errors.isEmpty,
      "records": validatedRecords,
      "errors": errors,
    };
  }

  /// Commits bulk records to database
  Future<void> commitBulkImport({
    required List<Map<String, dynamic>> records,
    required String agencyId,
    required SupabaseClient supabase,
  }) async {
    try {
      // 1. Bulk insert clients
      final List<Map<String, dynamic>> clientsToInsert = records.map((r) => {
        "agency_id": agencyId,
        "customer_name": r["customer_name"],
        "mobile": r["mobile"],
        "alternate_mobile": r["alternate_mobile"],
        "address": r["address"],
        "dob": r["dob"] != null ? (r["dob"] as DateTime).toIso8601String().split('T')[0] : null,
        "status": "NEW_LEAD",
      }).toList();

      final List<dynamic> insertedClients = await supabase
          .from('clients')
          .insert(clientsToInsert)
          .select('client_id, mobile');

      if (insertedClients.isEmpty) return;

      // 2. Prepare and bulk insert sensitive details
      final List<Map<String, dynamic>> sensitiveInserts = [];
      for (var client in insertedClients) {
        final String cid = client['client_id'];
        final String cmobile = client['mobile'].toString();
        
        final r = records.firstWhere((rec) => rec["mobile"] == cmobile, orElse: () => {});
        if (r.isNotEmpty) {
          sensitiveInserts.add({
            "client_id": cid,
            "ssn": r["ssn"],
            "credit_score": r["credit_score"],
            "private_notes": r["private_notes"],
            "bureau_information": r["bureau_information"],
          });
        }
      }

      if (sensitiveInserts.isNotEmpty) {
        await supabase.from('client_sensitive_details').insert(sensitiveInserts);
      }
    } catch (e) {
      throw Exception("Excel commit error: $e");
    }
  }
}
