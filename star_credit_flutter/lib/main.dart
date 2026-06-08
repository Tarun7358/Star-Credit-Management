import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'config/constants.dart';
import 'theme/app_theme.dart';
import 'routes/app_routes.dart';
import 'services/supabase_service.dart';
import 'services/excel_service.dart';
import 'services/biometric_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Supabase Client
  await Supabase.initialize(
    url: AppConstants.supabaseUrl,
    anonKey: AppConstants.supabaseAnonKey,
  );

  runApp(const StarCreditApp());
}

class StarCreditApp extends StatelessWidget {
  const StarCreditApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<SupabaseService>(
          create: (_) => SupabaseService(),
        ),
        Provider<ExcelService>(
          create: (_) => ExcelService(),
        ),
        Provider<BiometricService>(
          create: (_) => BiometricService(),
        ),
      ],
      child: Consumer<SupabaseService>(
        builder: (context, authService, _) {
          return MaterialApp(
            title: 'Star Credit Management',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: ThemeMode.system,
            initialRoute: authService.isAuthenticated ? AppRoutes.dashboard : AppRoutes.login,
            onGenerateRoute: AppRoutes.generateRoute,
          );
        },
      ),
    );
  }
}
