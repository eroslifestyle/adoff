import 'package:flutter/material.dart';
import '../theme/adoff_theme.dart';

/// Onboarding screen — 3-5 steps as defined in AQ17.
/// Step 1: Welcome + what AdOff does
/// Step 2: VPN slot explanation (warning)
/// Step 3: DNS explanation
/// Step 4: Privacy disclosure (AdGuard DNS)
/// Step 5: Trial activation
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pageController = PageController();
  int _currentPage = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: PageView(
                controller: _pageController,
                onPageChanged: (i) => setState(() => _currentPage = i),
                children: const [
                  _WelcomeStep(),
                  _VpnSlotStep(),
                  _DnsStep(),
                  _PrivacyStep(),
                  _TrialStep(),
                ],
              ),
            ),
            _PageIndicator(current: _currentPage, total: 5),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _WelcomeStep extends StatelessWidget {
  const _WelcomeStep();
  @override
  Widget build(BuildContext context) => _StepLayout(
    emoji: '🛡️',
    title: 'Welcome to AdOff',
    subtitle: 'Block ads and trackers across all your Android apps — without a VPN app.',
    body: 'AdOff uses a local VPN to filter DNS queries and block known ad and tracker domains at the system level.',
  );
}

class _VpnSlotStep extends StatelessWidget {
  const _VpnSlotStep();
  @override
  Widget build(BuildContext context) => _StepLayout(
    emoji: '⚠️',
    title: 'One thing to know',
    subtitle: 'AdOff uses the VPN slot on your device.',
    body: 'While AdOff is active, you cannot use another VPN app (like Mullvad or NordVPN) simultaneously.\n\nTip: AdOff works alongside Private DNS — see Settings for DNS-only mode.',
    isWarning: true,
  );
}

class _DnsStep extends StatelessWidget {
  const _DnsStep();
  @override
  Widget build(BuildContext context) => _StepLayout(
    emoji: '🌐',
    title: 'How it works',
    subtitle: 'DNS-level ad blocking.',
    body: 'Every app asks the internet for website addresses via DNS. AdOff checks every request against a blocklist and blocks the bad ones — before any connection is made.',
  );
}

class _PrivacyStep extends StatelessWidget {
  const _PrivacyStep();
  @override
  Widget build(BuildContext context) => _StepLayout(
    emoji: '🔒',
    title: 'Privacy',
    subtitle: 'DNS queries are resolved by AdGuard DNS.',
    body: 'AdOff uses AdGuard\'s public DNS resolver (dns.adguard.com) to block ads. Your DNS queries are processed by AdGuard according to their privacy policy.\n\nAdOff does not log your DNS queries. See our privacy policy for details.',
  );
}

class _TrialStep extends StatelessWidget {
  const _TrialStep();
  @override
  Widget build(BuildContext context) => _StepLayout(
    emoji: '🎉',
    title: 'Start your trial',
    subtitle: '15 days of AdOff Pro — free.',
    body: 'Activate your trial to unlock:\n• Ad and tracker blocking on all apps\n• DNS-level protection\n• VPN blocking with app-level control\n\nNo credit card required.',
    showCTA: true,
    onCTAPress: () => Navigator.pushReplacementNamed(context, '/home'),
  );
}

class _StepLayout extends StatelessWidget {
  final String emoji;
  final String title;
  final String subtitle;
  final String body;
  final bool isWarning;
  final bool showCTA;
  final VoidCallback? onCTAPress;

  const _StepLayout({
    required this.emoji,
    required this.title,
    required this.subtitle,
    required this.body,
    this.isWarning = false,
    this.showCTA = false,
    this.onCTAPress,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 56)),
          const SizedBox(height: 24),
          Text(title,
            style: Theme.of(context).textTheme.headlineMedium,
            textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(subtitle,
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isWarning
                  ? Colors.orange.withOpacity(0.12)
                  : const Color(0xFF12122A),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isWarning
                    ? Colors.orange.withOpacity(0.4)
                    : const Color(0x297C5CFC),
              ),
            ),
            child: Text(body,
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center),
          ),
          if (showCTA) ...[
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: onCTAPress,
              child: const Text('Activate Trial'),
            ),
          ],
        ],
      ),
    );
  }
}

class _PageIndicator extends StatelessWidget {
  final int current;
  final int total;
  const _PageIndicator({required this.current, required this.total});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(total, (i) => Container(
          width: i == current ? 24 : 8,
          height: 8,
          margin: const EdgeInsets.symmetric(horizontal: 3),
          decoration: BoxDecoration(
            color: i == current
                ? const Color(0xFF7C5CFC)
                : const Color(0xFF8A8AAA),
            borderRadius: BorderRadius.circular(4),
          ),
        )),
      ),
    );
  }
}
