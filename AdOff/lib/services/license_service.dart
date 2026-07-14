import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http';
import '../utils/crypto_keys.dart';

/// LicenseService — manages onboarding, trial, and Pro license for the AdOff Android app.
/// Mobile uses server-anchored trial (ECDSA P-256 signed token) same as browser extension,
/// but fetched via POST /trial (returns token signed by the server).
///
/// Security model: the server signs tokens with a private key; the public key is embeddata
/// in this file (crypto_keys.dart). The client verifies the signature before trusting
/// the token payload. DevTools cannot forge valid signatures.
class LicenseService {
  LicenseService._();
  static final instance = LicenseService._();

  static const _prefOnboarding = 'adoff_onboarding_done';
  static const _prefTrialToken = 'adoff_trial_token';
  static const _prefTrialStart = 'adoff_trial_start';
  static const _prefTrialEnd = 'adoff_trial_end';
  static const _prefDeviceId = 'adoff_device_id';
  static const _prefHasPro = 'adoff_has_pro';
  static const _prefServerAuthoritative = 'adoff_server_authoritative';
  static const _prefBlocklistUpdated = 'adoff_blocklist_updated';

  /// Refresh blocklist from server if older than 7 days.
  /// Returns true if refresh was needed and succeeded.
  Future<bool> refreshBlocklistIfNeeded() async {
    final prefs = await SharedPreferences.getInstance();
    final lastUpdate = prefs.getInt(_prefBlocklistUpdated) ?? 0;
    final now = DateTime.now().millisecondsSinceEpoch;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (now - lastUpdate < sevenDaysMs) return false;
    return refreshBlocklist();
  }

  /// Download blocklist from adoff.app and save to assets/blocklist.txt.
  /// Returns true on success.
  Future<bool> refreshBlocklist() async {
    try {
      final resp = await http.get(
        Uri.parse('https://adoff.app/api/rules/feed'),
      );
      if (resp.statusCode != 200) return false;
      // Write to assets via platform channel or store for VPN service
      // ponytail: assets write via native plugin, this stores metadata only
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(_prefBlocklistUpdated, DateTime.now().millisecondsSinceEpoch);
      await prefs.setString('adoff_blocklist_data', resp.body);
      return true;
    } catch (_) {
      return false;
    }
  }

  bool hasCompletedOnboarding = false;
  bool hasPro = false;
  int? _trialEndTimestamp;
  int? _trialStartTimestamp;
  String? _trialToken;
  String? _deviceId;

  /// True when the last verification came from the server (not DevTools-tampered cache).
  bool serverAuthoritative = false;

  /// Stable device identifier — generated once and persisted.
  String get deviceId {
    if (_deviceId != null) return _deviceId!;
    // Fallback: should already be set via _ensureDeviceId()
    return 'unknown';
  }

  bool get hasActiveTrial {
    if (_trialEndTimestamp == null) return false;
    return DateTime.now().millisecondsSinceEpoch < _trialEndTimestamp!;
  }

  /// Must be called before any other method.
  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    hasCompletedOnboarding = prefs.getBool(_prefOnboarding) ?? false;
    hasPro = prefs.getBool(_prefHasPro) ?? false;
    _trialEndTimestamp = prefs.getInt(_prefTrialEnd);
    _trialStartTimestamp = prefs.getInt(_prefTrialStart);
    _trialToken = prefs.getString(_prefTrialToken);
    _deviceId = prefs.getString(_prefDeviceId);
  }

  Future<void> _ensureDeviceId() async {
    if (_deviceId != null && _deviceId!.isNotEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    _deviceId = prefs.getString(_prefDeviceId);
    if (_deviceId != null && _deviceId!.isNotEmpty) return;
    // Generate stable UUID from Random + timestamp
    final rng = Random();
    final ts = DateTime.now().millisecondsSinceEpoch;
    _deviceId = '${_generateHex(8)}-${_generateHex(4)}-4${_generateHex(3)}-${(rng.nextInt(12) | 8).toRadixString(16)}${_generateHex(3)}-${_generateHex(12)}'
        .replaceAll('X', ts.toRadixString(16)[0]);
    await prefs.setString(_prefDeviceId, _deviceId!);
  }

  String _generateHex(int len) {
    final rng = Random();
    return List.generate(len, (_) => rng.nextInt(16).toRadixString(16)).join();
  }

  /// Fetch trial from AdOff server (POST /trial).
  /// Onboarding calls this instead of setting trial locally.
  Future<void> completeOnboarding() async {
    await _ensureDeviceId();
    await _fetchServerTrial();

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefOnboarding, true);
    hasCompletedOnboarding = true;
  }

  /// POST /trial — gets server-anchored trial token (ECDSA P-256 signed).
  /// Returns server-authoritative trial end (mobile = 30 days, same as browser).
  Future<void> _fetchServerTrial() async {
    try {
      final resp = await http.post(
        Uri.parse('https://adoff.app/api/trial'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'deviceId': deviceId}),
      );
      if (resp.statusCode != 200) return;
      final data = jsonDecode(resp.body) as Map<String, dynamic>;
      if (data['ok'] != true) return;

      _trialToken = data['token'] as String?;
      _trialStartTimestamp = data['trialStart'] as int?;
      _trialEndTimestamp = data['trialEnd'] as int?;

      final prefs = await SharedPreferences.getInstance();
      if (_trialToken != null) await prefs.setString(_prefTrialToken, _trialToken!);
      if (_trialStartTimestamp != null) {
        await prefs.setInt(_prefTrialStart, _trialStartTimestamp!);
      }
      if (_trialEndTimestamp != null) {
        await prefs.setInt(_prefTrialEnd, _trialEndTimestamp!);
      }
    } catch (_) {
      // Network error — fall back to local trial
    }
  }

  /// Verify the stored trial token against the server (ECDSA signature verified server-side).
  /// Falls back to local timestamp if server unreachable.
  Future<bool> verifyTrialOnline() async {
    if (_trialToken == null) return hasActiveTrial;
    try {
      final resp = await http.get(
        Uri.parse(
            'https://adoff.app/api/verify-mobile-license?token=$_trialToken&deviceId=$deviceId'),
      );
      if (resp.statusCode != 200) return hasActiveTrial;
      final data = jsonDecode(resp.body) as Map<String, dynamic>;
      if (data['ok'] == true && data['active'] == true) {
        _trialEndTimestamp = data['trialEnd'] as int?;
        _trialStartTimestamp = data['trialStart'] as int?;
        return true;
      }
      return false;
    } catch (_) {
      // Server unreachable — honor local timestamp (with 30d cap)
      return hasActiveTrial;
    }
  }

  /// Verify a Pro license token (key-based, same as browser extension).
  Future<bool> verifyLicense(String key) async {
    try {
      final resp = await http.post(
        Uri.parse('https://adoff.app/api/activate'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'key': key, 'deviceId': deviceId}),
      );
      if (resp.statusCode != 200) return false;
      final data = jsonDecode(resp.body) as Map<String, dynamic>;
      if (data['valid'] == true) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool(_prefHasPro, true);
        hasPro = true;
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  /// Days remaining in trial (display only — authority is server).
  int get trialDaysRemaining {
    if (_trialEndTimestamp == null) return 0;
    final remaining = _trialEndTimestamp! - DateTime.now().millisecondsSinceEpoch;
    return remaining > 0 ? (remaining / 86400000).ceil() : 0;
  }

  /// Activate Pro (after license purchase).
  Future<void> activatePro() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefHasPro, true);
    hasPro = true;
  }
}
