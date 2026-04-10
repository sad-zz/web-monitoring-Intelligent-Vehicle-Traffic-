package ir.tcmanager.data

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import com.hoho.android.usbserial.driver.UsbSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialPort
import com.hoho.android.usbserial.driver.UsbSerialProber
import com.hoho.android.usbserial.util.SerialInputOutputManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class UsbPortConfig(
    val baudRate: Int = 9600,
    val dataBits: Int = 8,
    val stopBits: Int = UsbSerialPort.STOPBITS_1,
    val parity: Int = UsbSerialPort.PARITY_NONE
)

sealed class UsbSerialEvent {
    data class DataReceived(
        val bytes: List<Byte>,
        val timestamp: Long = System.currentTimeMillis()
    ) : UsbSerialEvent() {
        constructor(bytes: ByteArray, timestamp: Long = System.currentTimeMillis()) :
            this(bytes.toList(), timestamp)
        fun toByteArray(): ByteArray = bytes.toByteArray()
    }
    data class Connected(val deviceName: String) : UsbSerialEvent()
    object Disconnected : UsbSerialEvent()
    data class Error(val message: String) : UsbSerialEvent()
}

class UsbSerialManager(private val context: Context) {

    private val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager

    private val _events = MutableStateFlow<UsbSerialEvent?>(null)
    val events: StateFlow<UsbSerialEvent?> = _events.asStateFlow()

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _availableDevices = MutableStateFlow<List<UsbSerialDriver>>(emptyList())
    val availableDevices: StateFlow<List<UsbSerialDriver>> = _availableDevices.asStateFlow()

    private var port: UsbSerialPort? = null
    private var ioManager: SerialInputOutputManager? = null

    private val permissionReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            if (intent.action == ACTION_USB_PERMISSION) {
                val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                if (granted) {
                    val device = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
                    } else {
                        @Suppress("DEPRECATION")
                        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
                    }
                    device?.let { pendingConnectConfig?.let { cfg -> openDevice(it, cfg) } }
                } else {
                    _events.value = UsbSerialEvent.Error("مجوز دسترسی به USB رد شد")
                }
            }
        }
    }

    private var pendingConnectConfig: UsbPortConfig? = null

    init {
        val filter = IntentFilter(ACTION_USB_PERMISSION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(permissionReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(permissionReceiver, filter)
        }
    }

    fun refreshDevices() {
        val prober = UsbSerialProber.getDefaultProber()
        _availableDevices.value = prober.findAllDrivers(usbManager)
    }

    fun connect(driver: UsbSerialDriver, config: UsbPortConfig = UsbPortConfig()) {
        pendingConnectConfig = config
        if (!usbManager.hasPermission(driver.device)) {
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                PendingIntent.FLAG_MUTABLE else 0
            val intent = PendingIntent.getBroadcast(context, 0, Intent(ACTION_USB_PERMISSION), flags)
            usbManager.requestPermission(driver.device, intent)
        } else {
            openDevice(driver.device, config)
        }
    }

    private fun openDevice(device: UsbDevice, config: UsbPortConfig) {
        try {
            val prober = UsbSerialProber.getDefaultProber()
            val driver = prober.probeDevice(device)
                ?: return run { _events.value = UsbSerialEvent.Error("درایور دستگاه پشتیبانی نمی‌شود") }

            val connection = usbManager.openDevice(device)
                ?: return run { _events.value = UsbSerialEvent.Error("امکان باز کردن دستگاه USB وجود ندارد") }

            port = driver.ports[0]
            port!!.open(connection)
            port!!.setParameters(config.baudRate, config.dataBits, config.stopBits, config.parity)
            port!!.dtr = true
            port!!.rts = true

            ioManager = SerialInputOutputManager(port, object : SerialInputOutputManager.Listener {
                override fun onNewData(data: ByteArray) {
                    _events.value = UsbSerialEvent.DataReceived(data)
                }
                override fun onRunError(e: Exception) {
                    _events.value = UsbSerialEvent.Error("خطای ارتباط: ${e.message}")
                    _isConnected.value = false
                }
            })
            ioManager!!.start()
            _isConnected.value = true
            _events.value = UsbSerialEvent.Connected(device.productName ?: device.deviceName)
        } catch (e: Exception) {
            _events.value = UsbSerialEvent.Error("خطا در اتصال: ${e.message}")
        }
    }

    fun disconnect() {
        ioManager?.stop()
        ioManager = null
        try { port?.close() } catch (_: Exception) {}
        port = null
        _isConnected.value = false
        _events.value = UsbSerialEvent.Disconnected
    }

    /** Write raw bytes to the serial port. Returns true on success. */
    fun write(data: ByteArray): Boolean {
        return try {
            port?.write(data, WRITE_TIMEOUT_MS) != null
        } catch (e: Exception) {
            _events.value = UsbSerialEvent.Error("خطا در ارسال: ${e.message}")
            false
        }
    }

    /** Write an ASCII string to the serial port. */
    fun writeString(text: String, newline: Newline = Newline.NONE): Boolean {
        val suffix = when (newline) {
            Newline.LF -> "\n"
            Newline.CRLF -> "\r\n"
            Newline.NONE -> ""
        }
        return write((text + suffix).toByteArray(Charsets.US_ASCII))
    }

    fun release() {
        disconnect()
        try { context.unregisterReceiver(permissionReceiver) } catch (_: Exception) {}
    }

    enum class Newline { NONE, LF, CRLF }

    companion object {
        private const val ACTION_USB_PERMISSION = "ir.tcmanager.USB_PERMISSION"
        private const val WRITE_TIMEOUT_MS = 2000
    }
}
