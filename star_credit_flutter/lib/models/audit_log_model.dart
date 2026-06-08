class AuditLogModel {
  final String logId;
  final String? userId;
  final String? clientId;
  final String action;
  final Map<String, dynamic>? previousValue;
  final Map<String, dynamic>? updatedValue;
  final DateTime timestamp;

  // Joined user metadata
  final String? userName;
  final String? userRole;
  final String? clientName;

  AuditLogModel({
    required this.logId,
    this.userId,
    this.clientId,
    required this.action,
    this.previousValue,
    this.updatedValue,
    required this.timestamp,
    this.userName,
    this.userRole,
    this.clientName,
  });

  factory AuditLogModel.fromJson(Map<String, dynamic> json) {
    // Parse joined fields
    String? userJoinedName;
    String? userJoinedRole;
    if (json['users'] != null && json['users'] is Map) {
      userJoinedName = json['users']['full_name']?.toString();
      userJoinedRole = json['users']['role']?.toString();
    }

    String? clientJoinedName;
    if (json['clients'] != null && json['clients'] is Map) {
      clientJoinedName = json['clients']['customer_name']?.toString();
    }

    return AuditLogModel(
      logId: json['log_id']?.toString() ?? '',
      userId: json['user_id']?.toString(),
      clientId: json['client_id']?.toString(),
      action: json['action']?.toString() ?? 'UPDATE',
      previousValue: json['previous_value'] is Map<String, dynamic> 
          ? Map<String, dynamic>.from(json['previous_value']) 
          : null,
      updatedValue: json['updated_value'] is Map<String, dynamic> 
          ? Map<String, dynamic>.from(json['updated_value']) 
          : null,
      timestamp: json['timestamp'] != null 
          ? DateTime.parse(json['timestamp']) 
          : DateTime.now(),
      userName: userJoinedName,
      userRole: userJoinedRole,
      clientName: clientJoinedName,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'log_id': logId.isEmpty ? null : logId,
      'user_id': userId,
      'client_id': clientId,
      'action': action,
      'previous_value': previousValue,
      'updated_value': updatedValue,
      'timestamp': timestamp.toIso8601String(),
    };
  }
}
