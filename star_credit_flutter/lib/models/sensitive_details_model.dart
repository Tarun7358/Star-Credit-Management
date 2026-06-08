class SensitiveDetailsModel {
  final String clientId;
  final String? ssn;
  final int? creditScore;
  final String? financialRecords;
  final String? privateNotes;
  final String? adminComments;
  final String? paymentInfo;
  final String? bureauInformation;
  final DateTime updatedAt;

  SensitiveDetailsModel({
    required this.clientId,
    this.ssn,
    this.creditScore,
    this.financialRecords,
    this.privateNotes,
    this.adminComments,
    this.paymentInfo,
    this.bureauInformation,
    required this.updatedAt,
  });

  factory SensitiveDetailsModel.fromJson(Map<String, dynamic> json) {
    return SensitiveDetailsModel(
      clientId: json['client_id']?.toString() ?? '',
      ssn: json['ssn']?.toString(),
      creditScore: json['credit_score'] != null 
          ? int.tryParse(json['credit_score'].toString()) 
          : null,
      financialRecords: json['financial_records']?.toString(),
      privateNotes: json['private_notes']?.toString(),
      adminComments: json['admin_comments']?.toString(),
      paymentInfo: json['payment_info']?.toString(),
      bureauInformation: json['bureau_information']?.toString() ?? json['bureau_info']?.toString(),
      updatedAt: json['updated_at'] != null 
          ? DateTime.parse(json['updated_at']) 
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'client_id': clientId,
      'ssn': ssn,
      'credit_score': creditScore,
      'financial_records': financialRecords,
      'private_notes': privateNotes,
      'admin_comments': adminComments,
      'payment_info': paymentInfo,
      'bureau_information': bureauInformation,
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  SensitiveDetailsModel copyWith({
    String? clientId,
    String? ssn,
    int? creditScore,
    String? financialRecords,
    String? privateNotes,
    String? adminComments,
    String? paymentInfo,
    String? bureauInformation,
    DateTime? updatedAt,
  }) {
    return SensitiveDetailsModel(
      clientId: clientId ?? this.clientId,
      ssn: ssn ?? this.ssn,
      creditScore: creditScore ?? this.creditScore,
      financialRecords: financialRecords ?? this.financialRecords,
      privateNotes: privateNotes ?? this.privateNotes,
      adminComments: adminComments ?? this.adminComments,
      paymentInfo: paymentInfo ?? this.paymentInfo,
      bureauInformation: bureauInformation ?? this.bureauInformation,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
