class ClientModel {
  final String clientId;
  final String agencyId;
  final String customerName;
  final String mobile;
  final String? alternateMobile;
  final String address;
  final DateTime? dob;
  final String? assignedWorker;
  final String? assignedManager;
  final String status; // 'NEW_LEAD', 'VERIFICATION', etc.
  final DateTime createdAt;
  final DateTime updatedAt;

  // Location & Account details
  final double? latitude;
  final double? longitude;
  final String? googleMapsLink;
  final String? area;
  final String? pincode;
  final double outstandingAmount;
  final DateTime? dueDate;
  final bool managerOverrideAllowed;
  final String? managerOverrideReason;

  // Joined fields
  final String? workerName;
  final String? managerName;

  ClientModel({
    required this.clientId,
    required this.agencyId,
    required this.customerName,
    required this.mobile,
    this.alternateMobile,
    required this.address,
    this.dob,
    this.assignedWorker,
    this.assignedManager,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.latitude,
    this.longitude,
    this.googleMapsLink,
    this.area,
    this.pincode,
    this.outstandingAmount = 0.0,
    this.dueDate,
    this.managerOverrideAllowed = false,
    this.managerOverrideReason,
    this.workerName,
    this.managerName,
  });

  factory ClientModel.fromJson(Map<String, dynamic> json) {
    // Parse joined worker and manager names if available
    String? worker;
    if (json['worker'] != null && json['worker'] is Map) {
      worker = json['worker']['full_name']?.toString();
    } else if (json['users_assigned_worker'] != null && json['users_assigned_worker'] is Map) {
      worker = json['users_assigned_worker']['full_name']?.toString();
    }
    
    String? manager;
    if (json['manager'] != null && json['manager'] is Map) {
      manager = json['manager']['full_name']?.toString();
    } else if (json['users_assigned_manager'] != null && json['users_assigned_manager'] is Map) {
      manager = json['users_assigned_manager']['full_name']?.toString();
    }

    double? parseDouble(dynamic val) {
      if (val == null) return null;
      if (val is num) return val.toDouble();
      return double.tryParse(val.toString());
    }

    return ClientModel(
      clientId: json['client_id']?.toString() ?? '',
      agencyId: json['agency_id']?.toString() ?? '',
      customerName: json['customer_name']?.toString() ?? '',
      mobile: json['mobile']?.toString() ?? '',
      alternateMobile: json['alternate_mobile']?.toString(),
      address: json['address']?.toString() ?? '',
      dob: json['dob'] != null ? DateTime.tryParse(json['dob'].toString()) : null,
      assignedWorker: json['assigned_worker']?.toString(),
      assignedManager: json['assigned_manager']?.toString(),
      status: json['status']?.toString() ?? 'NEW_LEAD',
      createdAt: json['created_at'] != null 
          ? DateTime.parse(json['created_at']) 
          : DateTime.now(),
      updatedAt: json['updated_at'] != null 
          ? DateTime.parse(json['updated_at']) 
          : DateTime.now(),
      latitude: parseDouble(json['latitude']),
      longitude: parseDouble(json['longitude']),
      googleMapsLink: json['google_maps_link']?.toString(),
      area: json['area']?.toString(),
      pincode: json['pincode']?.toString(),
      outstandingAmount: parseDouble(json['outstanding_amount']) ?? 0.0,
      dueDate: json['due_date'] != null ? DateTime.tryParse(json['due_date'].toString()) : null,
      managerOverrideAllowed: json['manager_override_allowed'] == true,
      managerOverrideReason: json['manager_override_reason']?.toString(),
      workerName: worker,
      managerName: manager,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'client_id': clientId.isEmpty ? null : clientId,
      'agency_id': agencyId,
      'customer_name': customerName,
      'mobile': mobile,
      'alternate_mobile': alternateMobile,
      'address': address,
      'dob': dob?.toIso8601String().split('T')[0],
      'assigned_worker': assignedWorker,
      'assigned_manager': assignedManager,
      'status': status,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
      'latitude': latitude,
      'longitude': longitude,
      'google_maps_link': googleMapsLink,
      'area': area,
      'pincode': pincode,
      'outstanding_amount': outstandingAmount,
      'due_date': dueDate?.toIso8601String().split('T')[0],
      'manager_override_allowed': managerOverrideAllowed,
      'manager_override_reason': managerOverrideReason,
    };
  }

  ClientModel copyWith({
    String? clientId,
    String? agencyId,
    String? customerName,
    String? mobile,
    String? alternateMobile,
    String? address,
    DateTime? dob,
    String? assignedWorker,
    String? assignedManager,
    String? status,
    DateTime? createdAt,
    DateTime? updatedAt,
    double? latitude,
    double? longitude,
    String? googleMapsLink,
    String? area,
    String? pincode,
    double? outstandingAmount,
    DateTime? dueDate,
    bool? managerOverrideAllowed,
    String? managerOverrideReason,
    String? workerName,
    String? managerName,
  }) {
    return ClientModel(
      clientId: clientId ?? this.clientId,
      agencyId: agencyId ?? this.agencyId,
      customerName: customerName ?? this.customerName,
      mobile: mobile ?? this.mobile,
      alternateMobile: alternateMobile ?? this.alternateMobile,
      address: address ?? this.address,
      dob: dob ?? this.dob,
      assignedWorker: assignedWorker ?? this.assignedWorker,
      assignedManager: assignedManager ?? this.assignedManager,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      googleMapsLink: googleMapsLink ?? this.googleMapsLink,
      area: area ?? this.area,
      pincode: pincode ?? this.pincode,
      outstandingAmount: outstandingAmount ?? this.outstandingAmount,
      dueDate: dueDate ?? this.dueDate,
      managerOverrideAllowed: managerOverrideAllowed ?? this.managerOverrideAllowed,
      managerOverrideReason: managerOverrideReason ?? this.managerOverrideReason,
      workerName: workerName ?? this.workerName,
      managerName: managerName ?? this.managerName,
    );
  }
}
