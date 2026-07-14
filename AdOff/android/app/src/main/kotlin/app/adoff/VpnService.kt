package app.adoff

import android.content.*
import android.net.*
import android.os.*
import android.util.*
import java.io.*
import java.net.*
import java.nio.*
import java.util.*
import kotlinx.coroutines.*
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import androidx.core.app.NotificationCompat

/**
 * AdOff VPN Service — DNS-level ad blocking via local VPN.
 *
 * How it works:
 * 1. Creates a VPN interface that intercepts all device traffic
 * 2. Forwards DNS queries (UDP port 53) to our DNS interceptor thread
 * 3. Checks domain against blocklist
 * 4. Returns NXDOMAIN for blocked domains, forwards to upstream DNS otherwise
 * 5. Non-DNS traffic is forwarded directly to the internet (no MITM)
 *
 * Reference: Android VpnService documentation + blockads-android open source.
 */
class VpnService : android.net.VpnService() {

    companion object {
        const val CHANNEL_ID = "adoff_vpn_channel"
        const val NOTIFICATION_ID = 1
        const val ACTION_START = "app.adoff.action.START"
        const val ACTION_STOP = "app.adoff.action.STOP"

        private var instance: VpnService? = null
        fun getInstance(): VpnService? = instance

        // Stats
        var blockedQueries = 0
            private set
    }

    private var vpnThread: Thread? = null
    private var vpnInterface: ParcelFileDescriptor? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // Blocklist — loaded from assets
    private val blocklist = mutableSetOf<String>()

