import 'dart:typed_data';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';
import '../models/user_model.dart';
import '../models/client_model.dart';
import '../models/sensitive_details_model.dart';
import '../models/dispute_model.dart';
import '../models/task_model.dart';
import '../models/audit_log_model.dart';

class SupabaseService with ChangeNotifier {
  final SupabaseClient _client = Supabase.instance.client;
  UserModel? _currentUser;
  bool _isLoading = false;
  RealtimeChannel? _leadsSubscription;

  UserModel? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _client.auth.currentSession != null;
  SupabaseClient get client => _client;

  // Role Checks
  bool get isOwner => _currentUser?.role == AppConstants.roleOwner;
  bool get isManager => _currentUser?.role == AppConstants.roleManager;
  bool get isWorker => _currentUser?.role == AppConstants.roleWorker;
  bool get isClient => _currentUser?.role == AppConstants.roleClient;
  bool get isTelecaller => _currentUser?.role == AppConstants.roleTelecaller;

  SupabaseService() {
    // Initialize listener for auth changes
    _client.auth.onAuthStateChange.listen((data) {
      final AuthChangeEvent event = data.event;
      if (event == AuthChangeEvent.signedIn || event == AuthChangeEvent.tokenRefreshed) {
        fetchProfile();
      } else if (event == AuthChangeEvent.signedOut) {
        _currentUser = null;
        _unsubscribeFromLeads();
        notifyListeners();
      }
    });
  }

  // -------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------
  Future<void> login(String email, String password) async {
    _setLoading(true);
    try {
      final AuthResponse response = await _client.auth.signInWithPassword(
        email: email,
        password: password,
      );
      if (response.user == null) {
        throw Exception("Auth failed: Invalid credentials.");
      }
      await fetchProfile();
    } catch (e) {
      _setLoading(false);
      rethrow;
    }
  }

  Future<void> logout() async {
    await _client.auth.signOut();
  }

  Future<void> fetchProfile() async {
    final sessionUser = _client.auth.currentUser;
    if (sessionUser == null) {
      _currentUser = null;
      notifyListeners();
      return;
    }

    try {
      // Fetch user profile from public.users table
      final userData = await _client
          .from('users')
          .select('''
            *,
            agencies (
              agency_id,
              agency_name,
              email,
              phone
            )
          ''')
          .eq('user_id', sessionUser.id)
          .single();

      if (userData['status'] != 'active') {
        await logout();
        throw Exception("Account is pending approval or inactive. Status: ${userData['status']}");
      }

      // Fetch employee designation details if worker/manager
      String? employeeId;
      DateTime? joiningDate;
      if (userData['role'] != 'owner' && userData['role'] != 'client') {
        final empData = await _client
            .from('employees')
            .select('*')
            .eq('user_id', sessionUser.id)
            .maybeSingle();
        if (empData != null) {
          employeeId = empData['employee_id']?.toString();
          joiningDate = empData['joining_date'] != null 
              ? DateTime.tryParse(empData['joining_date'].toString()) 
              : null;
        }
      }

      // Combine into UserModel
      final Map<String, dynamic> combinedJson = Map<String, dynamic>.from(userData);
      combinedJson['employee_id'] = employeeId;
      combinedJson['joining_date'] = joiningDate?.toIso8601String();

      _currentUser = UserModel.fromJson(combinedJson);
    } catch (e) {
      _currentUser = null;
      await logout();
      rethrow;
    } finally {
      _setLoading(false);
      notifyListeners();
    }
  }

  // -------------------------------------------------------------
  // Clients / Leads Operations
  // -------------------------------------------------------------
  Future<List<ClientModel>> fetchClients() async {
    if (_currentUser == null) return [];
    try {
      var query = _client.from('clients').select('''
        *,
        worker:users!clients_assigned_worker_fkey(full_name),
        manager:users!clients_assigned_manager_fkey(full_name)
      ''').eq('agency_id', _currentUser!.agencyId);

      // Apply row level constraints in front-end as secondary safety (RLS handles primary safety)
      if (isWorker) {
        query = query.eq('assigned_worker', _currentUser!.userId);
      } else if (isClient) {
        query = query.eq('client_id', _currentUser!.userId);
      }

      final List<dynamic> data = await query.order('created_at', ascending: false);
      return data.map((json) => ClientModel.fromJson(json)).toList();
    } catch (e) {
      rethrow;
    }
  }

