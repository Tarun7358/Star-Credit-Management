class TaskModel {
  final String taskId;
  final String clientId;
  final String? assignedUserId;
  final String title;
  final String? description;
  final DateTime? dueDate;
  final String status; // 'PENDING' | 'COMPLETED'
  final DateTime createdAt;

  TaskModel({
    required this.taskId,
    required this.clientId,
    this.assignedUserId,
    required this.title,
    this.description,
    this.dueDate,
    required this.status,
    required this.createdAt,
  });

  factory TaskModel.fromJson(Map<String, dynamic> json) {
    return TaskModel(
      taskId: json['task_id']?.toString() ?? '',
      clientId: json['client_id']?.toString() ?? '',
      assignedUserId: json['assigned_user_id']?.toString(),
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString(),
      dueDate: json['due_date'] != null ? DateTime.tryParse(json['due_date'].toString()) : null,
      status: json['status']?.toString() ?? 'PENDING',
      createdAt: json['created_at'] != null 
          ? DateTime.parse(json['created_at']) 
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'task_id': taskId.isEmpty ? null : taskId,
      'client_id': clientId,
      'assigned_user_id': assignedUserId,
      'title': title,
      'description': description,
      'due_date': dueDate?.toIso8601String(),
      'status': status,
      'created_at': createdAt.toIso8601String(),
    };
  }

  TaskModel copyWith({
    String? taskId,
    String? clientId,
    String? assignedUserId,
    String? title,
    String? description,
    DateTime? dueDate,
    String? status,
    DateTime? createdAt,
  }) {
    return TaskModel(
      taskId: taskId ?? this.taskId,
      clientId: clientId ?? this.clientId,
      assignedUserId: assignedUserId ?? this.assignedUserId,
      title: title ?? this.title,
      description: description ?? this.description,
      dueDate: dueDate ?? this.dueDate,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}
