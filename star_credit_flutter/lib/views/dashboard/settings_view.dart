import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../services/supabase_service.dart';
import '../../services/biometric_service.dart';

class SettingsView extends StatefulWidget {
  const SettingsView({super.key});

  @override
  State<SettingsView> createState() => _SettingsViewState();
}

class _SettingsViewState extends State<SettingsView> {
  final _formKey = GlobalKey<FormState>();
  final _passwordFormKey = GlobalKey<FormState>();

  late TextEditingController _nameController;
  late TextEditingController _phoneController;
  late TextEditingController _deptController;
  late TextEditingController _emergencyController;
  late TextEditingController _photoController;

  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _updatingProfile = false;
  bool _updatingPassword = false;
  bool _syncing = false;

  bool _biometricEnabled = false;
  bool _checkingBiometrics = false;

  @override
  void initState() {
    super.initState();
    final auth = Provider.of<SupabaseService>(context, listen: false);
    final user = auth.currentUser;
    _nameController = TextEditingController(text: user?.fullName ?? '');
    _phoneController = TextEditingController(text: user?.phone ?? '');
    _deptController = TextEditingController(text: user?.department ?? '');
    _emergencyController = TextEditingController(text: user?.emergencyContact ?? '');
    _photoController = TextEditingController(text: user?.profilePhotoUrl ?? '');
    _loadBiometricSettings();
  }

