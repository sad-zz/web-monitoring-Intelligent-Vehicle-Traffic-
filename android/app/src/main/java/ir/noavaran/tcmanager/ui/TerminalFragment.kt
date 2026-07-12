package ir.noavaran.tcmanager.ui

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import com.google.android.material.button.MaterialButton
import com.google.android.material.button.MaterialButtonToggleGroup
import ir.noavaran.tcmanager.Prefs
import ir.noavaran.tcmanager.R
import ir.noavaran.tcmanager.protocol.RatcProtocol
import ir.noavaran.tcmanager.serial.SerialLink
import ir.noavaran.tcmanager.serial.TcpSerialLink
import ir.noavaran.tcmanager.serial.UsbSerialLink

/**
 * ترمینال سریال RATCX1 — دو حالت:
 *  - USB: کابل OTG + مبدل سریال به UART1 دستگاه (115200)
 *  - WiFi: اتصال TCP به ماژول ESP01 (پل شفاف سریال) روی UART دستگاه
 * دکمه‌های سریع فرمان‌های فریم‌ور + رمزگشای کد خطا به فارسی.
 */
class TerminalFragment : Fragment() {

    companion object {
        private const val ACTION_USB_PERMISSION = "ir.noavaran.tcmanager.USB_PERMISSION"
        private const val MAX_OUTPUT_CHARS = 40_000
    }

    private var link: SerialLink? = null
    private var usbLink: UsbSerialLink? = null
    private val outputBuffer = StringBuilder()

    private var txtOutput: TextView? = null
    private var scroll: ScrollView? = null
    private var btnConnect: MaterialButton? = null
    private var modeGroup: MaterialButtonToggleGroup? = null

