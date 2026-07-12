package ir.noavaran.tcmanager.serial

import android.content.Context
import android.hardware.usb.UsbManager
import com.hoho.android.usbserial.driver.UsbSerialPort
import com.hoho.android.usbserial.driver.UsbSerialProber
import com.hoho.android.usbserial.util.SerialInputOutputManager
import java.io.IOException

/**
 * اتصال از طریق مبدل USB سریال (FTDI, CH340, CP210x, PL2303, CDC).
 * پیش‌نیاز: کابل OTG + مجوز USB که باید قبل از connect گرفته شده باشد.
 */
class UsbSerialLink(
    private val context: Context,
    private val baudRate: Int
) : SerialLink, SerialInputOutputManager.Listener {

    private var port: UsbSerialPort? = null
    private var ioManager: SerialInputOutputManager? = null
    private var onData: ((ByteArray) -> Unit)? = null
    private var onError: ((Throwable) -> Unit)? = null

    override val isConnected: Boolean
        get() = port != null

    /** اولین درایور سازگار متصل به گوشی (یا null) */
    fun findDriver() = UsbSerialProber.getDefaultProber()
        .findAllDrivers(context.getSystemService(Context.USB_SERVICE) as UsbManager)
        .firstOrNull()

    fun hasPermission(): Boolean {
        val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
        val driver = findDriver() ?: return false
        return usbManager.hasPermission(driver.device)
    }

    override fun connect(onData: (ByteArray) -> Unit, onError: (Throwable) -> Unit) {
        this.onData = onData
        this.onError = onError

        val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
        val driver = findDriver() ?: throw IOException("NO_DEVICE")
        val connection = usbManager.openDevice(driver.device)
            ?: throw IOException("NO_PERMISSION")

        val p = driver.ports[0]
        p.open(connection)
        p.setParameters(baudRate, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE)
        port = p

        ioManager = SerialInputOutputManager(p, this).also { it.start() }
    }

    override fun write(data: ByteArray) {
        port?.write(data, 2000) ?: throw IOException("NOT_CONNECTED")
    }

    override fun disconnect() {
        try { ioManager?.stop() } catch (_: Exception) {}
        ioManager = null
        try { port?.close() } catch (_: Exception) {}
        port = null
    }

    // SerialInputOutputManager.Listener
    override fun onNewData(data: ByteArray) {
        onData?.invoke(data)
    }

    override fun onRunError(e: Exception) {
        onError?.invoke(e)
    }
}