  Future<SensitiveDetailsModel?> fetchSensitiveDetails(String clientId) async {
    try {
      final data = await _client
          .from('client_sensitive_details')
          .select('*')
          .eq('client_id', clientId)
          .maybeSingle();
      if (data == null) return null;
      return SensitiveDetailsModel.fromJson(data);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> createClient({
    required String name,
    required String mobile,
    String? altMobile,
    required String address,
    DateTime? dob,
    int? creditScore,
    String? ssn,
    String? privateNotes,
    String? bureauInfo,
  }) async {
    if (_currentUser == null) throw Exception("Unauthorized action.");

    // Insert into clients table
    final newClientData = await _client.from('clients').insert({
      'agency_id': _currentUser!.agencyId,
      'customer_name': name,
      'mobile': mobile,
      'alternate_mobile': altMobile,
      'address': address,
      'dob': dob?.toIso8601String().split('T')[0],
      'status': 'NEW_LEAD',
    }).select('client_id').single();

    final clientId = newClientData['client_id'];

    // Insert into sensitive details
    await _client.from('client_sensitive_details').insert({
      'client_id': clientId,
      'ssn': ssn,
      'credit_score': creditScore,
      'private_notes': privateNotes,
      'bureau_information': bureauInfo,
    });
  }

  Future<void> updateClientStatus(String clientId, String status) async {
    await _client
        .from('clients')
        .update({'status': status, 'updated_at': DateTime.now().toIso8601String()})
        .eq('client_id', clientId);
  }

  Future<void> assignStaff(String clientId, {String? workerId, String? managerId}) async {
    final Map<String, dynamic> updates = {'updated_at': DateTime.now().toIso8601String()};
    if (workerId != null) updates['assigned_worker'] = workerId.isEmpty ? null : workerId;
    if (managerId != null) updates['assigned_manager'] = managerId.isEmpty ? null : managerId;

    await _client.from('clients').update(updates).eq('client_id', clientId);
  }

  // -------------------------------------------------------------
  // Disputes Operations
  // -------------------------------------------------------------
  Future<List<DisputeModel>> fetchDisputes(String clientId) async {
    final List<dynamic> data = await _client
        .from('disputes')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', ascending: false);
    return data.map((json) => DisputeModel.fromJson(json)).toList();
  }

  Future<void> addDispute({
    required String clientId,
    required String bureau,
    required String itemDisputed,
    required String status,
    String? responseDetails,
  }) async {
    await _client.from('disputes').insert({
      'client_id': clientId,
      'bureau': bureau,
      'item_disputed': itemDisputed,
      'status': status,
      'response_details': responseDetails,
    });
  }

  // -------------------------------------------------------------
  // Tasks Operations
  // -------------------------------------------------------------
  Future<List<TaskModel>> fetchTasks(String clientId) async {
    final List<dynamic> data = await _client
        .from('tasks')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', ascending: false);
    return data.map((json) => TaskModel.fromJson(json)).toList();
  }

  Future<void> addTask({
    required String clientId,
    required String title,
    String? description,
    DateTime? dueDate,
  }) async {
    await _client.from('tasks').insert({
      'client_id': clientId,
      'title': title,
      'description': description,
      'due_date': dueDate?.toIso8601String(),
      'status': 'PENDING',
    });
  }

  Future<void> toggleTaskStatus(String taskId, String currentStatus) async {
    final nextStatus = currentStatus == 'PENDING' ? 'COMPLETED' : 'PENDING';
    await _client.from('tasks').update({'status': nextStatus}).eq('task_id', taskId);
  }

  // -------------------------------------------------------------
  // Employees Management (Owner only)
  // -------------------------------------------------------------
  Future<List<UserModel>> fetchEmployees() async {
    if (_currentUser == null) return [];
    final List<dynamic> data = await _client
        .from('users')
        .select('''
          *,
          agencies (
            agency_name
          )
        ''')
        .eq('agency_id', _currentUser!.agencyId)
        .neq('role', 'client')
        .order('full_name', ascending: true);
    
    return data.map((json) => UserModel.fromJson(json)).toList();
  }

  Future<List<Map<String, dynamic>>> fetchEmployeeRequests() async {
    if (_currentUser == null) return [];
    final List<dynamic> data = await _client
        .from('employee_requests')
        .select('*')
        .eq('agency_id', _currentUser!.agencyId)
        .eq('status', 'pending')
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(data);
  }

  Future<void> resolveEmployeeRequest(String requestId, String status) async {
    await _client
        .from('employee_requests')
        .update({'status': status})
        .eq('request_id', requestId);
  }

  // -------------------------------------------------------------
  // Audit Logs (Owner only)
  // -------------------------------------------------------------
  Future<List<AuditLogModel>> fetchAuditLogs() async {
    final List<dynamic> data = await _client
        .from('audit_logs')
        .select('''
          *,
          users (full_name, role),
          clients (customer_name)
        ''')
        .order('timestamp', ascending: false)
        .limit(100);
    return data.map((json) => AuditLogModel.fromJson(json)).toList();
  }

  // -------------------------------------------------------------
  // Realtime Subscriptions
  // -------------------------------------------------------------
  void subscribeToLeads(VoidCallback onChanged) {
    _unsubscribeFromLeads();
    if (_currentUser == null) return;

    _leadsSubscription = _client
        .channel('public:leads_changes')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'leads',
          callback: (payload) {
            onChanged();
          },
        );
    _leadsSubscription?.subscribe();
  }

  void _unsubscribeFromLeads() {
    if (_leadsSubscription != null) {
      _client.removeChannel(_leadsSubscription!);
      _leadsSubscription = null;
    }
  }

  // -------------------------------------------------------------
  // Document Management (Supabase Storage)
  // -------------------------------------------------------------
  Future<String> uploadDocument(String clientId, String name, Uint8List fileBytes) async {
    final fileExtension = name.split('.').last;
    final cleanName = name.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '_');
    final storagePath = "$clientId/${DateTime.now().millisecondsSinceEpoch}_$cleanName.$fileExtension";

    // Upload to bucket 'documents'
    await _client.storage.from('documents').uploadBinary(storagePath, fileBytes);

    // Get public URL
    final String publicUrl = _client.storage.from('documents').getPublicUrl(storagePath);

    // Save metadata in documents table
    await _client.from('documents').insert({
      'lead_id': clientId,
      'uploaded_by': _currentUser?.userId,
      'file_url': publicUrl,
      'file_name': name,
      'document_type': fileExtension.toUpperCase(),
    });

    return publicUrl;
  }