    private val usbPermissionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == ACTION_USB_PERMISSION) {
                if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                    doConnect()
                } else {
                    appendLine(getString(R.string.terminal_usb_permission_denied))
                }
            }
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_terminal, container, false)

    @SuppressLint("UnspecifiedRegisterReceiverFlag")
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        txtOutput = view.findViewById(R.id.txt_output)
        scroll = view.findViewById(R.id.scroll_output)
        btnConnect = view.findViewById(R.id.btn_connect)
        modeGroup = view.findViewById(R.id.mode_group)
        val editCommand = view.findViewById<EditText>(R.id.edit_command)

        modeGroup?.check(R.id.btn_mode_usb)

        val filter = IntentFilter(ACTION_USB_PERMISSION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requireContext().registerReceiver(usbPermissionReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            requireContext().registerReceiver(usbPermissionReceiver, filter)
        }

        btnConnect?.setOnClickListener {
            if (link?.isConnected == true) disconnect() else connect()
        }

        view.findViewById<View>(R.id.btn_send).setOnClickListener {
            sendFromInput(editCommand)
        }
        editCommand.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                sendFromInput(editCommand); true
            } else false
        }

        view.findViewById<View>(R.id.btn_clear).setOnClickListener {
            outputBuffer.setLength(0)
            txtOutput?.text = ""
        }

        buildQuickButtons(view.findViewById(R.id.quick_commands))
    }

    /** دکمه‌های سریع + دکمه فهرست کامل فرمان‌ها + رمزگشای خطا */
    private fun buildQuickButtons(row: LinearLayout) {
        fun chip(text: String, onClick: () -> Unit) {
            val b = MaterialButton(
                requireContext(), null,
                com.google.android.material.R.attr.materialButtonOutlinedStyle
            )
            b.text = text
            b.textSize = 12f
            b.layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { marginEnd = 8 }
            b.setOnClickListener { onClick() }
            row.addView(b)
        }

        chip(getString(R.string.terminal_commands)) { showCommandListDialog() }
        chip(getString(R.string.terminal_decode_error)) { showDecodeDialog() }

        RatcProtocol.COMMANDS.filter { it.quick }.forEach { cmd ->
            chip(cmd.title) {
                val command = when (cmd.code) {
                    "0012" -> RatcProtocol.buildTimeSync()
                    "0197" -> RatcProtocol.buildLastIntervalRequest()
                    else -> cmd.code
                }
                if (cmd.dangerous) {
                    AlertDialog.Builder(requireContext())
                        .setMessage(R.string.terminal_confirm_reset)
                        .setPositiveButton(R.string.yes) { _, _ -> sendCommand(command) }
                        .setNegativeButton(R.string.no, null)
                        .show()
                } else {
                    sendCommand(command)
                }
            }
        }
    }

    private fun showCommandListDialog() {
        val text = RatcProtocol.COMMANDS.joinToString("\n\n") {
            "▪ ${it.title}\n   فرمان: ${it.format}\n   ${it.description}"
        }
        AlertDialog.Builder(requireContext())
            .setTitle(R.string.terminal_commands)
            .setMessage(text)
            .setPositiveButton(R.string.ok, null)
            .show()
    }

    private fun showDecodeDialog() {
        val input = EditText(requireContext())
        input.hint = getString(R.string.terminal_decode_hint)
        input.inputType = android.text.InputType.TYPE_CLASS_NUMBER
        AlertDialog.Builder(requireContext())
            .setTitle(R.string.terminal_decode_error)
            .setView(input)
            .setPositiveButton(R.string.ok) { _, _ ->
                val code = input.text.toString().trim().toIntOrNull() ?: return@setPositiveButton
                val errors = RatcProtocol.decodeErrorByte(code)
                val message = if (errors.isEmpty())
                    getString(R.string.terminal_decode_none)
                else
                    errors.joinToString("\n\n") { "⚠ $it" }
                AlertDialog.Builder(requireContext())
                    .setTitle("کد $code")
                    .setMessage(message)
                    .setPositiveButton(R.string.ok, null)
                    .show()
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    // ---------- اتصال ----------

    private fun connect() {
        if (modeGroup?.checkedButtonId == R.id.btn_mode_usb) {
            val prefs = Prefs(requireContext())
            val usb = UsbSerialLink(requireContext(), prefs.baudRate)
            usbLink = usb
            val driver = usb.findDriver()
            if (driver == null) {
                appendLine(getString(R.string.terminal_no_usb_device))
                return
            }
            if (!usb.hasPermission()) {
                val usbManager = requireContext().getSystemService(Context.USB_SERVICE) as UsbManager
                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                    PendingIntent.FLAG_IMMUTABLE else 0
                val pi = PendingIntent.getBroadcast(
                    requireContext(), 0,
                    Intent(ACTION_USB_PERMISSION).setPackage(requireContext().packageName),
                    flags
                )
                usbManager.requestPermission(driver.device, pi)
                return // ادامه در usbPermissionReceiver
            }
        }
        doConnect()
    }

    private fun doConnect() {
        val prefs = Prefs(requireContext())
        val isUsb = modeGroup?.checkedButtonId == R.id.btn_mode_usb
        try {
            val newLink: SerialLink = if (isUsb) {
                usbLink ?: UsbSerialLink(requireContext(), prefs.baudRate)
            } else {
                TcpSerialLink(prefs.tcpHost, prefs.tcpPort)
            }
            newLink.connect(
                onData = { data -> onDataReceived(data) },
                onError = { e ->
                    runOnUi {
                        appendLine(getString(R.string.terminal_error, e.message ?: ""))
                        disconnect()
                    }
                }
            )
            link = newLink
            btnConnect?.setText(R.string.terminal_disconnect)
            appendLine(
                if (isUsb) getString(R.string.terminal_connected_usb, prefs.baudRate)
                else getString(R.string.terminal_connected_tcp, prefs.tcpHost, prefs.tcpPort)
            )
        } catch (e: Exception) {
            val msg = when (e.message) {
                "NO_DEVICE" -> getString(R.string.terminal_no_usb_device)
                "NO_PERMISSION" -> getString(R.string.terminal_usb_permission_denied)
                else -> getString(R.string.terminal_error, e.message ?: "")
            }
            appendLine(msg)
        }
    }

    private fun disconnect() {
        link?.disconnect()
        link = null
        btnConnect?.setText(R.string.terminal_connect)
        appendLine(getString(R.string.terminal_disconnected))
    }

    // ---------- ارسال/دریافت ----------

    private fun sendFromInput(edit: EditText) {
        val cmd = edit.text.toString().trim()
        if (cmd.isEmpty()) return
        sendCommand(cmd)
        edit.setText("")
    }

    private fun sendCommand(command: String) {
        val l = link
        if (l?.isConnected != true) {
            Toast.makeText(requireContext(), R.string.terminal_not_connected, Toast.LENGTH_SHORT).show()
            return
        }
        try {
            // پروتکل RATCX1: پایان فرمان با CR
            l.write((command + "\r").toByteArray(Charsets.US_ASCII))
            appendLine(">> $command")
        } catch (e: Exception) {
            appendLine(getString(R.string.terminal_error, e.message ?: ""))
        }
    }

    private fun onDataReceived(data: ByteArray) {
        val text = String(data, Charsets.US_ASCII)
        runOnUi {
            appendRaw(text)
            // اگر خروجی 0088 شامل «Err: n» بود، رمزگشایی فارسی نشان بده
            RatcProtocol.findErrorsInOutput(text)?.let { (code, errors) ->
                if (errors.isNotEmpty()) {
                    appendLine("")
                    appendLine("── رمزگشایی کد خطا $code ──")
                    errors.forEach { appendLine("⚠ $it") }
                }
            }
        }
    }

    private fun appendLine(line: String) = appendRaw(line + "\n")

    private fun appendRaw(text: String) {
        outputBuffer.append(text)
        if (outputBuffer.length > MAX_OUTPUT_CHARS) {
            outputBuffer.delete(0, outputBuffer.length - MAX_OUTPUT_CHARS)
        }
        txtOutput?.text = outputBuffer.toString()
        scroll?.post { scroll?.fullScroll(View.FOCUS_DOWN) }
    }

    private fun runOnUi(block: () -> Unit) {
        if (isAdded) requireActivity().runOnUiThread { if (isAdded) block() }
    }

    override fun onDestroyView() {
        try { requireContext().unregisterReceiver(usbPermissionReceiver) } catch (_: Exception) {}
        link?.disconnect()
        link = null
        super.onDestroyView()
    }
}
