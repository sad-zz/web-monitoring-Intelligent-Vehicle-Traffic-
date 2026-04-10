package ir.tcmanager.ui.screens

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hoho.android.usbserial.driver.UsbSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialPort
import ir.tcmanager.data.UsbSerialEvent
import ir.tcmanager.data.UsbSerialManager
import ir.tcmanager.data.UsbPortConfig
import ir.tcmanager.domain.Ratcx1Parser
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.launch

enum class DisplayMode { ASCII, HEX, BOTH }

data class TerminalLine(
    val text: String,
    val type: LineType,
    val timestamp: String = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.getDefault()).format(java.util.Date())
)

enum class LineType { RX, TX, SYSTEM, PARSED }

class UsbSerialViewModel(context: Context) : ViewModel() {

    val usbManager = UsbSerialManager(context)

    val terminalLines = mutableStateListOf<TerminalLine>()
    var inputText by mutableStateOf("")
    var isConnected by mutableStateOf(false)
    var displayMode by mutableStateOf(DisplayMode.BOTH)
    var newline by mutableStateOf(UsbSerialManager.Newline.NONE)
    var showTimestamp by mutableStateOf(true)
    var scrollLock by mutableStateOf(false)
    var showParsedPanel by mutableStateOf(false)
    var parsedIntervalData by mutableStateOf<Ratcx1Parser.IntervalData?>(null)
    var parsedHandshake by mutableStateOf<Ratcx1Parser.HandshakeMessage?>(null)
    var errorMessage by mutableStateOf<String?>(null)

    // Port config
    var baudRate by mutableStateOf(9600)
    var dataBits by mutableStateOf(8)
    var stopBits by mutableStateOf(UsbSerialPort.STOPBITS_1)
    var parity by mutableStateOf(UsbSerialPort.PARITY_NONE)
    var showPortSettings by mutableStateOf(false)

    private var receiveBuffer = StringBuilder()
    private var eventJob: Job? = null

    val availableDevices get() = usbManager.availableDevices.value

    fun refreshDevices() = usbManager.refreshDevices()

    fun connect(driver: UsbSerialDriver) {
        val config = UsbPortConfig(baudRate, dataBits, stopBits, parity)
        usbManager.connect(driver, config)
        observeEvents()
    }

    fun disconnect() {
        usbManager.disconnect()
        isConnected = false
    }

    private fun observeEvents() {
        eventJob?.cancel()
        eventJob = viewModelScope.launch {
            usbManager.events.filterNotNull().collect { event ->
                when (event) {
                    is UsbSerialEvent.Connected -> {
                        isConnected = true
                        addLine("متصل به: ${event.deviceName}", LineType.SYSTEM)
                    }
                    is UsbSerialEvent.Disconnected -> {
                        isConnected = false
                        addLine("اتصال قطع شد", LineType.SYSTEM)
                    }
                    is UsbSerialEvent.DataReceived -> handleRxData(event.bytes)
                    is UsbSerialEvent.Error -> {
                        errorMessage = event.message
                        addLine("خطا: ${event.message}", LineType.SYSTEM)
                        isConnected = false
                    }
                }
            }
        }
    }

    private fun handleRxData(bytes: ByteArray) {
        receiveBuffer.append(bytes.toString(Charsets.ISO_8859_1))
        // Process complete messages (terminated by newline or when buffer is large enough)
        val raw = receiveBuffer.toString()
        val lines = raw.split("\n", "\r\n")
        for (i in 0 until lines.size - 1) {
            val line = lines[i].trim()
            if (line.isNotEmpty()) processRxLine(line, bytes)
        }
        // Keep incomplete last segment in buffer
        receiveBuffer = StringBuilder(lines.last())

        // Always display raw bytes
        val display = buildDisplayString(bytes)
        addLine(display, LineType.RX)

        // Try to parse structured messages from buffer content
        val bufContent = raw.trim()
        when (Ratcx1Parser.identifyMessage(bufContent)) {
            Ratcx1Parser.MessageType.INTERVAL_DATA -> {
                Ratcx1Parser.parseIntervalData(bufContent)?.let { data ->
                    parsedIntervalData = data
                    showParsedPanel = true
                    addLine("[۸۸۲۱] داده فاصله پارس شد — کل وسایل: ${data.totalVehicles}", LineType.PARSED)
                }
            }
            Ratcx1Parser.MessageType.HANDSHAKE -> {
                Ratcx1Parser.parseHandshake(bufContent)?.let { hs ->
                    parsedHandshake = hs
                    addLine("[۸۰۰۰] Handshake — کد: ${hs.sysId} مدل: ${hs.model}", LineType.PARSED)
                }
            }
            Ratcx1Parser.MessageType.TIME_SYNC_ACK ->
                addLine("[۸۰۱۲] تأیید تنظیم ساعت دریافت شد", LineType.PARSED)
            else -> {}
        }
    }

    private fun processRxLine(line: String, bytes: ByteArray) { /* handled above */ }

    private fun buildDisplayString(bytes: ByteArray): String = when (displayMode) {
        DisplayMode.ASCII -> bytes.toString(Charsets.ISO_8859_1)
            .replace("\r", "").replace("\n", "↵")
        DisplayMode.HEX -> bytes.joinToString(" ") { "%02X".format(it) }
        DisplayMode.BOTH -> {
            val ascii = bytes.toString(Charsets.ISO_8859_1)
                .replace("\r", "").replace("\n", "↵")
            val hex = bytes.joinToString(" ") { "%02X".format(it) }
            "$ascii  [$hex]"
        }
    }

    fun sendInput() {
        val text = inputText.trim()
        if (text.isEmpty() || !isConnected) return
        val ok = usbManager.writeString(text, newline)
        if (ok) {
            addLine(text, LineType.TX)
            inputText = ""
        } else {
            errorMessage = "خطا در ارسال"
        }
    }

    fun sendHandshakeWait() {
        addLine("منتظر دریافت پیام Handshake (8000) از دستگاه…", LineType.SYSTEM)
    }

    fun sendTimeSync() {
        val cmd = Ratcx1Parser.buildTimeSync()
        val ok = usbManager.writeString(cmd, UsbSerialManager.Newline.NONE)
        if (ok) addLine(cmd, LineType.TX)
        else errorMessage = "خطا در ارسال Time Sync"
    }

    fun sendPoll() {
        val cmd = Ratcx1Parser.buildPoll()
        val ok = usbManager.writeString(cmd, UsbSerialManager.Newline.NONE)
        if (ok) addLine(cmd, LineType.TX)
        else errorMessage = "خطا در ارسال Poll"
    }

    fun clearTerminal() {
        terminalLines.clear()
        receiveBuffer.clear()
        parsedIntervalData = null
        parsedHandshake = null
        showParsedPanel = false
    }

    private fun addLine(text: String, type: LineType) {
        if (terminalLines.size > MAX_LINES) {
            terminalLines.removeRange(0, terminalLines.size - MAX_LINES + 1)
        }
        terminalLines.add(TerminalLine(text, type))
    }

    override fun onCleared() {
        super.onCleared()
        usbManager.release()
    }

    companion object {
        private const val MAX_LINES = 1000
    }
}