  Future<List<Map<String, dynamic>>> fetchDocuments(String clientId) async {
    final List<dynamic> data = await _client
        .from('documents')
        .select('''
          *,
          uploader:users!documents_uploaded_by_fkey(full_name)
        ''')
        .eq('lead_id', clientId)
        .order('upload_date', ascending: false);
    return List<Map<String, dynamic>>.from(data);
  }

  // -------------------------------------------------------------
  // Visit Verification & Checking Operations
  // -------------------------------------------------------------
  Future<int> fetchVerificationRadius() async {
    if (_currentUser == null) return 100;
    try {
      final data = await _client
          .from('admin_settings')
          .select('verification_radius_meters')
          .eq('agency_id', _currentUser!.agencyId)
          .maybeSingle();
      if (data == null) return 100;
      return (data['verification_radius_meters'] as num).toInt();
    } catch (e) {
      return 100;
    }
  }

  Future<String> checkInVisit({
    required String clientId,
    required double lat,
    required double lng,
    String? deviceInfo,
  }) async {
    if (_currentUser == null) throw Exception("Unauthorized Action.");
    final data = await _client.from('customer_visits').insert({
      'client_id': clientId,
      'worker_id': _currentUser!.userId,
      'check_in_time': DateTime.now().toIso8601String(),
      'check_in_lat': lat,
      'check_in_lng': lng,
      'device_info': deviceInfo,
    }).select('visit_id').single();
    return data['visit_id'].toString();
  }

