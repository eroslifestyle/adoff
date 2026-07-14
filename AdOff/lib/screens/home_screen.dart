import 'dart:async';
import 'package:flutter/material.dart';
import '../services/vpn_service.dart';
import '../services/license_service.dart';
import '../theme/adoff_theme.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _vpnRunning = false;
  int _blockedQueries = 0;
  StreamSubscription<int>? _blockedSub;

  @override
  void initState() {
    super.initState();
    _checkVpnStatus();
    _blockedSub = VpnServiceManager.instance.blockedStream.listen((count) {
      if (mounted) setState(() => _blockedQueries = count);
    });
  }

  @override
  void dispose() {
    _blockedSub?.cancel();
    super.dispose();
  }

  Future<void> _checkVpnStatus() async {
    final running = await VpnServiceManager.instance.checkStatus();
    if (mounted) setState(() => _vpnRunning = running);
  }

  Future<void> _toggleVpn(bool value) async {
    if (value) {
      await VpnServiceManager.instance.start();
    } else {
      await VpnServiceManager.instance.stop();
    }
    await _checkVpnStatus();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Icon(Icons.shield, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 8),
            const Text('AdOff'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.pushNamed(context, '/settings'),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            // Status card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    Icon(
                      _vpnRunning ? Icons.shield : Icons.shield_outlined,
                      size: 64,
                      color: _vpnRunning
                          ? const Color(0xFF4ADE80)
                          : const Color(0xFF8A8AAA),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      _vpnRunning ? 'Protected' : 'Not active',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _vpnRunning
                          ? 'All apps are protected'
                          : 'Enable protection to block ads',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 24),
                    // Stats
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        _StatItem(
                          label: 'Blocked',
                          value: _blockedQueries.toString(),
                        ),
                        _StatItem(
                          label: 'Trial days',
                          value: LicenseService.instance.trialDaysRemaining.toString(),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            // VPN toggle card
            Card(
              child: SwitchListTile(
                secondary: Icon(
                  Icons.vpn_lock,
                  color: Theme.of(context).colorScheme.primary,
                ),
                title: const Text('VPN Protection'),
                subtitle: Text(_vpnRunning ? 'Active' : 'Inactive'),
                value: _vpnRunning,
                onChanged: _toggleVpn,
              ),
            ),
            const SizedBox(height: 16),
            // DNS-only mode
            Card(
              child: ListTile(
                leading: const Icon(Icons.dns, color: Color(0xFF8A8AAA)),
                title: const Text('DNS-only mode'),
                subtitle: const Text('Works alongside other VPNs'),
                trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                onTap: () {
                  showDialog(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('DNS-only mode'),
                      content: const Text(
                        'To use DNS-only mode without the VPN:\n\n'
                        '1. Open Settings → Network & Internet → Private DNS\n'
                        '2. Select "Private DNS provider hostname"\n'
                        '3. Enter: dns.adguard.com\n\n'
                        'This works alongside any VPN app.',
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text('Got it'),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            const Spacer(),
            // Trial info
            if (!LicenseService.instance.hasActiveTrial)
              Card(
                color: const Color(0xFF1A1A36),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      const Icon(Icons.star, color: Color(0xFFB8A9FF)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Start your trial',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '15 days Pro — no credit card',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      ),
                      ElevatedButton(
                        onPressed: () async {
                          await LicenseService.instance.completeOnboarding();
                          if (mounted) setState(() {});
                        },
                        child: const Text('Activate'),
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
}

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  const _StatItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            color: Color(0xFF7C5CFC),
            fontWeight: FontWeight.w800,
            fontSize: 22,
          ),
        ),
        const SizedBox(height: 4),
        Text(label, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}
