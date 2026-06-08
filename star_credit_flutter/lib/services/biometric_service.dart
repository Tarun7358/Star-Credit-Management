import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class BiometricService {
  final LocalAuthentication _auth = LocalAuthentication();
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  
  static const _channel = MethodChannel('com.starcreditmanagement.app/settings');
  
  bool _isSettingsEnabled = false; // Toggle state loaded from shared preferences/secure storage

  bool get isSettingsEnabled => _isSettingsEnabled;

  BiometricService() {
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    _isSettingsEnabled = prefs.getBool(_keyEnabled) ?? false;
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

  /// Checks if biometrics are enrolled on the device
  Future<bool> get isEnrolled async {
    try {
      if (!await canCheckBiometrics) return false;
      final List<BiometricType> availableBiometrics = await _auth.getAvailableBiometrics();
      return availableBiometrics.isNotEmpty;
    } catch (e) {
      return false;
    }
  }

  /// Opens native Android security settings so user can enroll biometrics
  Future<void> openSecuritySettings() async {
    try {
      await _channel.invokeMethod('openSecuritySettings');
    } on PlatformException catch (e) {
      print("Failed to open security settings: '${e.message}'.");
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

  // Credentials management for passkey-style biometric login using secure storage
  static const String _keyEmail = 'biometric_email';
  static const String _keyPassword = 'biometric_password';
  static const String _keyEnabled = 'biometric_enabled';

  Future<bool> hasSavedCredentials() async {
    final prefs = await SharedPreferences.getInstance();
    final enabled = prefs.getBool(_keyEnabled) ?? false;
    if (!enabled) return false;
    
    final email = await _secureStorage.read(key: _keyEmail);
    final password = await _secureStorage.read(key: _keyPassword);
    return email != null && email.isNotEmpty && password != null && password.isNotEmpty;
  }

  Future<void> saveCredentials(String email, String password) async {
    // Save settings switch in SharedPreferences
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyEnabled, true);
    _isSettingsEnabled = true;

    // Save actual credentials in FlutterSecureStorage
    await _secureStorage.write(key: _keyEmail, value: email);
    await _secureStorage.write(key: _keyPassword, value: password);
  }

  Future<Map<String, String>?> getSavedCredentials() async {
    final email = await _secureStorage.read(key: _keyEmail);
    final password = await _secureStorage.read(key: _keyPassword);
    if (email != null && password != null) {
      return {'email': email, 'password': password};
    }
    return null;
  }

  Future<void> clearSavedCredentials() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyEnabled, false);
    _isSettingsEnabled = false;

    // Delete credentials from FlutterSecureStorage
    await _secureStorage.delete(key: _keyEmail);
    await _secureStorage.delete(key: _keyPassword);
  }
}
