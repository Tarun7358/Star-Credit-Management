import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/supabase_service.dart';
import '../views/auth/login_page.dart';
import '../views/dashboard/responsive_dashboard.dart';
import '../views/clients/clients_list_page.dart';
import '../views/employees/employees_management.dart';
import '../views/reports/reports_view.dart';

class AppRoutes {
  static const String login = '/login';
  static const String dashboard = '/dashboard';
  static const String clients = '/clients';
  static const String employees = '/employees';
  static const String reports = '/reports';

  static Route<dynamic> generateRoute(RouteSettings settings) {
    // Route guard wrapper to protect paths
    Widget guard(Widget page, {bool requireAuth = true, List<String>? allowedRoles}) {
      return RouteGuard(
        page: page,
        requireAuth: requireAuth,
        allowedRoles: allowedRoles,
      );
    }

    switch (settings.name) {
      case login:
        return MaterialPageRoute(builder: (_) => guard(const LoginPage(), requireAuth: false));
      case dashboard:
        return MaterialPageRoute(builder: (_) => guard(const ResponsiveDashboard()));
      case clients:
        return MaterialPageRoute(builder: (_) => guard(const ClientsListPage()));
      case employees:
        return MaterialPageRoute(builder: (_) => guard(const EmployeesManagementPage(), allowedRoles: const ['OWNER']));
      case reports:
        return MaterialPageRoute(builder: (_) => guard(const ReportsView(), allowedRoles: const ['OWNER', 'MANAGER']));
      default:
        return MaterialPageRoute(
          builder: (_) => Scaffold(
            body: Center(
              child: Text('Route not defined: ${settings.name}'),
            ),
          ),
        );
    }
  }
}

class RouteGuard extends StatelessWidget {
  final Widget page;
  final bool requireAuth;
  final List<String>? allowedRoles;

  const RouteGuard({
    Key? key,
    required this.page,
    this.requireAuth = true,
    this.allowedRoles,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final authService = Provider.of<SupabaseService>(context);

    // If loading profile, show premium loading layout
    if (authService.isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFF0B0C10),
        body: Center(
          child: CircularProgressIndicator(
            color: Color(0xFF6366F1),
          ),
        ),
      );
    }

    // Auth gate check
    if (requireAuth && !authService.isAuthenticated) {
      // Redirect to login page immediately
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Navigator.of(context).pushNamedAndRemoveUntil(AppRoutes.login, (route) => false);
      });
      return const SizedBox.shrink();
    }

    // Guest gate check (e.g. login screen while already logged in)
    if (!requireAuth && authService.isAuthenticated && authService.currentUser != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Navigator.of(context).pushNamedAndRemoveUntil(AppRoutes.dashboard, (route) => false);
      });
      return const SizedBox.shrink();
    }

    // Role gate check
    if (requireAuth && allowedRoles != null && authService.currentUser != null) {
      final userRole = authService.currentUser!.role.toUpperCase();
      if (!allowedRoles!.contains(userRole)) {
        // Access Denied redirect
        WidgetsBinding.instance.addPostFrameCallback((_) {
          Navigator.of(context).pushReplacementNamed(AppRoutes.dashboard);
        });
        return const SizedBox.shrink();
      }
    }

    return page;
  }
}
