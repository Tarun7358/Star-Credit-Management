import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../services/supabase_service.dart';
import '../../models/client_model.dart';
import '../../models/audit_log_model.dart';

class OwnerDashboardView extends StatefulWidget {
  const OwnerDashboardView({Key? key}) : super(key: key);

  @override
  State<OwnerDashboardView> createState() => _OwnerDashboardViewState();
}

class _OwnerDashboardViewState extends State<OwnerDashboardView> {
  bool _loading = true;
  List<ClientModel> _clients = [];
  List<AuditLogModel> _auditLogs = [];
  int _pendingApprovals = 0;

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    final supabaseService = Provider.of<SupabaseService>(context, listen: false);
    setState(() => _loading = true);
    try {
      final clientsList = await supabaseService.fetchClients();
      final auditList = await supabaseService.fetchAuditLogs();
      final employeeRequests = await supabaseService.fetchEmployeeRequests();

      setState(() {
        _clients = clientsList;
        _auditLogs = auditList;
        _pendingApprovals = employeeRequests.length;
      });
    } catch (e) {
      // Handle loading error
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)));
    }

    final totalClients = _clients.length;
    final activeCases = _clients.where((c) => c.status != 'COMPLETED' && c.status != 'NEW_LEAD').length;
    final completedCases = _clients.where((c) => c.status == 'COMPLETED').length;
    final newLeads = _clients.where((c) => c.status == 'NEW_LEAD').length;

    // Responsive grid counts
    final size = MediaQuery.of(context).size;
    final int crossAxisCount = size.width > 1200 ? 4 : (size.width > 800 ? 2 : 1);

    return RefreshIndicator(
      onRefresh: _loadDashboardData,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome Header banner
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Welcome back, ${Provider.of<SupabaseService>(context).currentUser?.fullName ?? "Owner"}',
                        style: GoogleFonts.outfit(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Operational dashboard monitoring Star Credit repairs and workflow logs.',
                        style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF94A3B8)),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.refresh, color: Color(0xFF45F3FF)),
                  onPressed: _loadDashboardData,
                ),
              ],
            ),
            const SizedBox(height: 28),

            // Metrics Grid
            GridView.count(
              crossAxisCount: crossAxisCount,
              shrinkWrap: true,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 2.2,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _buildMetricCard("TOTAL CLIENTS", totalClients.toString(), Icons.people, const Color(0xFF6366F1)),
                _buildMetricCard("CORRECTION REQUESTS", activeCases.toString(), Icons.pending_actions, const Color(0xFFA855F7)),
                _buildMetricCard("COMPLETED CASES", completedCases.toString(), Icons.check_circle, const Color(0xFF10B981)),
                _buildMetricCard("PENDING STAFF APPROVALS", _pendingApprovals.toString(), Icons.badge, const Color(0xFFEF4444)),
              ],
            ),
            const SizedBox(height: 32),

            // Charts & Activity Logs Row
            if (size.width > 1000)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 3, child: _buildChartCard()),
                  const SizedBox(width: 20),
                  Expanded(flex: 2, child: _buildActivitiesCard()),
                ],
              )
            else ...[
              _buildChartCard(),
              const SizedBox(height: 20),
              _buildActivitiesCard(),
            ],
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricCard(String title, String value, IconData icon, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 28),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF64748B),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    value,
                    style: GoogleFonts.outfit(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChartCard() {
    // Basic fl_chart bar data representing stages
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Credit Score Target Distribution',
              style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white),
            ),
            const SizedBox(height: 8),
            Text(
              'Volume breakdown grouped by score thresholds.',
              style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B)),
            ),
            const SizedBox(height: 40),
            SizedBox(
              height: 220,
              child: BarChart(
                BarChartData(
                  alignment: BarChartAlignment.spaceAround,
                  maxY: 20,
                  barTouchData: BarTouchData(enabled: true),
                  titlesData: FlTitlesData(
                    show: true,
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (double value, TitleMeta meta) {
                          const style = TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold, fontSize: 11);
                          Widget text;
                          switch (value.toInt()) {
                            case 0:
                              text = const Text('300-500', style: style);
                              break;
                            case 1:
                              text = const Text('500-600', style: style);
                              break;
                            case 2:
                              text = const Text('600-700', style: style);
                              break;
                            case 3:
                              text = const Text('700-850', style: style);
                              break;
                            default:
                              text = const Text('', style: style);
                              break;
                          }
                          return SideTitleWidget(axisSide: meta.axisSide, child: text);
                        },
                      ),
                    ),
                    leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  ),
                  gridData: const FlGridData(show: false),
                  borderData: FlBorderData(show: false),
                  barGroups: [
                    BarChartGroupData(
                      x: 0,
                      barRods: [BarChartRodData(toY: 6, color: const Color(0xFFEF4444), width: 22, borderRadius: BorderRadius.circular(4))],
                    ),
                    BarChartGroupData(
                      x: 1,
                      barRods: [BarChartRodData(toY: 12, color: const Color(0xFFF59E0B), width: 22, borderRadius: BorderRadius.circular(4))],
                    ),
                    BarChartGroupData(
                      x: 2,
                      barRods: [BarChartRodData(toY: 18, color: const Color(0xFF6366F1), width: 22, borderRadius: BorderRadius.circular(4))],
                    ),
                    BarChartGroupData(
                      x: 3,
                      barRods: [BarChartRodData(toY: 9, color: const Color(0xFF10B981), width: 22, borderRadius: BorderRadius.circular(4))],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActivitiesCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Audit Operations Log',
              style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white),
            ),
            const SizedBox(height: 16),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _auditLogs.length > 5 ? 5 : _auditLogs.length,
              separatorBuilder: (context, index) => const Divider(color: Colors.white10),
              itemBuilder: (context, idx) {
                final log = _auditLogs[idx];
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            log.userName ?? 'System User',
                            style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white),
                          ),
                          Text(
                            log.timestamp.toString().substring(11, 16),
                            style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF64748B)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${log.action} - client ${log.clientName ?? "Details"}',
                        style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF94A3B8)),
                      ),
                    ],
                  ),
                );
              },
            ),
            if (_auditLogs.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Center(
                  child: Text(
                    'No activities logged yet.',
                    style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B)),
                  ),
                ),
              )
          ],
        ),
      ),
    );
  }
}
