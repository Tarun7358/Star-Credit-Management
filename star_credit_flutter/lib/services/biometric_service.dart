import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

class BiometricService {
  final LocalAuthentication _auth = LocalAuthentication();
  bool _isSettingsEnabled = false; // Toggle state stored locally

  bool get isSettingsEnabled => _isSettingsEnabled;

  void toggleSettings(bool value) {
    _isSettingsEnabled = value;
  }

  /// Checks if device supports biometric hardware
  Future<bool> get canCheckBiometrics async {
    try {
      final bool canAuthenticateWithBiometrics = await _auth.canCheckBiometrics;
      final bool isDeviceSupported = await _auth.isDeviceSupported();
      return canAuthenticateWithBiometrics && isDeviceSupported;
    } catch (e) {
      return false;
    }
  }

  /// Triggers biometric authentication dialog on device
  Future<bool> authenticate({String reason = 'Authenticate to access Star Credit CRM'}) async {
    try {
      if (!await canCheckBiometrics) return false;
      
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );
    } catch (e) {
      return false;
    }
  }

  // Credentials management for passkey-style biometric login
  static const String _keyEmail = 'biometric_email';
  static const String _keyPassword = 'biometric_password';
  static const String _keyEnabled = 'biometric_enabled';

  Future<bool> hasSavedCredentials() async {
    final prefs = await SharedPreferences.getInstance();
    final email = prefs.getString(_keyEmail);
    final password = prefs.getString(_keyPassword);
    final enabled = prefs.getBool(_keyEnabled) ?? false;
    return enabled && email != null && email.isNotEmpty && password != null && password.isNotEmpty;
  }

  Future<void> saveCredentials(String email, String password) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyEmail, email);
    await prefs.setString(_keyPassword, password);
    await prefs.setBool(_keyEnabled, true);
    _isSettingsEnabled = true;
  }

  Future<Map<String, String>?> getSavedCredentials() async {
    final prefs = await SharedPreferences.getInstance();
    final email = prefs.getString(_keyEmail);
    final password = prefs.getString(_keyPassword);
    if (email != null && password != null) {
      return {'email': email, 'password': password};
    }
    return null;
  }

  Future<void> clearSavedCredentials() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyEmail);
    await prefs.remove(_keyPassword);
    await prefs.setBool(_keyEnabled, false);
    _isSettingsEnabled = false;
  }
}
