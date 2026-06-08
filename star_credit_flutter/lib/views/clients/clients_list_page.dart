import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../services/supabase_service.dart';
import '../../models/client_model.dart';
import '../../models/sensitive_details_model.dart';
import '../../models/dispute_model.dart';
import '../../models/task_model.dart';
import '../../models/user_model.dart';
import '../../config/constants.dart';
import 'excel_import_wizard.dart';

class ClientsListPage extends StatefulWidget {
  const ClientsListPage({Key? key}) : super(key: key);

  @override
  State<ClientsListPage> createState() => _ClientsListPageState();
}

class _ClientsListPageState extends State<ClientsListPage> {
  bool _loading = true;
  List<ClientModel> _clients = [];
  List<UserModel> _staff = [];
  String _searchQuery = "";
  String _statusFilter = "ALL";

  @override
  void initState() {
    super.initState();
    _loadData();
    // Subscribe to realtime database changes
    Provider.of<SupabaseService>(context, listen: false).subscribeToLeads(() {
      _loadData();
    });
  }

  Future<void> _loadData() async {
    final supabase = Provider.of<SupabaseService>(context, listen: false);
    setState(() => _loading = true);
    try {
      final clientsList = await supabase.fetchClients();
      List<UserModel> employees = [];
      if (supabase.isOwner || supabase.isManager) {
        employees = await supabase.fetchEmployees();
      }

      setState(() {
        _clients = clientsList;
        _staff = employees;
      });
    } catch (e) {
      // Handle loading failure
    } finally {
      setState(() => _loading = false);
    }
  }

