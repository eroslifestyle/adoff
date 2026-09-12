package app.adoff

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val CHANNEL = "app.adoff/vpn"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // ponytail: canale tenuto ma ogni metodo ritorna "not available" — il Flutter side cattura
        // PlatformException; rimuovere del tutto il handler farebbe lanciare MissingPluginException
        // (non catturata) in lib/services/vpn_service.dart. Il VpnService non è più dichiarato nel
        // manifest, quindi nessun metodo può fare nulla di reale.
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            result.error("UNAVAILABLE", "VPN protection is not available yet — feature removed from this build", null)
        }
    }
}
