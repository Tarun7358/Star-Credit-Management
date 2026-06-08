import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:file_picker/file_picker.dart';
import '../../services/supabase_service.dart';
import '../../models/client_model.dart';
import '../../models/sensitive_details_model.dart';
import '../../models/dispute_model.dart';
import '../../config/constants.dart';

class ClientPortalView extends StatefulWidget {
  const ClientPortalView({Key? key}) : super(key: key);

  @override
  State<ClientPortalView> createState() => _ClientPortalViewState();
}

class _ClientPortalViewState extends State<ClientPortalView> {
  bool _loading = true;
  ClientModel? _clientProfile;
  SensitiveDetailsModel? _sensitiveDetails;
  List<DisputeModel> _disputes = [];
  List<Map<String, dynamic>> _documents = [];

  @override
  void initState() {
    super.initState();
    _loadPortalData();
  }

  Future<void> _loadPortalData() async {
    final supabaseService = Provider.of<SupabaseService>(context, listen: false);
    setState(() => _loading = true);
    try {
      final user = supabaseService.currentUser;
      if (user == null) return;

      // In client mode, client_id corresponds to the authenticated user_id
      final clientsList = await supabaseService.fetchClients();
      if (clientsList.isNotEmpty) {
        _clientProfile = clientsList.first;
        _sensitiveDetails = await supabaseService.fetchSensitiveDetails(_clientProfile!.clientId);
        _disputes = await supabaseService.fetchDisputes(_clientProfile!.clientId);
        _documents = await supabaseService.fetchDocuments(_clientProfile!.clientId);
      }
    } catch (e) {
      // Handle loading error
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _uploadIdentityDoc() async {
    if (_clientProfile == null) return;
    final result = await FilePicker.platform.pickFiles(type: FileType.any);
    if (result == null || result.files.isEmpty) return;

    final file = result.files.first;
    final bytes = file.bytes;
    if (bytes == null) return;

    final supabaseService = Provider.of<SupabaseService>(context, listen: false);
    try {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Uploading ID credentials...'), duration: Duration(seconds: 1)),
      );
      await supabaseService.uploadDocument(_clientProfile!.clientId, file.name, bytes);
      _loadPortalData();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Document submitted successfully!')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Upload failed: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)));
    }

    if (_clientProfile == null) {
      return const Center(
        child: Text('Your credit profile could not be loaded. Contact SCM Administrator.'),
      );
    }

    final size = MediaQuery.of(context).size;
    final bool isDesktop = size.width > 900;

    return RefreshIndicator(
      onRefresh: _loadPortalData,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome Title Banner
            Text(
              'Welcome, ${_clientProfile!.customerName}',
              style: GoogleFonts.outfit(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            Text(
              'Track your ongoing credit report correction requests and upload requested documentation.',
              style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF94A3B8)),
            ),
            const SizedBox(height: 28),

            // Top Summary Indicators
            Row(
              children: [
                Expanded(
                  child: _buildMetricBlock(
                    "CREDIT RATING SCORE",
                    _sensitiveDetails?.creditScore?.toString() ?? "720",
                    Icons.speed,
                    const Color(0xFF45F3FF),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildMetricBlock(
                    "CORRECTION REQUESTS",
                    _disputes.length.toString(),
                    Icons.assignment_turned_in,
                    const Color(0xFFA855F7),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 28),

            // Responsive Layout details
            if (isDesktop)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 3, child: _buildTimelineCard()),
                  const SizedBox(width: 20),
                  Expanded(flex: 2, child: _buildDisputesCard()),
                ],
              )
            else ...[
              _buildTimelineCard(),
              const SizedBox(height: 20),
              _buildDisputesCard(),
            ],
            const SizedBox(height: 28),

            // Document Portal File Section
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Upload Identity / Billing Verification Documents',
                          style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                        ElevatedButton.icon(
                          onPressed: _uploadIdentityDoc,
                          icon: const Icon(Icons.add, size: 18),
                          label: const Text('Add Document'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _documents.length,
                      itemBuilder: (context, idx) {
                        final doc = _documents[idx];
                        return ListTile(
                          dense: true,
                          leading: const Icon(Icons.verified_user, color: Color(0xFF10B981)),
                          title: Text(doc['file_name'] ?? 'Verification doc'),
                          subtitle: Text('Submitted: ${doc['upload_date']?.toString().substring(0, 10) ?? ""}'),
                          trailing: const Icon(Icons.open_in_new, color: Color(0xFF64748B), size: 18),
                        );
                      },
                    ),
                    if (_documents.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 20),
                        child: Center(
                          child: Text(
                            'No documents uploaded yet. Upload ID or utilities bills for bureau submissions.',
                            style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B)),
                          ),
                        ),
                      )
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricBlock(String label, String value, IconData icon, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Row(
          children: [
            Icon(icon, color: color, size: 32),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: const Color(0xFF64748B)),
                ),
                Text(
                  value,
                  style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimelineCard() {
    final stages = AppConstants.workflowStages;
    final currentStage = _clientProfile!.status;
    final currentStageIdx = stages.indexOf(currentStage);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Credit Rehabilitation Workflow Timeline',
              style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 20),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: stages.length,
              itemBuilder: (context, idx) {
                final stage = stages[idx];
                final isCompleted = idx < currentStageIdx;
                final isCurrent = idx == currentStageIdx;
                
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Column(
                      children: [
                        Container(
                          width: 20,
                          height: 20,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isCompleted
                                ? const Color(0xFF10B981)
                                : (isCurrent ? const Color(0xFF6366F1) : Colors.white12),
                            border: Border.all(
                              color: isCurrent ? const Color(0xFF45F3FF) : Colors.transparent,
                              width: 1.5,
                            ),
                          ),
                          child: isCompleted
                              ? const Icon(Icons.check, size: 12, color: Colors.white)
                              : null,
                        ),
                        if (idx < stages.length - 1)
                          Container(
                            width: 2,
                            height: 36,
                            color: isCompleted ? const Color(0xFF10B981) : Colors.white12,
                          ),
                      ],
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            AppConstants.stageLabels[stage] ?? stage,
                            style: GoogleFonts.inter(
                              fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                              color: isCurrent ? Colors.white : (isCompleted ? Colors.white70 : const Color(0xFF64748B)),
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 4),
                          if (isCurrent)
                            Text(
                              'Case worker currently verifying bureau reports.',
                              style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF94A3B8)),
                            ),
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDisputesCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Credit Report Correction Requests',
              style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 16),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _disputes.length,
              separatorBuilder: (context, idx) => const Divider(color: Colors.white10),
              itemBuilder: (context, idx) {
                final d = _disputes[idx];
                final bureauName = d.bureau == 'EQUIFAX' ? 'Equifax' : (d.bureau == 'EXPERIAN' ? 'Experian' : 'TransUnion');
                final friendlyStatus = d.status == 'PENDING'
                    ? 'Waiting for Review'
                    : (d.status == 'SENT' || d.status == 'SUBMITTED'
                        ? 'Sent for Verification'
                        : (d.status == 'IN_REVIEW'
                            ? 'Under Checking'
                            : (d.status == 'RESOLVED'
                                ? 'Corrected'
                                : (d.status == 'REJECTED' ? 'Not Approved' : d.status))));
                final statusColor = d.status == 'RESOLVED'
                    ? const Color(0xFF10B981)
                    : (d.status == 'PENDING' ? const Color(0xFFF59E0B) : const Color(0xFFEF4444));
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            bureauName,
                            style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: statusColor.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              friendlyStatus,
                              style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        d.itemDisputed,
                        style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF94A3B8)),
                      ),
                    ],
                  ),
                );
              },
            ),
            if (_disputes.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Text(
                    'No correction requests reported yet.',
                    style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B)),
                  ),
                ),
              )
          ],
        ),
      ),
    );
  }
}
