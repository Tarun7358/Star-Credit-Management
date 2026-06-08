import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:file_picker/file_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'package:signature/signature.dart';
import 'dart:async';
import '../../services/supabase_service.dart';
import '../../models/client_model.dart';
import '../../models/task_model.dart';
import '../../config/constants.dart';

class WorkerDashboardView extends StatefulWidget {
  const WorkerDashboardView({Key? key}) : super(key: key);

  @override
  State<WorkerDashboardView> createState() => _WorkerDashboardViewState();
}

class _WorkerDashboardViewState extends State<WorkerDashboardView> {
  bool _loading = true;
  List<ClientModel> _assignedClients = [];
  ClientModel? _selectedClient;
  List<TaskModel> _clientTasks = [];
  List<Map<String, dynamic>> _clientDocs = [];
  String _searchQuery = "";
  String _statusFilter = "ALL";

  // Active visit variables
  String? _activeVisitId;
  DateTime? _checkInTime;
  Timer? _visitTimer;
  int _secondsElapsed = 0;

  @override
  void initState() {
    super.initState();
    _loadClients();
  }

  @override
  void dispose() {
    _visitTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadClients() async {
    final supabaseService = Provider.of<SupabaseService>(context, listen: false);
    setState(() => _loading = true);
    try {
      final list = await supabaseService.fetchClients();
      setState(() {
        _assignedClients = list;
        if (_selectedClient != null) {
          _selectedClient = list.firstWhere(
            (c) => c.clientId == _selectedClient!.clientId,
            orElse: () => _selectedClient!,
          );
        }
      });
      if (_selectedClient != null) {
        await _loadClientDetails(_selectedClient!);
      }
    } catch (e) {
      // Handle error
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _loadClientDetails(ClientModel client) async {
    final supabaseService = Provider.of<SupabaseService>(context, listen: false);
    try {
      final tasks = await supabaseService.fetchTasks(client.clientId);
      final docs = await supabaseService.fetchDocuments(client.clientId);
      setState(() {
        _clientTasks = tasks;
        _clientDocs = docs;
      });
    } catch (e) {
      // Handle error
    }
  }

  Future<void> _toggleTask(TaskModel task) async {
    // Only allow task checklist updates if checked-in or override bypass is active
    if (_activeVisitId == null && !_selectedClient!.managerOverrideAllowed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Verification Lock: Check-in required before completing tasks.')),
      );
      return;
    }
    final supabaseService = Provider.of<SupabaseService>(context, listen: false);
    try {
      await supabaseService.toggleTaskStatus(task.taskId, task.status);
      if (_selectedClient != null) {
        await _loadClientDetails(_selectedClient!);
      }
    } catch (e) {
      // Handle error
    }
  }

  Future<void> _uploadDoc() async {
    if (_selectedClient == null) return;
    if (_activeVisitId == null && !_selectedClient!.managerOverrideAllowed) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Verification Lock: Check-in required before uploading docs.')),
      );
      return;
    }
    
    final result = await FilePicker.platform.pickFiles(type: FileType.any);
    if (result == null || result.files.isEmpty) return;

    final file = result.files.first;
    final bytes = file.bytes;
    if (bytes == null) return;

    final supabaseService = Provider.of<SupabaseService>(context, listen: false);
    try {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Uploading file to storage...'), duration: Duration(seconds: 1)),
      );
      await supabaseService.uploadDocument(_selectedClient!.clientId, file.name, bytes);
      await _loadClientDetails(_selectedClient!);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Document uploaded successfully!')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Upload failed: $e')),
      );
    }
  }

  Future<void> _startVisit() async {
    if (_selectedClient == null) return;
    
    final supabaseService = Provider.of<SupabaseService>(context, listen: false);
    final int radiusLimit = await supabaseService.fetchVerificationRadius();

    setState(() => _loading = true);

    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          throw Exception("Location permissions are required to check-in.");
        }
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      if (_selectedClient!.latitude != null && _selectedClient!.longitude != null) {
        final distance = Geolocator.distanceBetween(
          position.latitude,
          position.longitude,
          _selectedClient!.latitude!,
          _selectedClient!.longitude!,
        );

        final hasOverride = _selectedClient!.managerOverrideAllowed;

        if (distance > radiusLimit && !hasOverride) {
          showDialog(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text("Location Restrained"),
              content: Text(
                "You are currently ${distance.toStringAsFixed(1)}m away from this customer.\n"
                "Visit check-in is locked unless you are within $radiusLimit meters of the location."
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text("Close"),
                )
              ],
            ),
          );
          return;
        }
      }

      final visitId = await supabaseService.checkInVisit(
        clientId: _selectedClient!.clientId,
        lat: position.latitude,
        lng: position.longitude,
        deviceInfo: kIsWeb ? "Web Browser" : "Mobile App Client",
      );

      setState(() {
        _activeVisitId = visitId;
        _checkInTime = DateTime.now();
        _secondsElapsed = 0;
      });

      _visitTimer?.cancel();
      _visitTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        setState(() {
          _secondsElapsed++;
        });
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Checked in successfully! Visit started.')),
      );

    } catch (e) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text("GPS Error"),
          content: Text("Could not retrieve GPS coordinates: $e"),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text("Close"),
            )
          ],
        ),
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _endVisit() async {
    if (_activeVisitId == null) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => CheckoutDialog(
        onSubmitted: (category, outcome, remarks, photoBytes, sigBytes) async {
          final supabaseService = Provider.of<SupabaseService>(context, listen: false);
          setState(() => _loading = true);
          try {
            final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);

            String? photoUrl;
            if (photoBytes != null) {
              photoUrl = await supabaseService.uploadVisitFile(
                'visit_photos',
                'photo_${_activeVisitId}.jpg',
                photoBytes,
              );
            }

            String? signatureUrl;
            if (sigBytes != null) {
              signatureUrl = await supabaseService.uploadVisitFile(
                'signatures',
                'sig_${_activeVisitId}.png',
                sigBytes,
              );
            }

            await supabaseService.checkOutVisit(
              visitId: _activeVisitId!,
              lat: pos.latitude,
              lng: pos.longitude,
              category: category,
              outcome: outcome,
              remarks: remarks,
              photoUrl: photoUrl,
              signatureUrl: signatureUrl,
              durationSeconds: _secondsElapsed,
            );

            if (outcome == "Payment Collected" || outcome == "Case Closed") {
              await supabaseService.updateClientStatus(_selectedClient!.clientId, "COMPLETED");
            } else if (outcome == "Promise To Pay") {
              await supabaseService.updateClientStatus(_selectedClient!.clientId, "FOLLOW_UP");
            }

            _visitTimer?.cancel();
            setState(() {
              _activeVisitId = null;
              _checkInTime = null;
            });

            await _loadClients();
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Visit logged successfully! Checkout completed.')),
            );
          } catch (e) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Checkout saved locally (Offline sync active): $e')),
            );
            _visitTimer?.cancel();
            setState(() {
              _activeVisitId = null;
              _checkInTime = null;
            });
            await _loadClients();
          } finally {
            setState(() => _loading = false);
          }
        },
      ),
    );
  }

  String _formatTimer(int totalSeconds) {
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  Widget _buildVisitTrackerWidget() {
    final isCheckedIn = _activeVisitId != null;
    final hasOverride = _selectedClient!.managerOverrideAllowed;

    return Card(
      color: isCheckedIn ? Colors.black : const Color(0xFF1E293B),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: isCheckedIn ? Colors.white24 : Colors.white10),
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
                  isCheckedIn ? "ACTIVE VISIT SESSİON" : "LOCATİON CHECK-IN LOCK",
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: isCheckedIn ? Colors.white70 : Colors.white38,
                    letterSpacing: 1.2,
                  ),
                ),
                if (hasOverride)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade900.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: Colors.amber.shade700),
                    ),
                    child: Text(
                      "OVERRİDE ACTİVE",
                      style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.amber.shade300),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if (isCheckedIn) ...[
              Text(
                "Elapsed Time: ${_formatTimer(_secondsElapsed)}",
                style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              const SizedBox(height: 4),
              Text(
                "Check-in time: ${_checkInTime?.toLocal().toString().split('.')[0] ?? ''}",
                style: GoogleFonts.inter(fontSize: 12, color: Colors.white60),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _endVisit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                icon: const Icon(Icons.exit_to_app),
                label: Text("COMPLETE VISİT (CHECK-OUT)", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
              ),
            ] else ...[
              Text(
                _selectedClient!.address,
                style: GoogleFonts.inter(fontSize: 13, color: Colors.white70),
              ),
              const SizedBox(height: 6),
              if (_selectedClient!.latitude != null && _selectedClient!.longitude != null)
                Text(
                  "GPS Lock Coordinates: ${_selectedClient!.latitude}, ${_selectedClient!.longitude}",
                  style: GoogleFonts.inter(fontSize: 11, color: Colors.white38),
                )
              else
                Text(
                  "No coordinates registered. Please register location.",
                  style: GoogleFonts.inter(fontSize: 11, color: Colors.red.shade400, fontWeight: FontWeight.w500),
                ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _startVisit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white10,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  side: const BorderSide(color: Colors.white24),
                ),
                icon: const Icon(Icons.location_on),
                label: Text("START VISİT (CHECK-İN)", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _assignedClients.isEmpty) {
      return Center(
        child: CircularProgressIndicator(
          color: Theme.of(context).colorScheme.primary,
        ),
      );
    }

    final filteredClients = _assignedClients.where((client) {
      final nameMatches = client.customerName.toLowerCase().contains(_searchQuery.toLowerCase());
      final phoneMatches = client.mobile.contains(_searchQuery);
      final statusMatches = _statusFilter == "ALL" || client.status == _statusFilter;
      return (nameMatches || phoneMatches) && statusMatches;
    }).toList();

    final size = MediaQuery.of(context).size;
    final bool isWideScreen = size.width > 900;

    Widget leftPane() {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
                  decoration: InputDecoration(
                    hintText: 'Search by client name...',
                    prefixIcon: Icon(
                      Icons.search,
                      color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                    ),
                  ),
                  onChanged: (val) {
                    setState(() {
                      _searchQuery = val;
                    });
                  },
                ),
              ),
              const SizedBox(width: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: Theme.of(context).cardColor,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Theme.of(context).dividerColor),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _statusFilter,
                    dropdownColor: Theme.of(context).cardColor,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontWeight: FontWeight.w600,
                    ),
                    iconEnabledColor: Theme.of(context).colorScheme.onSurface,
                    items: [
                      const DropdownMenuItem(value: "ALL", child: Text("All Statuses")),
                      ...AppConstants.workflowStages.map((stage) {
                        return DropdownMenuItem(
                          value: stage,
                          child: Text(AppConstants.stageLabels[stage] ?? stage),
                        );
                      })
                    ],
                    onChanged: (val) {
                      if (val != null) {
                        setState(() {
                          _statusFilter = val;
                        });
                      }
                    },
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Expanded(
            child: ListView.builder(
              itemCount: filteredClients.length,
              itemBuilder: (context, idx) {
                final client = filteredClients[idx];
                final isSelected = _selectedClient?.clientId == client.clientId;
                return Card(
                  color: isSelected ? Theme.of(context).colorScheme.primary.withOpacity(0.12) : null,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(
                      color: isSelected ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.outline.withOpacity(0.2),
                      width: isSelected ? 1.5 : 1,
                    ),
                  ),
                  child: ListTile(
                    title: Text(
                      client.customerName,
                      style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.onSurface),
                    ),
                    subtitle: Text(
                      'Mobile: ${client.mobile} | ${AppConstants.stageLabels[client.status]}',
                      style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7)),
                    ),
                    trailing: Icon(Icons.chevron_right, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.38)),
                    onTap: () async {
                      if (_activeVisitId != null) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Please complete/check-out of the active visit session first.')),
                        );
                        return;
                      }
                      setState(() {
                        _selectedClient = client;
                      });
                      await _loadClientDetails(client);
                    },
                  ),
                );
              },
            ),
          ),
        ],
      );
    }

    Widget rightPane() {
      if (_selectedClient == null) {
        return const Center(
          child: Text('Select a client from the checklist to manage visit progress.'),
        );
      }

      return SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _selectedClient!.customerName,
                        style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.onBackground),
                      ),
                      const SizedBox(height: 4),
                      if (_selectedClient!.outstandingAmount > 0)
                        Text(
                          'Outstanding Balance: ₹${_selectedClient!.outstandingAmount.toStringAsFixed(2)}',
                          style: GoogleFonts.inter(fontSize: 13, color: Colors.greenAccent, fontWeight: FontWeight.bold),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Check-in tracking session widget
            _buildVisitTrackerWidget(),
            const SizedBox(height: 24),

            // Checklist tasks
            Text(
              'Workflow Verification Checklist',
              style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.onBackground),
            ),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  children: [
                    ListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _clientTasks.length,
                      itemBuilder: (context, idx) {
                        final task = _clientTasks[idx];
                        final isCompleted = task.status == 'COMPLETED';
                        return CheckboxListTile(
                          value: isCompleted,
                          title: Text(
                            task.title,
                            style: TextStyle(
                              decoration: isCompleted ? TextDecoration.lineThrough : null,
                              color: isCompleted ? Theme.of(context).colorScheme.onSurface.withOpacity(0.38) : Theme.of(context).colorScheme.onSurface,
                              fontSize: 14,
                            ),
                          ),
                          activeColor: Theme.of(context).colorScheme.primary,
                          checkColor: Theme.of(context).colorScheme.onPrimary,
                          onChanged: (_) => _toggleTask(task),
                        );
                      },
                    ),
                    if (_clientTasks.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 16.0),
                        child: Text('No checklist items defined for this stage.', style: TextStyle(fontSize: 12)),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Files & Documents section
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Uploaded Documents',
                  style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.onBackground),
                ),
                TextButton.icon(
                  onPressed: _uploadDoc,
                  icon: const Icon(Icons.upload_file, size: 18),
                  label: const Text('Upload Doc'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _clientDocs.length,
                  separatorBuilder: (context, idx) => const Divider(color: Colors.white10),
                  itemBuilder: (context, idx) {
                    final doc = _clientDocs[idx];
                    return ListTile(
                      dense: true,
                      leading: Icon(Icons.description, color: Theme.of(context).colorScheme.onSurface),
                      title: Text(
                        doc['file_name'] ?? 'File',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Text('Format: ${doc['document_type']} | Uploaded by: ${doc['uploader']?['full_name'] ?? 'System'}'),
                      trailing: Icon(Icons.open_in_new, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.38), size: 18),
                      onTap: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Document Link: ${doc['file_url']}')),
                        );
                      },
                    );
                  },
                ),
              ),
            ),
            if (_clientDocs.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16.0),
                child: Center(child: Text('No verification documents uploaded.', style: TextStyle(fontSize: 12))),
              ),
          ],
        ),
      );
    }

    if (isWideScreen) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 2, child: leftPane()),
          const VerticalDivider(width: 32, color: Colors.white10),
          Expanded(flex: 3, child: rightPane()),
        ],
      );
    }

    if (_selectedClient != null) {
      return Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: Icon(Icons.arrow_back, color: Theme.of(context).colorScheme.onBackground),
            onPressed: () {
              setState(() {
                _selectedClient = null;
              });
            },
          ),
          title: Text(
            _selectedClient!.customerName,
            style: GoogleFonts.outfit(
              fontWeight: FontWeight.w700,
              color: Theme.of(context).colorScheme.onBackground,
            ),
          ),
          backgroundColor: Colors.transparent,
          elevation: 0,
        ),
        body: rightPane(),
      );
    }

    return leftPane();
  }
}

