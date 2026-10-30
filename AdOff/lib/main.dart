import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'screens/onboarding_screen.dart';
import 'screens/home_screen.dart';
import 'screens/settings_screen.dart';
import 'services/vpn_service.dart';
import 'services/license_service.dart';
import 'theme/adoff_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await LicenseService.instance.init();
  runApp(const AdOffApp());
}

class AdOffApp extends StatelessWidget {
  const AdOffApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AdOff',
      debugShowCheckedModeBanner: false,
      theme: adoffTheme,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('en'), Locale('it'), Locale('de'), Locale('fr'),
        Locale('es'), Locale('pt'), Locale('ru'), Locale('ar'),
        Locale('zh'), Locale('hi'), Locale('ja'), Locale('ko'),
        Locale('tr'), Locale('id'), Locale('pl'),
      ],
      home: LicenseService.instance.hasCompletedOnboarding
          ? const HomeScreen()
          : const OnboardingScreen(),
      routes: {
        '/home': (ctx) => const HomeScreen(),
        '/settings': (ctx) => const SettingsScreen(),
      },
    );
  }
}
