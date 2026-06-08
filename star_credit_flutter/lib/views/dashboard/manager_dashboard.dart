import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../services/supabase_service.dart';
import '../../models/client_model.dart';
import '../../models/user_model.dart';

class ManagerDashboardView extends StatefulWidget {
  const ManagerDashboardView({super.key});

  @override
  State<ManagerDashboardView> createState() => _ManagerDashboardViewState();
}

class _ManagerDashboardViewState extends State<ManagerDashboardView> {
  bool _loading = true;
  List<ClientModel> _clients = [];
  List<UserModel> _staff = [];

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    final supabaseService = Provider.of<SupabaseService>(context, listen: false);
    setState(() => _loading = true);
    try {
      final clientsList = await supabaseService.fetchClients();
      final employees = await supabaseService.fetchEmployees();

      setState(() {
        _clients = clientsList;
        _staff = employees;
      });
    } catch (e) {
      // Handle loading error
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _assignWorker(String clientId, String workerId) async {
    final supabaseService = Provider.of<SupabaseService>(context, listen: false);
    try {
      await supabaseService.assignStaff(clientId, workerId: workerId);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Staff assignment updated successfully!')),
      );
      _loadDashboardData();
    } catch (e) {
      // Handle error
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)));
    }

    final pendingAssignment = _clients.where((c) => c.assignedWorker == null).toList();
    final documentCollection = _clients.where((c) => c.status == 'DOCUMENT_COLLECTION').length;
    final reviewStage = _clients.where((c) => c.status == 'REVIEW').length;
    final inDispute = _clients.where((c) => c.status == 'DISPUTE_CREATION' || c.status == 'BUREAU_SUBMISSION').length;

    final size = MediaQuery.of(context).size;
    final int crossAxisCount = size.width > 1200 ? 4 : (size.width > 800 ? 2 : 1);

    return RefreshIndicator(
      onRefresh: _loadDashboardData,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Team Operations Dashboard',
                        style: GoogleFonts.outfit(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Monitor active workflow queues, assign workers, and verify credit report correction requests.',
                        style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF94A3B8)),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.refresh, color: Color(0xFF45F3FF)),
                  onPressed: _loadDashboardData,
                ),
              ],
            ),
            const SizedBox(height: 28),

            // Queue stats cards
            GridView.count(
              crossAxisCount: crossAxisCount,
              shrinkWrap: true,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 2.2,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _buildQueueCard("PENDING ASSIGNMENTS", pendingAssignment.length.toString(), Icons.assignment_late, const Color(0xFFF59E0B)),
                _buildQueueCard("DOCUMENT COLLECTION", documentCollection.toString(), Icons.folder_open, const Color(0xFF6366F1)),
                _buildQueueCard("CORRECTION REQUESTS", inDispute.toString(), Icons.send_and_archive, const Color(0xFFA855F7)),
                _buildQueueCard("PENDING FINAL REVIEW", reviewStage.toString(), Icons.rate_review, const Color(0xFF10B981)),
              ],
            ),
            const SizedBox(height: 32),

            // Queue detail list
            Text(
              'Awaiting Case Manager Assignment',
              style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w700, color: Theme.of(context).colorScheme.onBackground),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: pendingAssignment.length > 5 ? 5 : pendingAssignment.length,
                  separatorBuilder: (context, index) => const Divider(color: Colors.white10),
                  itemBuilder: (context, idx) {
                    final client = pendingAssignment[idx];
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8.0),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  client.customerName,
                                  style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14, color: Theme.of(context).colorScheme.onSurface),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Mobile: ${client.mobile} | Status: ${client.status}',
                                  style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF64748B)),
                                ),
                              ],
                            ),
                          ),
                          DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              hint: Text(
                                'Assign Worker',
                                style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF45F3FF)),
                              ),
                              dropdownColor: const Color(0xFF1E293B),
                              items: _staff.map((employee) {
                                return DropdownMenuItem<String>(
                                  value: employee.userId,
                                  child: Text(
                                    employee.fullName,
                                    style: const TextStyle(fontSize: 12, color: Colors.white),
                                  ),
                                );
                              }).toList(),
                              onChanged: (val) {
                                if (val != null) {
                                  _assignWorker(client.clientId, val);
                                }
                              },
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ),
            if (pendingAssignment.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Text(
                    'All clients have been assigned to case workers.',
                    style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B)),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildQueueCard(String title, String value, IconData icon, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 28),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF64748B),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    value,
                    style: GoogleFonts.outfit(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
