import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

class LicenseService {
  LicenseService._();
  static final instance = LicenseService._();

  static const _prefOnboarding = 'adoff_onboarding_done';
  static const _prefTrialEnd = 'adoff_trial_end';

  bool hasCompletedOnboarding = false;
  int? _trialEndTimestamp;

  bool get hasActiveTrial {
    if (_trialEndTimestamp == null) return false;
    return DateTime.now().millisecondsSinceEpoch < _trialEndTimestamp!;
  }

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    hasCompletedOnboarding = prefs.getBool(_prefOnboarding) ?? false;
    _trialEndTimestamp = prefs.getInt(_prefTrialEnd);
  }

  Future<void> completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefOnboarding, true);
    // Start 15-day trial
    final trialEnd = DateTime.now().add(const Duration(days: 15)).millisecondsSinceEpoch;
    await prefs.setInt(_prefTrialEnd, trialEnd);
    _trialEndTimestamp = trialEnd;
    hasCompletedOnboarding = true;
  }

  /// Verify license token via AdOff worker (same as browser extension).
  Future<bool> verifyLicense(String token) async {
    try {
      final resp = await http.get(
        Uri.parse('https://adoff.app/api/verify-license?token=$token'),
      );
      return resp.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  int get trialDaysRemaining {
    if (_trialEndTimestamp == null) return 0;
    final remaining = _trialEndTimestamp! - DateTime.now().millisecondsSinceEpoch;
    return remaining > 0 ? (remaining / 86400000).ceil() : 0;
  }
}
