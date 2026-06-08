import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../services/supabase_service.dart';

class SettingsView extends StatefulWidget {
  const SettingsView({Key? key}) : super(key: key);

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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile updated successfully!')),
      );
    } catch (e) {
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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password changed successfully!')),
      );
    } catch (e) {
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Offline Sync Completed. $count visits successfully updated.')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Sync failed: $e')),
      );
    } finally {
      setState(() => _syncing = false);
    }
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
                    ElevatedButton(
                      onPressed: _updatingProfile ? null : _saveProfile,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.black,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: _updatingProfile
                          ? const CircularProgressIndicator(color: Colors.white)
                          : Text("Save Profile Changes", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
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
                    ElevatedButton(
                      onPressed: _updatingPassword ? null : _savePassword,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.black,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: _updatingPassword
                          ? const CircularProgressIndicator(color: Colors.white)
                          : Text("Update Password", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
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
                  ElevatedButton.icon(
                    onPressed: _syncing ? null : _syncOffline,
                    icon: const Icon(Icons.sync),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      side: const BorderSide(color: Colors.black26),
                    ),
                    label: _syncing
                        ? const CircularProgressIndicator(color: Colors.black)
                        : Text("Sync Offline Checkouts Now", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
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
