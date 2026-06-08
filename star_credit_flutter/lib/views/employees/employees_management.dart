import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../services/supabase_service.dart';
import '../../models/user_model.dart';

class EmployeesManagementPage extends StatefulWidget {
  const EmployeesManagementPage({Key? key}) : super(key: key);

  @override
  State<EmployeesManagementPage> createState() => _EmployeesManagementPageState();
}

class _EmployeesManagementPageState extends State<EmployeesManagementPage> {
  bool _loading = true;
  List<UserModel> _employees = [];
  List<Map<String, dynamic>> _pendingRequests = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final supabase = Provider.of<SupabaseService>(context, listen: false);
    setState(() => _loading = true);
    try {
      final list = await supabase.fetchEmployees();
      final requests = await supabase.fetchEmployeeRequests();
      setState(() {
        _employees = list;
        _pendingRequests = requests;
      });
    } catch (e) {
      // handle error
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _handleResolution(String requestId, String status) async {
    final supabase = Provider.of<SupabaseService>(context, listen: false);
    try {
      await supabase.resolveEmployeeRequest(requestId, status);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Registration request ${status.toLowerCase()} successfully!')),
      );
      _loadData();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to update request: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)));
    }

    final size = MediaQuery.of(context).size;
    final bool isWide = size.width > 900;

    Widget leftPane() {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Active Agency Staff',
            style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.onBackground),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: Card(
              child: ListView.separated(
                itemCount: _employees.length,
                separatorBuilder: (context, idx) => const Divider(color: Colors.white10),
                itemBuilder: (context, idx) {
                  final emp = _employees[idx];
                  return ListTile(
                    leading: CircleAvatar(
                      backgroundColor: const Color(0xFF6366F1).withOpacity(0.12),
                      child: const Icon(Icons.person, color: Color(0xFF45F3FF)),
                    ),
                    title: Text(emp.fullName, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('Email: ${emp.email} | Branch: ${emp.branch}'),
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white12,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        emp.role,
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white70),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      );
    }

    Widget rightPane() {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Pending Approval Requests',
            style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.onBackground),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: ListView.builder(
              itemCount: _pendingRequests.length,
              itemBuilder: (context, idx) {
                final req = _pendingRequests[idx];
                return Card(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: const BorderSide(color: Color(0xFFF59E0B), width: 1),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              req['full_name'] ?? 'Candidate',
                              style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14, color: Theme.of(context).colorScheme.onSurface),
                            ),
                            Text(
                              (req['role'] ?? 'Worker').toString().toUpperCase(),
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFF59E0B)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text('Email: ${req['email']}'),
                        Text('Phone: ${req['phone']}'),
                        Text('Branch: ${req['branch']}'),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            OutlinedButton(
                              onPressed: () => _handleResolution(req['request_id'], 'rejected'),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                foregroundColor: const Color(0xFFEF4444),
                                side: const BorderSide(color: Color(0xFFEF4444)),
                              ),
                              child: const Text('Deny', style: TextStyle(fontSize: 12)),
                            ),
                            const SizedBox(width: 12),
                            ElevatedButton(
                              onPressed: () => _handleResolution(req['request_id'], 'approved'),
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                backgroundColor: const Color(0xFF10B981),
                              ),
                              child: const Text('Approve', style: TextStyle(fontSize: 12)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          if (_pendingRequests.isEmpty)
            Expanded(
              child: Center(
                child: Text(
                  'No pending staff approval registrations.',
                  style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B)),
                ),
              ),
            ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Title
        Text(
          'Agency Staff Control Board',
          style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.onBackground),
        ),
        Text(
          'Approve or deny registrations and review staff members roles settings.',
          style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF94A3B8)),
        ),
        const SizedBox(height: 24),

        Expanded(
          child: isWide
              ? Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(flex: 3, child: leftPane()),
                    const SizedBox(width: 24),
                    Expanded(flex: 2, child: rightPane()),
                  ],
                )
              : Column(
                  children: [
                    Expanded(child: leftPane()),
                    const SizedBox(height: 20),
                    Expanded(child: rightPane()),
                  ],
                ),
        ),
      ],
    );
  }
}
