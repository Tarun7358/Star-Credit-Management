import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../services/supabase_service.dart';
import '../../routes/app_routes.dart';
import '../../config/constants.dart';

import 'owner_dashboard.dart';
import 'manager_dashboard.dart';
import 'worker_dashboard.dart';
import 'settings_view.dart';
import '../client_portal/client_portal_page.dart';
import '../clients/clients_list_page.dart';
import '../employees/employees_management.dart';
import '../reports/reports_view.dart';

class ResponsiveDashboard extends StatefulWidget {
  const ResponsiveDashboard({super.key});

  @override
  State<ResponsiveDashboard> createState() => _ResponsiveDashboardState();
}

class _ResponsiveDashboardState extends State<ResponsiveDashboard> {
  int _selectedIndex = 0;

  Widget _getRoleDashboard(SupabaseService auth) {
    if (auth.isOwner) {
      return const OwnerDashboardView();
    } else if (auth.isManager) {
      return const ManagerDashboardView();
    } else if (auth.isClient) {
      return const ClientPortalView();
    } else {
      return const WorkerDashboardView(); // Telecallers / Workers see client checklist dashboard
    }
  }

  Widget _getSelectedView(int index, SupabaseService auth) {
    if (index == 0) {
      return _getRoleDashboard(auth);
    }

    // Determine target page index based on role access
    final List<Widget> pages = [];
    pages.add(const ClientsListPage());
    
    if (auth.isOwner) {
      pages.add(const EmployeesManagementPage());
    }
    
    if (auth.isOwner || auth.isManager) {
      pages.add(const ReportsView());
    }

    pages.add(const SettingsView());

    final int pageIndex = index - 1;
    if (pageIndex < pages.length) {
      return pages[pageIndex];
    }

    return const Center(child: Text('Console module not found.'));
  }

  List<Map<String, dynamic>> _getNavItems(SupabaseService auth) {
    final items = [
      {"label": "Overview Dashboard", "icon": Icons.dashboard_outlined, "selectedIcon": Icons.dashboard},
      {"label": "Clients Console", "icon": Icons.people_outline, "selectedIcon": Icons.people},
    ];

    if (auth.isOwner) {
      items.add({"label": "Staff Directory", "icon": Icons.badge_outlined, "selectedIcon": Icons.badge});
    }

    if (auth.isOwner || auth.isManager) {
      items.add({"label": "Reports & Analytics", "icon": Icons.analytics_outlined, "selectedIcon": Icons.analytics});
    }

    items.add({"label": "Settings", "icon": Icons.settings_outlined, "selectedIcon": Icons.settings});

    return items;
  }

  @override
  Widget build(BuildContext context) {
    final authService = Provider.of<SupabaseService>(context);
    final size = MediaQuery.of(context).size;
    final isDesktop = size.width >= AppConstants.tabletBreakPoint;
    final isTablet = size.width >= AppConstants.mobileBreakPoint && size.width < AppConstants.tabletBreakPoint;

    final navItems = _getNavItems(authService);

    // Adjust selected index in case nav items count drops
    if (_selectedIndex >= navItems.length) {
      _selectedIndex = 0;
    }

    final user = authService.currentUser;
    final String welcomeName = user?.fullName ?? 'Agency Staff';
    final String userRole = user?.role ?? 'WORKER';
    final String agencyName = user?.agencyName ?? 'Star DSA';

    Widget navDrawerContent() {
      return Container(
        color: const Color(0xFF1E293B),
        child: Column(
          children: [
            // Header
            SafeArea(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: Colors.white10)),
                ),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: Image.asset(
                        'assets/logo.png',
                        width: 32,
                        height: 32,
                        fit: BoxFit.contain,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            agencyName.toUpperCase(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.outfit(
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
                              color: Colors.white,
                              letterSpacing: 1,
                            ),
                          ),
                          Text(
                            '$userRole Console',
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: const Color(0xFF6366F1),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Navigation Links
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: navItems.length,
                itemBuilder: (context, idx) {
                  final item = navItems[idx];
                  final isSelected = _selectedIndex == idx;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 6.0),
                    child: ListTile(
                      selected: isSelected,
                      selectedTileColor: const Color(0xFF6366F1).withOpacity(0.12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      leading: Icon(
                        isSelected ? item["selectedIcon"] : item["icon"],
                        color: isSelected ? const Color(0xFF45F3FF) : const Color(0xFF64748B),
                      ),
                      title: Text(
                        item["label"],
                        style: GoogleFonts.inter(
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                          fontSize: 14,
                          color: isSelected ? Colors.white : const Color(0xFF94A3B8),
                        ),
                      ),
                      onTap: () {
                        setState(() {
                          _selectedIndex = idx;
                        });
                        if (!isDesktop) {
                          Navigator.pop(context); // Close drawer on mobile
                        }
                      },
                    ),
                  );
                },
              ),
            ),

            // Footer / Profile Area
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: Colors.white10)),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: const Color(0xFF6366F1),
                    child: Text(
                      welcomeName.substring(0, 1).toUpperCase(),
                      style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          welcomeName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.white),
                        ),
                        Text(
                          userRole.toLowerCase(),
                          style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.logout, color: Color(0xFFEF4444), size: 20),
                    onPressed: () async {
                      await authService.logout();
                      if (context.mounted) {
                        Navigator.pushReplacementNamed(context, AppRoutes.login);
                      }
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: isDesktop
          ? null
          : AppBar(
              title: Text(
                navItems[_selectedIndex]["label"],
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
              iconTheme: const IconThemeData(color: Colors.white),
              backgroundColor: const Color(0xFF1E293B),
              elevation: 0,
            ),
      drawer: isDesktop ? null : Drawer(child: navDrawerContent()),
      body: Row(
        children: [
          // Sidebar for Desktop
          if (isDesktop)
            SizedBox(
              width: 260,
              child: navDrawerContent(),
            ),
          // Sidebar for Tablet (Collapsed Icons only)
          if (isTablet)
            Container(
              width: 70,
              color: const Color(0xFF1E293B),
              child: Column(
                children: [
                  const SizedBox(height: 24),
                  const Icon(Icons.shield, color: Color(0xFF45F3FF), size: 28),
                  const SizedBox(height: 32),
                  Expanded(
                    child: ListView.builder(
                      itemCount: navItems.length,
                      itemBuilder: (context, idx) {
                        final item = navItems[idx];
                        final isSelected = _selectedIndex == idx;
                        return IconButton(
                          icon: Icon(
                            isSelected ? item["selectedIcon"] : item["icon"],
                            color: isSelected ? const Color(0xFF45F3FF) : const Color(0xFF64748B),
                          ),
                          onPressed: () {
                            setState(() {
                              _selectedIndex = idx;
                            });
                          },
                        );
                      },
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.logout, color: Color(0xFFEF4444)),
                    onPressed: () async {
                      await authService.logout();
                      if (context.mounted) {
                        Navigator.pushReplacementNamed(context, AppRoutes.login);
                      }
                    },
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),

          // Main View Content Pane
          Expanded(
            child: Container(
              color: AppConstants.backgroundColor,
              padding: EdgeInsets.all(isDesktop ? 32.0 : 16.0),
              child: _getSelectedView(_selectedIndex, authService),
            ),
          ),
        ],
      ),
    );
  }
}
