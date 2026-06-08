class UserModel {
  final String userId;
  final String agencyId;
  final String role; // 'owner' | 'manager' | 'worker' | 'client' | 'telecaller'
  final String fullName;
  final String phone;
  final String email;
  final String status; // 'active' | 'pending' | 'inactive'
  final String branch;
  final DateTime createdAt;
  
  // Custom fields from employees join / users table
  final String? employeeId;
  final DateTime? joiningDate;
  final String? department;
  final String? emergencyContact;
  final String? profilePhotoUrl;
  
  // Custom agency details join
  final String? agencyName;

  UserModel({
    required this.userId,
    required this.agencyId,
    required this.role,
    required this.fullName,
    required this.phone,
    required this.email,
    required this.status,
    required this.branch,
    required this.createdAt,
    this.employeeId,
    this.joiningDate,
    this.department,
    this.emergencyContact,
    this.profilePhotoUrl,
    this.agencyName,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    // Parse agency information if joined
    String? agencyNameJoined;
    if (json['agencies'] != null && json['agencies'] is Map) {
      agencyNameJoined = json['agencies']['agency_name']?.toString();
    }

    return UserModel(
      userId: json['user_id']?.toString() ?? '',
      agencyId: json['agency_id']?.toString() ?? '',
      role: json['role']?.toString().toUpperCase() ?? 'WORKER',
      fullName: json['full_name']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      status: json['status']?.toString() ?? 'pending',
      branch: json['branch']?.toString() ?? 'Head Office',
      createdAt: json['created_at'] != null 
          ? DateTime.parse(json['created_at']) 
          : DateTime.now(),
      employeeId: json['employee_id']?.toString(),
      joiningDate: json['joining_date'] != null 
          ? DateTime.parse(json['joining_date']) 
          : null,
      department: json['department']?.toString(),
      emergencyContact: json['emergency_contact']?.toString(),
      profilePhotoUrl: json['profile_photo_url']?.toString(),
      agencyName: agencyNameJoined,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': userId,
      'agency_id': agencyId,
      'role': role.toLowerCase(),
      'full_name': fullName,
      'phone': phone,
      'email': email,
      'status': status.toLowerCase(),
      'branch': branch,
      'created_at': createdAt.toIso8601String(),
      'department': department,
      'emergency_contact': emergencyContact,
      'profile_photo_url': profilePhotoUrl,
    };
  }

  UserModel copyWith({
    String? userId,
    String? agencyId,
    String? role,
    String? fullName,
    String? phone,
    String? email,
    String? status,
    String? branch,
    DateTime? createdAt,
    String? employeeId,
    DateTime? joiningDate,
    String? department,
    String? emergencyContact,
    String? profilePhotoUrl,
    String? agencyName,
  }) {
    return UserModel(
      userId: userId ?? this.userId,
      agencyId: agencyId ?? this.agencyId,
      role: role ?? this.role,
      fullName: fullName ?? this.fullName,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      status: status ?? this.status,
      branch: branch ?? this.branch,
      createdAt: createdAt ?? this.createdAt,
      employeeId: employeeId ?? this.employeeId,
      joiningDate: joiningDate ?? this.joiningDate,
      department: department ?? this.department,
      emergencyContact: emergencyContact ?? this.emergencyContact,
      profilePhotoUrl: profilePhotoUrl ?? this.profilePhotoUrl,
      agencyName: agencyName ?? this.agencyName,
    );
  }
}
