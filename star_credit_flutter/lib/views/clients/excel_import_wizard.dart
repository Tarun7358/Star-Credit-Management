import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:file_picker/file_picker.dart';
import '../../services/supabase_service.dart';
import '../../services/excel_service.dart';

class ExcelImportWizard extends StatefulWidget {
  final VoidCallback onImportComplete;
  const ExcelImportWizard({Key? key, required this.onImportComplete}) : super(key: key);

  @override
  State<ExcelImportWizard> createState() => _ExcelImportWizardState();
}

class _ExcelImportWizardState extends State<ExcelImportWizard> {
  int _activeStep = 0;
  bool _loading = false;
  String? _errorMessage;

  // Step data
  List<String> _fileHeaders = [];
  List<Map<String, dynamic>> _parsedRows = [];
  Map<String, String> _mappings = {};
  List<String> _validationErrors = [];
  List<Map<String, dynamic>> _recordsToImport = [];

  void _resetState() {
    setState(() {
      _activeStep = 0;
      _fileHeaders = [];
      _parsedRows = [];
      _mappings = {};
      _validationErrors = [];
      _recordsToImport = [];
      _errorMessage = null;
    });
  }

  Future<void> _handleFileUpload() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx', 'xls', 'csv'],
    );

    if (result == null || result.files.isEmpty) return;
    
    final file = result.files.first;
    final bytes = file.bytes;
    if (bytes == null) {
      setState(() => _errorMessage = "Could not read spreadsheet file bytes. Try running in web/emulator.");
      return;
    }

    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    try {
      final excelService = Provider.of<ExcelService>(context, listen: false);
      final data = await excelService.parseSpreadsheet(bytes);
      
      final headers = List<String>.from(data["headers"]);
      final rows = List<Map<String, dynamic>>.from(data["rows"]);

      if (rows.isEmpty) {
        throw Exception("The uploaded spreadsheet contains no rows of data.");
      }

      // Auto match
      final initialMappings = excelService.autoMapHeaders(headers);

      setState(() {
        _fileHeaders = headers;
        _parsedRows = rows;
        _mappings = initialMappings;
        _activeStep = 1;
      });
    } catch (e) {
      setState(() => _errorMessage = e.toString().replaceAll('Exception:', '').trim());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _validateAndPrepare() async {
    // Verify required fields mapped
    final excelService = Provider.of<ExcelService>(context, listen: false);
    final missingFields = ExcelService.targetFields
        .where((f) => f["required"] == true && !_mappings.containsKey(f["key"]))
        .map((f) => f["label"] as String)
        .toList();

    if (missingFields.isNotEmpty) {
      setState(() {
        _errorMessage = "Please map all required fields: ${missingFields.join(', ')}";
      });
      return;
    }

    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    try {
      final authService = Provider.of<SupabaseService>(context, listen: false);
      final agencyId = authService.currentUser!.agencyId;

      final results = await excelService.validateAndPrepare(
        parsedRows: _parsedRows,
        mappings: _mappings,
        agencyId: agencyId,
        supabase: authService.client,
      );

      setState(() {
        _recordsToImport = List<Map<String, dynamic>>.from(results["records"]);
        _validationErrors = List<String>.from(results["errors"]);
        _activeStep = 2;
      });
    } catch (e) {
      setState(() => _errorMessage = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _submitImport() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    try {
      final authService = Provider.of<SupabaseService>(context, listen: false);
      final excelService = Provider.of<ExcelService>(context, listen: false);
      final agencyId = authService.currentUser!.agencyId;

      await excelService.commitBulkImport(
        records: _recordsToImport,
        agencyId: agencyId,
        supabase: authService.client,
      );

      widget.onImportComplete();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Successfully imported leads data grid!')),
        );
      }
    } catch (e) {
      setState(() => _errorMessage = e.toString().replaceAll('Exception:', '').trim());
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF1E293B),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Colors.white10),
      ),
      child: Container(
        width: 800,
        height: 600,
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Title
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Excel / CSV Mapping Wizard',
                  style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white70),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 12),
            
            // Stepper view indicators
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildStepIndicator(0, "Upload File"),
                _buildStepIndicator(1, "Map Columns"),
                _buildStepIndicator(2, "Review & Validate"),
              ],
            ),
            const Divider(color: Colors.white10, height: 32),

            // Error alerts
            if (_errorMessage != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.3)),
                ),
                child: Text(
                  _errorMessage!,
                  style: GoogleFonts.inter(color: const Color(0xFFFCA5A5), fontSize: 12),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Content Panel
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)))
                  : _buildStepContent(),
            ),

            const SizedBox(height: 24),
            // Actions
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (_activeStep > 0)
                  OutlinedButton(
                    onPressed: _loading ? null : () => setState(() => _activeStep--),
                    child: const Text('Back'),
                  ),
                const SizedBox(width: 12),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel', style: TextStyle(color: Colors.white70)),
                ),
                const SizedBox(width: 12),
                if (_activeStep == 1)
                  ElevatedButton(
                    onPressed: _validateAndPrepare,
                    child: const Text('Validate Data'),
                  ),
                if (_activeStep == 2)
                  ElevatedButton(
                    onPressed: _recordsToImport.isEmpty ? null : _submitImport,
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
                    child: const Text('Import Client Data'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepIndicator(int stepIndex, String label) {
    final isCurrent = _activeStep == stepIndex;
    final isDone = _activeStep > stepIndex;
    return Row(
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isDone ? const Color(0xFF10B981) : (isCurrent ? const Color(0xFF6366F1) : Colors.white12),
          ),
          child: Center(
            child: isDone
                ? const Icon(Icons.check, size: 14, color: Colors.white)
                : Text('${stepIndex + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 13,
            fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
            color: isCurrent ? Colors.white : const Color(0xFF64748B),
          ),
        ),
      ],
    );
  }

  Widget _buildStepContent() {
    if (_activeStep == 0) {
      return InkWell(
        onTap: _handleFileUpload,
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: Colors.white24, style: BorderStyle.solid),
            borderRadius: BorderRadius.circular(12),
            color: const Color(0xFF0F172A),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.cloud_upload_outlined, size: 52, color: Color(0xFF6366F1)),
              const SizedBox(height: 16),
              Text(
                'Upload your spreadsheet file here',
                style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
              ),
              const SizedBox(height: 4),
              Text(
                'Supports .XLSX, .XLS, or .CSV formats',
                style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B)),
              ),
            ],
          ),
        ),
      );
    }

    if (_activeStep == 1) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Map SCM system database columns to the headers inside your uploaded spreadsheet.',
            style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF94A3B8)),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: ListView.builder(
              itemCount: ExcelService.targetFields.length,
              itemBuilder: (context, idx) {
                final field = ExcelService.targetFields[idx];
                final fieldKey = field["key"] as String;
                final fieldLabel = field["label"] as String;

                return Padding(
                  padding: const EdgeInsets.only(bottom: 12.0),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: Text(
                          fieldLabel,
                          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
                        ),
                      ),
                      Expanded(
                        flex: 3,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.white10),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: _mappings[fieldKey],
                              dropdownColor: const Color(0xFF1E293B),
                              hint: const Text('Skip / Unmapped', style: TextStyle(color: Color(0xFF475569))),
                              items: [
                                const DropdownMenuItem<String>(value: null, child: Text('Skip / Unmapped')),
                                ..._fileHeaders.map((header) {
                                  return DropdownMenuItem<String>(
                                    value: header,
                                    child: Text(header, style: const TextStyle(color: Colors.white)),
                                  );
                                })
                              ],
                              onChanged: (val) {
                                setState(() {
                                  if (val == null) {
                                    _mappings.remove(fieldKey);
                                  } else {
                                    _mappings[fieldKey] = val;
                                  }
                                });
                              },
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      );
    }

    // Step 2: Validate review
    final anomalies = _validationErrors.length;
    final cleanRecords = _recordsToImport.length - anomalies;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3)),
                ),
                child: Text(
                  '$cleanRecords verified rows ready.',
                  style: GoogleFonts.inter(color: const Color(0xFF34D399), fontSize: 13, fontWeight: FontWeight.bold),
                ),
              ),
            ),
            if (anomalies > 0) ...[
              const SizedBox(width: 12),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF59E0B).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.3)),
                  ),
                  child: Text(
                    '$anomalies warnings detected.',
                    style: GoogleFonts.inter(color: const Color(0xFFFBBF24), fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 18),
        
        if (anomalies > 0) ...[
          Text(
            'Formatting Anomaly Diagnostics Log:',
            style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
          ),
          const SizedBox(height: 6),
          Container(
            height: 100,
            decoration: BoxDecoration(
              color: const Color(0xFFEF4444).withOpacity(0.05),
              border: Border.all(color: Colors.white10),
              borderRadius: BorderRadius.circular(8),
            ),
            padding: const EdgeInsets.all(12),
            child: ListView.builder(
              itemCount: _validationErrors.length,
              itemBuilder: (context, idx) {
                return Text(
                  '• ${_validationErrors[idx]}',
                  style: GoogleFonts.inter(color: const Color(0xFFFCA5A5), fontSize: 11),
                );
              },
            ),
          ),
          const SizedBox(height: 18),
        ],

        Text(
          'Preview Grid Data (First 3 Rows):',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
        ),
        const SizedBox(height: 6),
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              columns: const [
                DataColumn(label: Text('Name')),
                DataColumn(label: Text('Mobile')),
                DataColumn(label: Text('Address')),
                DataColumn(label: Text('Credit Score')),
                DataColumn(label: Text('SSN')),
              ],
              rows: _recordsToImport.take(3).map((r) {
                return DataRow(
                  cells: [
                    DataCell(Text(r["customer_name"] ?? "")),
                    DataCell(Text(r["mobile"] ?? "")),
                    DataCell(Text(r["address"] ?? "")),
                    DataCell(Text(r["credit_score"]?.toString() ?? "N/A")),
                    DataCell(Text(r["ssn"] ?? "N/A")),
                  ],
                );
              }).toList(),
            ),
          ),
        ),
      ],
    );
  }
}