  Future<void> _loadBiometricSettings() async {
    final bioService = Provider.of<BiometricService>(context, listen: false);
    final hasCreds = await bioService.hasSavedCredentials();
    if (mounted) {
      setState(() {
        _biometricEnabled = hasCreds;
      });
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _deptController.dispose();
    _emergencyController.dispose();
    _photoController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _updatingProfile = true);
    try {
      final auth = Provider.of<SupabaseService>(context, listen: false);
      await auth.updateProfile(
        fullName: _nameController.text.trim(),
        phone: _phoneController.text.trim(),
        department: _deptController.text.trim(),
        emergencyContact: _emergencyController.text.trim(),
        profilePhotoUrl: _photoController.text.trim(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile updated successfully!')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to update profile: $e')),
      );
    } finally {
      setState(() => _updatingProfile = false);
    }
  }

  Future<void> _savePassword() async {
    if (!_passwordFormKey.currentState!.validate()) return;
    if (_passwordController.text != _confirmPasswordController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Passwords do not match.')),
      );
      return;
    }
    setState(() => _updatingPassword = true);
    try {
      final auth = Provider.of<SupabaseService>(context, listen: false);
      await auth.changePassword(_passwordController.text);
      _passwordController.clear();
      _confirmPasswordController.clear();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password changed successfully!')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to update password: $e')),
      );
    } finally {
      setState(() => _updatingPassword = false);
    }
  }

  Future<void> _syncOffline() async {
    setState(() => _syncing = true);
    try {
      final auth = Provider.of<SupabaseService>(context, listen: false);
      final count = await auth.syncOfflineCheckouts();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Offline Sync Completed. $count visits successfully updated.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Sync failed: $e')),
      );
    } finally {
      setState(() => _syncing = false);
    }
  }

  Future<void> _showEnrollmentDialog(BiometricService bioService) async {
    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Colors.white10),
        ),
        title: Text(
          'Biometrics Not Enrolled',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        content: Text(
          'No face or fingerprint profiles are registered on this device. Please enroll biometrics in your device security settings.',
          style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF94A3B8)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(color: Colors.white70)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              await bioService.openSecuritySettings();
            },
            child: const Text('Open Settings'),
          ),
        ],
      ),
    );
  }

  Future<void> _showSetupBiometricDialog(BiometricService bioService) async {
    final passwordController = TextEditingController();
    final formKey = GlobalKey<FormState>();
    bool loading = false;

    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1E293B),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: Colors.white10),
              ),
              title: Text(
                'Verify Identity',
                style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.white),
              ),
              content: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Please enter your current account password to enable biometric quick login.',
                      style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF94A3B8)),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: passwordController,
                      obscureText: true,
                      style: const TextStyle(color: Colors.white, fontSize: 15),
                      decoration: const InputDecoration(
                        labelText: 'Password',
                        labelStyle: TextStyle(color: Color(0xFF94A3B8)),
                        hintText: 'Enter password',
                        hintStyle: TextStyle(color: Color(0xFF64748B)),
                      ),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Password is required';
                        }
                        return null;
                      },
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    Navigator.pop(context);
                  },
                  child: const Text('Cancel', style: TextStyle(color: Colors.white70)),
                ),
                loading
                    ? const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16.0),
                        child: SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF6366F1)),
                        ),
                      )
                    : ElevatedButton(
                        onPressed: () async {
                          if (!formKey.currentState!.validate()) return;
                          setDialogState(() => loading = true);
                          try {
                            final auth = Provider.of<SupabaseService>(context, listen: false);
                            final email = auth.currentUser?.email;
                            if (email == null) throw Exception("User session not found.");
                            
                            await auth.client.auth.signInWithPassword(email: email, password: passwordController.text.trim());
                            
                            await bioService.saveCredentials(email, passwordController.text.trim());
                            
                            if (context.mounted) {
                              Navigator.pop(context);
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Biometric Quick Access enabled successfully!')),
                              );
                            }
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Authentication failed: ${e.toString().replaceAll('Exception:', '').trim()}')),
                              );
                            }
                          } finally {
                            setDialogState(() => loading = false);
                          }
                        },
                        child: const Text('Enable'),
                      ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<SupabaseService>(context);
    final user = auth.currentUser;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            "Account Settings",
            style: GoogleFonts.outfit(fontSize: 26, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 18),
          
          // Profile Details Section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Profile Settings",
                      style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const Divider(height: 24),
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 36,
                          backgroundColor: Colors.black,
                          backgroundImage: _photoController.text.isNotEmpty 
                              ? NetworkImage(_photoController.text) 
                              : null,
                          child: _photoController.text.isEmpty
                              ? Text(
                                  (user?.fullName ?? 'U')[0].toUpperCase(),
                                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
                                )
                              : null,
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: TextFormField(
                            controller: _photoController,
                            decoration: const InputDecoration(labelText: "Avatar Image URL"),
                            onChanged: (val) => setState(() {}),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _nameController,
                      decoration: const InputDecoration(labelText: "Full Name"),
                      validator: (val) => val == null || val.trim().isEmpty ? "Name is required" : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _phoneController,
                      decoration: const InputDecoration(labelText: "Phone Number"),
                      validator: (val) => val == null || val.trim().isEmpty ? "Phone number is required" : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _emergencyController,
                      decoration: const InputDecoration(labelText: "Emergency Contact"),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _deptController,
                      decoration: const InputDecoration(labelText: "Department"),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _updatingProfile ? null : _saveProfile,
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: _updatingProfile
                            ? const CircularProgressIndicator(color: Colors.white)
                            : Text("Save Profile Changes", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Security & Password section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Form(
                key: _passwordFormKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Security Settings",
                      style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const Divider(height: 24),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: "New Password"),
                      validator: (val) => val == null || val.length < 6 ? "Password must be at least 6 characters" : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _confirmPasswordController,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: "Confirm New Password"),
                      validator: (val) => val == null || val.length < 6 ? "Confirm password is required" : null,
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _updatingPassword ? null : _savePassword,
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: _updatingPassword
                            ? const CircularProgressIndicator(color: Colors.white)
                            : Text("Update Password", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
                      ),
                    ),
                    const Divider(height: 32),
                    Text(
                      "Biometric Authentication",
                      style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    SwitchListTile(
                      title: Text(
                        "Biometric Quick Access",
                        style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
                      ),
                      subtitle: Text(
                        "Enable face or fingerprint recognition for quick console entry.",
                        style: GoogleFonts.inter(fontSize: 12, color: Colors.grey.shade600),
                      ),
                      value: _biometricEnabled,
                      contentPadding: EdgeInsets.zero,
                      onChanged: _checkingBiometrics
                          ? null
                          : (bool value) async {
                              final bioService = Provider.of<BiometricService>(context, listen: false);
                              if (value) {
                                setState(() => _checkingBiometrics = true);
                                try {
                                  final hasHardware = await bioService.canCheckBiometrics;
                                  if (!hasHardware) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Biometric hardware is not available on this device.')),
                                    );
                                    return;
                                  }

                                  final enrolled = await bioService.isEnrolled;
                                  if (!enrolled) {
                                    _showEnrollmentDialog(bioService);
                                    return;
                                  }

                                  await _showSetupBiometricDialog(bioService);
                                } catch (e) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Setup failed: $e')),
                                  );
                                } finally {
                                  setState(() => _checkingBiometrics = false);
                                  _loadBiometricSettings();
                                }
                              } else {
                                await bioService.clearSavedCredentials();
                                _loadBiometricSettings();
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Biometric Quick Access disabled.')),
                                );
                              }
                            },
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Offline Operations
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Offline Caching Operations",
                    style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const Divider(height: 24),
                  Text(
                    "If checkout logs fail to submit due to poor cellular coverage, the system caches them locally. Click the button below to upload any pending historical visit checkouts.",
                    style: GoogleFonts.inter(fontSize: 13, color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _syncing ? null : _syncOffline,
                      icon: const Icon(Icons.sync),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      label: _syncing
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text("Sync Offline Checkouts Now", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 30),
        ],
      ),
    );
  }
}