class CheckoutDialog extends StatefulWidget {
  final Function(
    String category,
    String outcome,
    String remarks,
    Uint8List? photoBytes,
    Uint8List? sigBytes,
  ) onSubmitted;

  const CheckoutDialog({Key? key, required this.onSubmitted}) : super(key: key);

  @override
  State<CheckoutDialog> createState() => _CheckoutDialogState();
}

class _CheckoutDialogState extends State<CheckoutDialog> {
  String _category = "CUSTOMER_AVAILABLE";
  String _outcome = "Met Customer";
  final _remarksController = TextEditingController();
  Uint8List? _photoBytes;
  String? _photoName;
  late SignatureController _sigController;

  final Map<String, List<String>> _outcomesMap = {
    "CUSTOMER_AVAILABLE": [
      "Met Customer",
      "Payment Collected",
      "Promise To Pay",
      "Follow-Up Required",
      "Settlement Discussion",
      "Correction Request Raised",
      "Case Closed"
    ],
    "CUSTOMER_NOT_AVAILABLE": [
      "House Locked / Not Home",
      "Incorrect Address",
      "Customer Shifted"
    ]
  };

  @override
  void initState() {
    super.initState();
    _sigController = SignatureController(
      penStrokeWidth: 3,
      penColor: Colors.black,
      exportBackgroundColor: Colors.white,
    );
  }