    // Upstream DNS (Cloudflare)
    private val upstreamDns = "1.1.1.1"
    private val upstreamDnsPort = 53

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
        loadBlocklist()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopVpn()
                return START_NOT_STICKY
            }
            ACTION_START, null -> {
                if (vpnInterface == null) {
                    startForeground(NOTIFICATION_ID, buildNotification("AdOff is protecting your device"))
                    startVpn()
                }
                return START_STICKY
            }
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        stopVpn()
        scope.cancel()
        instance = null
        super.onDestroy()
    }

    override fun onRevoke() {
        stopVpn()
        super.onRevoke()
    }

    private fun startVpn() {
        val builder = Builder()
            .setSession("AdOff")
            .setMtu(1500)
            .addAddress("10.0.0.2", 32)
            .addDnsServer(upstreamDns)
            .addRoute("0.0.0.0", 0)
            .setBlocking(true)

        // Exclude our own traffic to prevent loops
        try {
            builder.addDisallowedApplication(packageName)
        } catch (e: Exception) {
            // May fail in some Android versions
        }

        vpnInterface = builder.establish()

        if (vpnInterface == null) {
            Log.e("AdOffVPN", "Failed to establish VPN interface")
            stopSelf()
            return
        }

        vpnThread = Thread {
            try {
                runDnsInterceptor()
            } catch (e: Exception) {
                Log.e("AdOffVPN", "VPN thread error: ${e.message}")
            }
        }.apply { name = "AdOffVPNThread"; start() }
    }

    private fun stopVpn() {
        vpnThread?.interrupt()
        vpnThread = null
        try {
            vpnInterface?.close()
        } catch (e: Exception) {
            // Ignore
        }
        vpnInterface = null
        blockedQueries = 0
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    /**
     * Main DNS interceptor loop.
     * Reads packets from VPN TUN interface, handles DNS queries, forwards rest.
     */
    private fun runDnsInterceptor() {
        val fd = vpnInterface ?: return
        val pipe = FileInputStream(fd.fileDescriptor)
        val out = FileOutputStream(fd.fileDescriptor)
        val packet = ByteArray(32767)

        val datagramPacket = DatagramPacket(packet, packet.size)

        while (!Thread.currentThread().isInterrupted) {
            try {
                // Read packet from VPN interface
                val length = pipe.read(packet)
                if (length <= 0) continue

                val version = (packet[0].toInt() shr 4) and 0xF
                if (version != 4) continue // Only IPv4

                val protocol = packet[9].toInt() and 0xFF
                if (protocol != 17) continue // Only UDP

                // Parse IP header (20 bytes) to get UDP + payload
                val ipHeaderLen = (packet[0].toInt() and 0xF) * 4
                val udpSrcPort = ((packet[ipHeaderLen].toInt() and 0xFF) shl 8) or (packet[ipHeaderLen + 1].toInt() and 0xFF)
                val udpDstPort = ((packet[ipHeaderLen + 2].toInt() and 0xFF) shl 8) or (packet[ipHeaderLen + 3].toInt() and 0xFF)

                // Only intercept DNS queries (port 53)
                if (udpDstPort != 53) {
                    // Forward non-DNS packets directly
                    out.write(packet, 0, length)
                    continue
                }

                // Extract DNS query
                val dnsPayloadOffset = ipHeaderLen + 8 // UDP header = 8 bytes
                if (dnsPayloadOffset >= length) continue

                val dnsPayload = packet.copyOfRange(dnsPayloadOffset, length)
                val domain = parseDnsQuery(dnsPayload)

                if (domain != null && isBlocked(domain)) {
                    // Blocked — send NXDOMAIN response
                    blockedQueries++
                    val response = buildNxdomainResponse(dnsPayload)
                    val responsePacket = buildDnsResponsePacket(packet, ipHeaderLen, udpSrcPort, response)
                    out.write(responsePacket, 0, responsePacket.size)
                    Log.d("AdOffVPN", "BLOCKED: $domain (total: $blockedQueries)")
                } else {
                    // Forward to upstream DNS
                    val response = forwardDnsQuery(dnsPayload)
                    if (response != null) {
                        val responsePacket = buildDnsResponsePacket(packet, ipHeaderLen, udpSrcPort, response)
                        out.write(responsePacket, 0, responsePacket.size)
                    }
                }
            } catch (e: InterruptedException) {
                break
            } catch (e: Exception) {
                Log.e("AdOffVPN", "Error: ${e.message}")
            }
        }
    }

    /**
     * Parse domain name from DNS query payload.
     */
    private fun parseDnsQuery(payload: ByteArray): String? {
        try {
            if (payload.size < 13) return null
            // Skip DNS header (12 bytes) — question starts at offset 12
            var offset = 12
            val sb = StringBuilder()
            while (offset < payload.size) {
                val labelLen = payload[offset].toInt() and 0xFF
                if (labelLen == 0) break
                if (labelLen >= 0xC0) {
                    // Compression pointer — not fully handling here
                    break
                }
                if (sb.isNotEmpty()) sb.append('.')
                offset++
                for (i in 0 until labelLen) {
                    sb.append((payload[offset + i].toInt() and 0xFF).toChar())
                }
                offset += labelLen
            }
            return sb.toString().lowercase(Locale.ROOT)
        } catch (e: Exception) {
            return null
        }
    }

    private fun isBlocked(domain: String): Boolean {
        // Check exact match
        if (blocklist.contains(domain)) return true
        // Check parent domains (adserver.com blocks foo.adserver.com)
        var parent = domain
        while (parent.contains('.')) {
            parent = parent.substringAfter('.')
            if (blocklist.contains(parent)) return true
        }
        return false
    }

    /**
     * Build NXDOMAIN response (DNS response with rcode=3 = NXDOMAIN).
     */
    private fun buildNxdomainResponse(query: ByteArray): ByteArray {
        if (query.size < 2) return ByteArray(0)
        val response = query.copyOf()
        // Set QR bit (1), RA bit (1), RCODE=3 (NXDOMAIN)
        // Byte 2: set QR=1 (0x80)
        response[2] = (response[2].toInt() or 0x80).toByte()
        // Byte 3: keep RA, set RCODE=3 (0x03)
        response[3] = ((response[3].toInt() and 0xF0) or 0x03).toByte()
        return response
    }

    /**
     * Forward DNS query to upstream and return response.
     */
    private fun forwardDnsQuery(query: ByteArray): ByteArray? {
        return try {
            val socket = DatagramSocket()
            socket.soTimeout = 3000
            val packet = DatagramPacket(query, query.size)
            packet.address = InetAddress.getByName(upstreamDns)
            packet.port = upstreamDnsPort
            socket.send(packet)
            val responseBuf = ByteArray(512)
            val responsePacket = DatagramPacket(responseBuf, responseBuf.size)
            socket.receive(responsePacket)
            val response = responseBuf.copyOf(responsePacket.length)
            socket.close()
            response
        } catch (e: Exception) {
            Log.e("AdOffVPN", "DNS forward error: ${e.message}")
            null
        }
    }

    /**
     * Build IPv4/UDP response packet from original query packet.
     */
    private fun buildDnsResponsePacket(
        original: ByteArray, ipHeaderLen: Int, srcPort: Int, dnsPayload: ByteArray
    ): ByteArray {
        val udpLen = 8 + dnsPayload.size
        val totalLen = ipHeaderLen + udpLen

        val response = ByteBuffer.allocate(totalLen)

        // IPv4 Header
        response.put(0x45.toByte()) // Version + IHL
        response.put(0x00.toByte()) // DSCP + ECN
        response.putShort(totalLen.toShort()) // Total length
        response.putShort(0) // ID
        response.putShort(0x4000.toShort()) // Flags + Fragment offset
        response.put(64.toByte()) // TTL
        response.put(17.toByte()) // Protocol (UDP)
        response.putShort(0) // Checksum (0 = not computed)

        // Swap src/dst IPs
        response.put(original, 16, 4) // src = original dst IP
        response.put(original, 12, 4) // dst = original src IP

        // UDP Header
        response.putShort(srcPort.toShort()) // Src port = original dst
        response.putShort(53) // Dst port = 53
        response.putShort(udpLen.toShort()) // UDP length
        response.putShort(0) // UDP checksum (0 = not computed)

        // DNS payload
        response.put(dnsPayload)

        return response.array()
    }

    private fun loadBlocklist() {
        blocklist.clear()
        try {
            assets.open("blocklist.txt").bufferedReader().useLines { lines ->
                lines.forEach { line ->
                    val domain = line.trim().lowercase(Locale.ROOT)
                    if (domain.isNotEmpty() && !domain.startsWith("#")) {
                        blocklist.add(domain)
                    }
                }
            }
            Log.i("AdOffVPN", "Blocklist loaded: ${blocklist.size} domains")
        } catch (e: Exception) {
            Log.e("AdOffVPN", "Failed to load blocklist: ${e.message}")
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "AdOff VPN",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "AdOff DNS protection is running"
            setShowBadge(false)
        }
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(channel)
    }

    private fun buildNotification(text: String) = NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("AdOff")
        .setContentText(text)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setOngoing(true)
        .build()
}