  Future<void> checkOutVisit({
    required String visitId,
    required double lat,
    required double lng,
    required String category,
    required String outcome,
    required String remarks,
    String? photoUrl,
    String? signatureUrl,
    String? receiptUrl,
    String? documentUrl,
    required int durationSeconds,
  }) async {
    try {
      await _client.from('customer_visits').update({
        'check_out_time': DateTime.now().toIso8601String(),
        'check_out_lat': lat,
        'check_out_lng': lng,
        'category': category,
        'outcome': outcome,
        'remarks': remarks,
        'photo_url': photoUrl,
        'signature_url': signatureUrl,
        'receipt_url': receiptUrl,
        'document_url': documentUrl,
        'duration_seconds': durationSeconds,
      }).eq('visit_id', visitId);
    } catch (e) {
      // Offline fallback: Save checkout payload locally to sync later
      await cacheOfflineCheckout(
        visitId: visitId,
        lat: lat,
        lng: lng,
        category: category,
        outcome: outcome,
        remarks: remarks,
        photoUrl: photoUrl,
        signatureUrl: signatureUrl,
        receiptUrl: receiptUrl,
        documentUrl: documentUrl,
        durationSeconds: durationSeconds,
      );
      rethrow;
    }
  }

  Future<String> uploadVisitFile(String bucket, String name, Uint8List fileBytes) async {
    final storagePath = "${DateTime.now().millisecondsSinceEpoch}_$name";
    await _client.storage.from(bucket).uploadBinary(storagePath, fileBytes);
    final String publicUrl = _client.storage.from(bucket).getPublicUrl(storagePath);
    return publicUrl;
  }

  // -------------------------------------------------------------
  // Offline Caching & Sync
  // -------------------------------------------------------------
  Future<void> cacheOfflineCheckout({
    required String visitId,
    required double lat,
    required double lng,
    required String category,
    required String outcome,
    required String remarks,
    String? photoUrl,
    String? signatureUrl,
    String? receiptUrl,
    String? documentUrl,
    required int durationSeconds,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final cachedVisitsJson = prefs.getString('offline_checkouts') ?? '[]';
    final List<dynamic> list = json.decode(cachedVisitsJson);

    list.add({
      'visit_id': visitId,
      'check_out_time': DateTime.now().toIso8601String(),
      'check_out_lat': lat,
      'check_out_lng': lng,
      'category': category,
      'outcome': outcome,
      'remarks': remarks,
      'photo_url': photoUrl,
      'signature_url': signatureUrl,
      'receipt_url': receiptUrl,
      'document_url': documentUrl,
      'duration_seconds': durationSeconds,
    });

    await prefs.setString('offline_checkouts', json.encode(list));
  }

  Future<int> syncOfflineCheckouts() async {
    final prefs = await SharedPreferences.getInstance();
    final cachedVisitsJson = prefs.getString('offline_checkouts') ?? '[]';
    final List<dynamic> list = json.decode(cachedVisitsJson);
    if (list.isEmpty) return 0;

    int successCount = 0;
    List<dynamic> failedList = [];

    for (var item in list) {
      try {
        await _client.from('customer_visits').update({
          'check_out_time': item['check_out_time'],
          'check_out_lat': item['check_out_lat'],
          'check_out_lng': item['check_out_lng'],
          'category': item['category'],
          'outcome': item['outcome'],
          'remarks': item['remarks'],
          'photo_url': item['photo_url'],
          'signature_url': item['signature_url'],
          'receipt_url': item['receipt_url'],
          'document_url': item['document_url'],
          'duration_seconds': item['duration_seconds'],
        }).eq('visit_id', item['visit_id']);
        successCount++;
      } catch (e) {
        failedList.add(item);
      }
    }

    await prefs.setString('offline_checkouts', json.encode(failedList));
    return successCount;
  }

  // -------------------------------------------------------------
  // Profile Settings Modifications
  // -------------------------------------------------------------
  Future<void> updateProfile({
    required String fullName,
    required String phone,
    required String department,
    required String emergencyContact,
    required String profilePhotoUrl,
  }) async {
    if (_currentUser == null) throw Exception("Unauthorized Action.");
    await _client.from('users').update({
      'full_name': fullName,
      'phone': phone,
      'department': department,
      'emergency_contact': emergencyContact,
      'profile_photo_url': profilePhotoUrl,
    }).eq('user_id', _currentUser!.userId);
    await fetchProfile();
  }

  Future<void> changePassword(String newPassword) async {
    await _client.auth.updateUser(UserAttributes(password: newPassword));
  }

  // Helper methods
  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }
}
