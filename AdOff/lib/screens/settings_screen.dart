import 'package:flutter/material.dart';
import '../theme/adoff_theme.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          const _SettingsSection(title: 'Protection'),
          _SettingsTile(
            icon: Icons.vpn_lock,
            title: 'VPN Mode',
            subtitle: 'Full ad blocking — uses VPN slot',
            trailing: Switch(
              value: true,
              onChanged: (v) {},
              activeColor: const Color(0xFF7C5CFC),
            ),
          ),
          _SettingsTile(
            icon: Icons.dns,
            title: 'DNS-only Mode',
            subtitle: 'Works alongside other VPNs',
            trailing: const Icon(Icons.arrow_forward_ios, size: 16),
            onTap: () {},
          ),
          const Divider(),
          const _SettingsSection(title: 'MITM Filtering'),
          _SettingsTile(
            icon: Icons.https,
            title: 'HTTPS Filtering',
            subtitle: 'Enable for browser apps',
            trailing: Switch(
              value: false,
              onChanged: (v) {},
              activeColor: const Color(0xFF7C5CFC),
            ),
          ),
          _SettingsTile(
            icon: Icons.language,
            title: 'Browser list',
            subtitle: 'Select which browsers use MITM',
            trailing: const Icon(Icons.arrow_forward_ios, size: 16),
            onTap: () {},
          ),
          const Divider(),
          const _SettingsSection(title: 'License'),
          _SettingsTile(
            icon: Icons.star,
            title: 'Pro Trial',
            subtitle: '15 days remaining',
            trailing: const Icon(Icons.arrow_forward_ios, size: 16),
            onTap: () {},
          ),
          _SettingsTile(
            icon: Icons.info_outline,
            title: 'About AdOff',
            subtitle: 'Version 1.0.0',
          ),
        ],
      ),
    );
  }
}

class _SettingsSection extends StatelessWidget {
  final String title;
  const _SettingsSection({required this.title});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
    child: Text(
      title.toUpperCase(),
      style: TextStyle(
        color: const Color(0xFF7C5CFC),
        fontSize: 12,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.2,
      ),
    ),
  );
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) => ListTile(
    leading: Icon(icon, color: const Color(0xFF8A8AAA)),
    title: Text(title),
    subtitle: Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
    trailing: trailing,
    onTap: onTap,
  );
}