  void _openExcelWizard() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => ExcelImportWizard(
        onImportComplete: _loadData,
      ),
    );
  }

  void _showAddLeadDialog() {
    final nameCtrl = TextEditingController();
    final mobileCtrl = TextEditingController();
    final altMobileCtrl = TextEditingController();
    final addressCtrl = TextEditingController();
    final creditScoreCtrl = TextEditingController();
    final ssnCtrl = TextEditingController();
    final notesCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: Text('Add New Lead Record', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Customer Name *')),
              const SizedBox(height: 12),
              TextField(controller: mobileCtrl, decoration: const InputDecoration(labelText: 'Mobile Number *')),
              const SizedBox(height: 12),
              TextField(controller: altMobileCtrl, decoration: const InputDecoration(labelText: 'Alternate Mobile')),
              const SizedBox(height: 12),
              TextField(controller: addressCtrl, decoration: const InputDecoration(labelText: 'Full Address *')),
              const SizedBox(height: 12),
              TextField(controller: creditScoreCtrl, decoration: const InputDecoration(labelText: 'Credit Score')),
              const SizedBox(height: 12),
              TextField(controller: ssnCtrl, decoration: const InputDecoration(labelText: 'SSN / ID Number')),
              const SizedBox(height: 12),
              TextField(controller: notesCtrl, decoration: const InputDecoration(labelText: 'Private Notes')),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (nameCtrl.text.isEmpty || mobileCtrl.text.isEmpty || addressCtrl.text.isEmpty) return;
              try {
                final supabase = Provider.of<SupabaseService>(context, listen: false);
                await supabase.createClient(
                  name: nameCtrl.text.trim(),
                  mobile: mobileCtrl.text.trim(),
                  altMobile: altMobileCtrl.text.trim().isEmpty ? null : altMobileCtrl.text.trim(),
                  address: addressCtrl.text.trim(),
                  creditScore: int.tryParse(creditScoreCtrl.text.trim()),
                  ssn: ssnCtrl.text.trim().isEmpty ? null : ssnCtrl.text.trim(),
                  privateNotes: notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
                );
                if (context.mounted) {
                  Navigator.pop(context);
                  _loadData();
                }
              } catch (e) {
                // handle error
              }
            },
            child: const Text('Save Record'),
          ),
        ],
      ),
    );
  }

  void _showDetailsDrawer(ClientModel client) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => ClientDetailsDrawer(client: client, staffList: _staff, onUpdate: _loadData),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authService = Provider.of<SupabaseService>(context);
    final size = MediaQuery.of(context).size;
    final isDesktop = size.width > 900;

    final filtered = _clients.where((c) {
      final matchesSearch = c.customerName.toLowerCase().contains(_searchQuery.toLowerCase()) || c.mobile.contains(_searchQuery);
      final matchesStatus = _statusFilter == "ALL" || c.status == _statusFilter;
      return matchesSearch && matchesStatus;
    }).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Action Bar Header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Clients Database Console',
                  style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                Text(
                  'Manage clients details, view sensitive files, and monitor dispute actions.',
                  style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF94A3B8)),
                ),
              ],
            ),
            if (authService.isOwner || authService.isManager)
              Row(
                children: [
                  OutlinedButton.icon(
                    onPressed: _openExcelWizard,
                    icon: const Icon(Icons.upload_file, size: 16),
                    label: const Text('Excel Import'),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton.icon(
                    onPressed: _showAddLeadDialog,
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Add Lead'),
                  ),
                ],
              ),
          ],
        ),
        const SizedBox(height: 24),

        // Filters row
        Row(
          children: [
            Expanded(
              child: TextField(
                decoration: const InputDecoration(
                  hintText: 'Search clients database by name or contact...',
                  prefixIcon: Icon(Icons.search, color: Color(0xFF64748B)),
                ),
                onChanged: (val) => setState(() => _searchQuery = val),
              ),
            ),
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.white10),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _statusFilter,
                  dropdownColor: const Color(0xFF1E293B),
                  items: [
                    const DropdownMenuItem(value: "ALL", child: Text("All Statuses")),
                    ...AppConstants.workflowStages.map((stage) {
                      return DropdownMenuItem(value: stage, child: Text(AppConstants.stageLabels[stage] ?? stage));
                    })
                  ],
                  onChanged: (val) {
                    if (val != null) setState(() => _statusFilter = val);
                  },
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),

        // Grid/List Content Pane
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)))
              : (isDesktop ? _buildClientsTable(filtered) : _buildClientsList(filtered)),
        ),
      ],
    );
  }

  Widget _buildClientsTable(List<ClientModel> list) {
    return Card(
      child: SingleChildScrollView(
        child: DataTable(
          columns: const [
            DataColumn(label: Text('Customer Name')),
            DataColumn(label: Text('Mobile Contact')),
            DataColumn(label: Text('Address')),
            DataColumn(label: Text('Workflow Stage')),
            DataColumn(label: Text('Case Worker')),
            DataColumn(label: Text('Case Manager')),
          ],
          rows: list.map((c) {
            return DataRow(
              onSelectChanged: (_) => _showDetailsDrawer(c),
              cells: [
                DataCell(Text(c.customerName, style: const TextStyle(fontWeight: FontWeight.bold))),
                DataCell(Text(c.mobile)),
                DataCell(Text(c.address, maxLines: 1, overflow: TextOverflow.ellipsis)),
                DataCell(Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF6366F1).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(AppConstants.stageLabels[c.status] ?? c.status, style: const TextStyle(fontSize: 11, color: Color(0xFF45F3FF))),
                )),
                DataCell(Text(c.workerName ?? 'Unassigned')),
                DataCell(Text(c.managerName ?? 'Unassigned')),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildClientsList(List<ClientModel> list) {
    return ListView.builder(
      itemCount: list.length,
      itemBuilder: (context, idx) {
        final c = list[idx];
        return Card(
          child: ListTile(
            title: Text(c.customerName, style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('Mobile: ${c.mobile} | Stage: ${AppConstants.stageLabels[c.status]}'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _showDetailsDrawer(c),
          ),
        );
      },
    );
  }
}

class ClientDetailsDrawer extends StatefulWidget {
  final ClientModel client;
  final List<UserModel> staffList;
  final VoidCallback onUpdate;

  const ClientDetailsDrawer({
    Key? key,
    required this.client,
    required this.staffList,
    required this.onUpdate,
  }) : super(key: key);

  @override
  State<ClientDetailsDrawer> createState() => _ClientDetailsDrawerState();
}

class _ClientDetailsDrawerState extends State<ClientDetailsDrawer> {
  bool _loading = true;
  SensitiveDetailsModel? _sensitive;
  List<DisputeModel> _disputes = [];
  List<TaskModel> _tasks = [];

  @override
  void initState() {
    super.initState();
    _loadClientMeta();
  }

  Future<void> _loadClientMeta() async {
    final supabase = Provider.of<SupabaseService>(context, listen: false);
    setState(() => _loading = true);
    try {
      final sensitiveDetails = await supabase.fetchSensitiveDetails(widget.client.clientId);
      final disputesList = await supabase.fetchDisputes(widget.client.clientId);
      final tasksList = await supabase.fetchTasks(widget.client.clientId);

      setState(() {
        _sensitive = sensitiveDetails;
        _disputes = disputesList;
        _tasks = tasksList;
      });
    } catch (e) {
      // handle error
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _updateAssignment({String? workerId, String? managerId}) async {
    final supabase = Provider.of<SupabaseService>(context, listen: false);
    try {
      await supabase.assignStaff(widget.client.clientId, workerId: workerId, managerId: managerId);
      widget.onUpdate();
      _loadClientMeta();
    } catch (e) {
      // handle error
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final authService = Provider.of<SupabaseService>(context);
    final hasSensitiveAccess = authService.isOwner || authService.isManager;

    if (_loading) {
      return Container(
        height: size.height * 0.8,
        alignment: Alignment.center,
        child: const CircularProgressIndicator(color: Color(0xFF6366F1)),
      );
    }

    return Container(
      height: size.height * 0.85,
      padding: const EdgeInsets.all(24.0),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.client.customerName,
                      style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    Text('Mobile: ${widget.client.mobile} | Address: ${widget.client.address}'),
                  ],
                ),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
              ],
            ),
            const Divider(color: Colors.white10, height: 32),

            // Sensitive Details (Owner / Manager only)
            if (hasSensitiveAccess) ...[
              Text('Sensitive Financial Profile', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16, color: const Color(0xFF45F3FF))),
              const SizedBox(height: 12),
              Card(
                color: const Color(0xFF0F172A),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    children: [
                      _buildDetailRow("SSN / ID Number", _sensitive?.ssn ?? "Not Provided"),
                      const Divider(color: Colors.white12),
                      _buildDetailRow("Target Credit Score", _sensitive?.creditScore?.toString() ?? "N/A"),
                      const Divider(color: Colors.white12),
                      _buildDetailRow("Private Operations Notes", _sensitive?.privateNotes ?? "None"),
                      const Divider(color: Colors.white12),
                      _buildDetailRow("Bureau Info Details", _sensitive?.bureauInformation ?? "None"),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],

            // Staff Assignments
            if (authService.isOwner || authService.isManager) ...[
              Text('Case Work Staff Assignment', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white)),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: widget.client.assignedWorker,
                      decoration: const InputDecoration(labelText: 'Worker Account'),
                      dropdownColor: const Color(0xFF1E293B),
                      items: [
                        const DropdownMenuItem(value: "", child: Text("Unassign Worker")),
                        ...widget.staffList.where((u) => u.role == 'WORKER' || u.role == 'TELECALLER').map((u) {
                          return DropdownMenuItem(value: u.userId, child: Text(u.fullName));
                        })
                      ],
                      onChanged: (val) => _updateAssignment(workerId: val),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: widget.client.assignedManager,
                      decoration: const InputDecoration(labelText: 'Manager Account'),
                      dropdownColor: const Color(0xFF1E293B),
                      items: [
                        const DropdownMenuItem(value: "", child: Text("Unassign Manager")),
                        ...widget.staffList.where((u) => u.role == 'MANAGER').map((u) {
                          return DropdownMenuItem(value: u.userId, child: Text(u.fullName));
                        })
                      ],
                      onChanged: (val) => _updateAssignment(managerId: val),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),
            ],

            // Disputes Panel
            Text('Credit Report Correction Requests', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white)),
            const SizedBox(height: 12),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _disputes.length,
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
                return Card(
                  child: ListTile(
                    title: Text('$bureauName - $friendlyStatus', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    subtitle: Padding(
                      padding: const EdgeInsets.only(top: 4.0),
                      child: Text(d.itemDisputed, style: const TextStyle(fontSize: 13, color: Colors.white70)),
                    ),
                  ),
                );
              },
            ),
            if (_disputes.isEmpty) const Text('No correction requests reported.', style: TextStyle(fontSize: 12, color: Colors.white60)),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white70, fontSize: 13)),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 13)),
        ],
      ),
    );
  }
}
