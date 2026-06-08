class DisputeModel {
  final String disputeId;
  final String clientId;
  final String bureau; // 'EQUIFAX' | 'EXPERIAN' | 'TRANSUNION'
  final String itemDisputed;
  final String status; // 'PENDING' | 'SENT' | 'RESOLVED' | 'REJECTED'
  final String? responseDetails;
  final DateTime createdAt;
  final DateTime updatedAt;

  DisputeModel({
    required this.disputeId,
    required this.clientId,
    required this.bureau,
    required this.itemDisputed,
    required this.status,
    this.responseDetails,
    required this.createdAt,
    required this.updatedAt,
  });

  factory DisputeModel.fromJson(Map<String, dynamic> json) {
    return DisputeModel(
      disputeId: json['dispute_id']?.toString() ?? '',
      clientId: json['client_id']?.toString() ?? '',
      bureau: json['bureau']?.toString() ?? 'EQUIFAX',
      itemDisputed: json['item_disputed']?.toString() ?? '',
      status: json['status']?.toString() ?? 'PENDING',
      responseDetails: json['response_details']?.toString(),
      createdAt: json['created_at'] != null 
          ? DateTime.parse(json['created_at']) 
          : DateTime.now(),
      updatedAt: json['updated_at'] != null 
          ? DateTime.parse(json['updated_at']) 
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'dispute_id': disputeId.isEmpty ? null : disputeId,
      'client_id': clientId,
      'bureau': bureau,
      'item_disputed': itemDisputed,
      'status': status,
      'response_details': responseDetails,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  DisputeModel copyWith({
    String? disputeId,
    String? clientId,
    String? bureau,
    String? itemDisputed,
    String? status,
    String? responseDetails,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return DisputeModel(
      disputeId: disputeId ?? this.disputeId,
      clientId: clientId ?? this.clientId,
      bureau: bureau ?? this.bureau,
      itemDisputed: itemDisputed ?? this.itemDisputed,
      status: status ?? this.status,
      responseDetails: responseDetails ?? this.responseDetails,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
