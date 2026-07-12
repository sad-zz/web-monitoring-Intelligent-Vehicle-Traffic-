package ir.noavaran.tcmanager.serial

import java.io.IOException
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * اتصال TCP به پل سریال بی‌سیم (ESP01 متصل به UART میکروی اصلی).
 * ماژول ESP01 با فریم‌ور پل شفاف (مثل ESP-Link یا TCP-to-UART ساده)
 * هر بایتی که از شبکه بگیرد روی سریال می‌فرستد و برعکس —
 * پس همان فرمان‌های حالت کابل اینجا هم کار می‌کند.
 */
class TcpSerialLink(
    private val host: String,
    private val port: Int
) : SerialLink {

    private var socket: Socket? = null
    private var output: OutputStream? = null
    private val running = AtomicBoolean(false)
    private val executor = Executors.newSingleThreadExecutor()

    override val isConnected: Boolean
        get() = socket?.isConnected == true && running.get()

    override fun connect(onData: (ByteArray) -> Unit, onError: (Throwable) -> Unit) {
        val s = Socket()
        s.connect(InetSocketAddress(host, port), 7000)
        s.tcpNoDelay = true
        socket = s
        output = s.getOutputStream()
        running.set(true)

        executor.execute {
            val buffer = ByteArray(1024)
            try {
                val input = s.getInputStream()
                while (running.get()) {
                    val n = input.read(buffer)
                    if (n < 0) break
                    if (n > 0) onData(buffer.copyOf(n))
                }
                if (running.get()) onError(IOException("CONNECTION_CLOSED"))
            } catch (e: Exception) {
                if (running.get()) onError(e)
            }
        }
    }

    override fun write(data: ByteArray) {
        val out = output ?: throw IOException("NOT_CONNECTED")
        out.write(data)
        out.flush()
    }

    override fun disconnect() {
        running.set(false)
        try { socket?.close() } catch (_: Exception) {}
        socket = null
        output = null
    }
}
