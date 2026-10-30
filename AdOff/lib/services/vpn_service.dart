import 'dart:async';
import 'package:flutter/services.dart';

/// Flutter bridge to native Android VpnService.
/// Communicates via MethodChannel "app.adoff/vpn".
/// The native Kotlin code handles:
/// - VPN interface creation
/// - DNS packet interception
/// - Blocklist matching
/// - Upstream DNS forwarding
class VpnServiceManager {
  VpnServiceManager._();
  static final instance = VpnServiceManager._();

  static const _channel = MethodChannel('app.adoff/vpn');

  bool _isRunning = false;
  bool get isRunning => _isRunning;

  // Stats
  int _blockedQueries = 0;
  int get blockedQueries => _blockedQueries;

  // Stats update stream
  final _blockedController = StreamController<int>.broadcast();
  Stream<int> get blockedStream => _blockedController.stream;

  /// Start the VPN. Returns true if started successfully.
  Future<bool> start() async {
    try {
      final result = await _channel.invokeMethod<bool>('startVpn');
      _isRunning = result ?? false;
      // Listen for stats from native
      _channel.setMethodCallHandler(_handleNativeCall);
      return _isRunning;
    } on PlatformException catch (e) {
      print('VpnService.start failed: ${e.message}');
      return false;
    }
  }

  /// Stop the VPN.
  Future<void> stop() async {
    try {
      await _channel.invokeMethod('stopVpn');
      _isRunning = false;
    } on PlatformException catch (e) {
      print('VpnService.stop failed: ${e.message}');
    }
  }

  /// Check if VPN is currently running.
  Future<bool> checkStatus() async {
    try {
      final result = await _channel.invokeMethod<bool>('getStatus');
      _isRunning = result ?? false;
      return _isRunning;
    } on PlatformException {
      return false;
    }
  }

  Future<void> _handleNativeCall(MethodCall call) async {
    switch (call.method) {
      case 'onQueryBlocked':
        _blockedQueries++;
        _blockedController.add(_blockedQueries);
        break;
      case 'onVpnStarted':
        _isRunning = true;
        break;
      case 'onVpnStopped':
        _isRunning = false;
        _blockedQueries = 0;
        break;
    }
  }

  void dispose() {
    _blockedController.close();
  }
}
