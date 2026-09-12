package app.adoff

import android.content.Intent
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val CHANNEL = "app.adoff/vpn"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "startVpn" -> {
                    // ponytail: VPN forwarding non implementato — errore esplicito al chiamante, il servizio non parte
                    result.error("EXPERIMENTAL", "VPN protection is experimental and not yet functional", null)
                }
                "stopVpn" -> {
                    val intent = Intent(this, VpnService::class.java).apply {
                        action = VpnService.ACTION_STOP
                    }
                    startService(intent)
                    result.success(null)
                }
                "getStatus" -> {
                    result.success(VpnService.getInstance() != null)
                }
                "getBlockedCount" -> {
                    result.success(VpnService.blockedQueries)
                }
                else -> result.notImplemented()
            }
        }
    }
}