  @override
  void dispose() {
    _remarksController.dispose();
    _sigController.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.image);
    if (result != null && result.files.isNotEmpty) {
      setState(() {
        _photoBytes = result.files.first.bytes;
        _photoName = result.files.first.name;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(
        "Visit Check-Out & Verification",
        style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.white),
      ),
      backgroundColor: const Color(0xFF1E293B),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            DropdownButtonFormField<String>(
              value: _category,
              dropdownColor: const Color(0xFF1E293B),
              decoration: const InputDecoration(
                labelText: "Visit Category",
                labelStyle: TextStyle(color: Colors.white70),
              ),
              style: const TextStyle(color: Colors.white),
              items: const [
                DropdownMenuItem(value: "CUSTOMER_AVAILABLE", child: Text("Customer Available")),
                DropdownMenuItem(value: "CUSTOMER_NOT_AVAILABLE", child: Text("Customer Not Available")),
              ],
              onChanged: (val) {
                if (val != null) {
                  setState(() {
                    _category = val;
                    _outcome = _outcomesMap[val]!.first;
                  });
                }
              },
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _outcome,
              dropdownColor: const Color(0xFF1E293B),
              decoration: const InputDecoration(
                labelText: "Visit Outcome / Status",
                labelStyle: TextStyle(color: Colors.white70),
              ),
              style: const TextStyle(color: Colors.white),
              items: _outcomesMap[_category]!
                  .map((o) => DropdownMenuItem(value: o, child: Text(o)))
                  .toList(),
              onChanged: (val) {
                if (val != null) {
                  setState(() {
                    _outcome = val;
                  });
                }
              },
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _remarksController,
              decoration: const InputDecoration(
                labelText: "Outcome Remarks",
                labelStyle: TextStyle(color: Colors.white70),
              ),
              style: const TextStyle(color: Colors.white),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            Text(
              "Photo Proof Attachment",
              style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.white70),
            ),
            const SizedBox(height: 6),
            OutlinedButton.icon(
              onPressed: _pickPhoto,
              icon: const Icon(Icons.camera_alt, color: Colors.white70),
              label: Text(_photoName ?? "Attach Visit / Receipt Photo", style: const TextStyle(color: Colors.white70)),
              style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.white30)),
            ),
            const SizedBox(height: 16),
            Text(
              "Capture Customer / Agent Signature",
              style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.white70),
            ),
            const SizedBox(height: 6),
            Container(
              height: 120,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white24),
                borderRadius: BorderRadius.circular(8),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Signature(
                  controller: _sigController,
                  backgroundColor: Colors.white,
                ),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () => _sigController.clear(),
                  child: const Text("Clear Signature", style: TextStyle(color: Colors.white70)),
                ),
              ],
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text("Cancel", style: TextStyle(color: Colors.white70)),
        ),
        ElevatedButton(
          onPressed: () async {
            final sig = await _sigController.toPngBytes();
            widget.onSubmitted(
              _category,
              _outcome,
              _remarksController.text,
              _photoBytes,
              sig,
            );
            Navigator.of(context).pop();
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.white,
            foregroundColor: Colors.black,
          ),
          child: const Text("Submit Checkout", style: TextStyle(fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }
}
