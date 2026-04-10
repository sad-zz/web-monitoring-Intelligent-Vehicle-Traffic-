package ir.tcmanager.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hoho.android.usbserial.driver.UsbSerialPort
import ir.tcmanager.data.UsbSerialManager
import ir.tcmanager.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UsbSerialScreen(vm: UsbSerialViewModel) {
    LaunchedEffect(Unit) { vm.refreshDevices() }

    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val keyboard = LocalSoftwareKeyboardController.current
    val lineCount = vm.terminalLines.size

    // Auto-scroll when new data arrives (unless scroll-lock is on)
    LaunchedEffect(lineCount) {
        if (!vm.scrollLock && lineCount > 0) {
            listState.animateScrollToItem(lineCount - 1)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("ترمینال USB Serial") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary),
                actions = {
                    // Scroll lock
                    IconButton(onClick = { vm.scrollLock = !vm.scrollLock }) {
                        Icon(
                            if (vm.scrollLock) Icons.Default.Lock else Icons.Default.LockOpen,
                            contentDescription = "قفل اسکرول")
                    }
                    // Timestamp toggle
                    IconButton(onClick = { vm.showTimestamp = !vm.showTimestamp }) {
                        Icon(Icons.Default.AccessTime, contentDescription = "زمان‌بندی")
                    }
                    // Port settings
                    IconButton(onClick = { vm.showPortSettings = !vm.showPortSettings }) {
                        Icon(Icons.Default.Settings, contentDescription = "تنظیمات پورت")
                    }
                    // Clear
                    IconButton(onClick = { vm.clearTerminal() }) {
                        Icon(Icons.Default.DeleteSweep, contentDescription = "پاک کردن")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            Modifier
                .padding(top = padding.calculateTopPadding())
                .fillMaxSize()
        ) {
            // Port settings panel (collapsible)
            if (vm.showPortSettings) {
                PortSettingsPanel(vm)
            }

            // Device picker + connect button
            if (!vm.isConnected) {
                DevicePickerBar(vm)
            } else {
                ConnectedBar(vm)
            }

            vm.errorMessage?.let { err ->
                Text(err, color = TerminalTx,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 2.dp),
                    style = MaterialTheme.typography.bodySmall)
            }

            // Quick command buttons
            if (vm.isConnected) {
                QuickCommandRow(vm)
            }

            // Display mode selector
            DisplayModeRow(vm)

            // Terminal output
            Box(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .background(TerminalBg)
            ) {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(8.dp),
                    verticalArrangement = Arrangement.spacedBy(1.dp)
                ) {
                    itemsIndexed(vm.terminalLines) { _, line ->
                        TerminalLineRow(line, vm.showTimestamp)
                    }
                }
            }

            // Parsed data panel
            if (vm.showParsedPanel) {
                vm.parsedIntervalData?.let { data ->
                    ParsedDataPanel(data, onDismiss = { vm.showParsedPanel = false })
                }
            }

            // Input bar
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF2D2D2D))
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Newline selector
                var newlineExpanded by remember { mutableStateOf(false) }
                Box {
                    TextButton(onClick = { newlineExpanded = true }) {
                        Text(when (vm.newline) {
                            UsbSerialManager.Newline.NONE -> "None"
                            UsbSerialManager.Newline.LF -> "LF"
                            UsbSerialManager.Newline.CRLF -> "CRLF"
                        }, color = TerminalText, style = MaterialTheme.typography.labelSmall)
                    }
                    DropdownMenu(expanded = newlineExpanded, onDismissRequest = { newlineExpanded = false }) {
                        listOf(UsbSerialManager.Newline.NONE to "None",
                            UsbSerialManager.Newline.LF to "LF",
                            UsbSerialManager.Newline.CRLF to "CRLF").forEach { (nl, label) ->
                            DropdownMenuItem(text = { Text(label) }, onClick = {
                                vm.newline = nl; newlineExpanded = false
                            })
                        }
                    }
                }

                OutlinedTextField(
                    value = vm.inputText,
                    onValueChange = { vm.inputText = it },
                    placeholder = { Text("ارسال دستور…", color = Color.Gray, fontSize = 13.sp) },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = TerminalText.copy(alpha = 0.6f),
                        unfocusedBorderColor = Color.Gray,
                        cursorColor = TerminalText
                    ),
                    textStyle = androidx.compose.ui.text.TextStyle(
                        fontFamily = FontFamily.Monospace, fontSize = 13.sp),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = {
                        vm.sendInput(); keyboard?.hide()
                    })
                )
                Spacer(Modifier.width(4.dp))
                IconButton(
                    onClick = { vm.sendInput(); keyboard?.hide() },
                    enabled = vm.isConnected && vm.inputText.isNotBlank()
                ) {
                    Icon(Icons.Default.Send, contentDescription = "ارسال", tint = TerminalText)
                }
            }
        }
    }
}

@Composable
private fun TerminalLineRow(line: TerminalLine, showTimestamp: Boolean) {
    val color = when (line.type) {
        LineType.RX -> TerminalRx
        LineType.TX -> TerminalTx
        LineType.SYSTEM -> TerminalSystem
        LineType.PARSED -> Color(0xFF80CBC4)
    }
    val prefix = when (line.type) {
        LineType.RX -> "RX"
        LineType.TX -> "TX"
        LineType.SYSTEM -> "**"
        LineType.PARSED -> ">>"
    }
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        if (showTimestamp) {
            Text(line.timestamp, color = Color.Gray, fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier.width(88.dp))
        }
        Text("[$prefix]", color = color.copy(alpha = 0.7f), fontSize = 11.sp,
            fontFamily = FontFamily.Monospace, modifier = Modifier.width(32.dp))
        Text(line.text, color = color, fontSize = 12.sp,
            fontFamily = FontFamily.Monospace, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun QuickCommandRow(vm: UsbSerialViewModel) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(Color(0xFF252525))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        QuickCmdButton("8000 →", onClick = { vm.sendHandshakeWait() })
        QuickCmdButton("0012 TimeSync", onClick = { vm.sendTimeSync() })
        QuickCmdButton("0197 Poll", onClick = { vm.sendPoll() })
        Spacer(Modifier.weight(1f))
        if (vm.parsedIntervalData != null) {
            TextButton(onClick = { vm.showParsedPanel = !vm.showParsedPanel }) {
                Text(if (vm.showParsedPanel) "مخفی" else "داده ۸۸۲۱",
                    color = Color(0xFF80CBC4), style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
private fun QuickCmdButton(label: String, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = TerminalText)
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, fontFamily = FontFamily.Monospace)
    }
}

@Composable
private fun DisplayModeRow(vm: UsbSerialViewModel) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(Color(0xFF252525))
            .padding(horizontal = 8.dp, vertical = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text("نمایش:", color = Color.Gray, style = MaterialTheme.typography.labelSmall)
        listOf(DisplayMode.ASCII to "ASCII",
            DisplayMode.HEX to "HEX",
            DisplayMode.BOTH to "هر دو").forEach { (mode, label) ->
            FilterChip(
                selected = vm.displayMode == mode,
                onClick = { vm.displayMode = mode },
                label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = TerminalText.copy(alpha = 0.2f),
                    selectedLabelColor = TerminalText)
            )
        }
    }
}

@Composable
private fun DevicePickerBar(vm: UsbSerialViewModel) {
    val drivers = vm.availableDevices
    Row(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (drivers.isEmpty()) {
            Icon(Icons.Default.UsbOff, contentDescription = null,
                tint = MaterialTheme.colorScheme.error)
            Text("دستگاه USB یافت نشد", style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.weight(1f))
            IconButton(onClick = { vm.refreshDevices() }) {
                Icon(Icons.Default.Refresh, contentDescription = "جستجو مجدد")
            }
        } else {
            var expanded by remember { mutableStateOf(false) }
            var selectedIdx by remember { mutableStateOf(0) }
            Box(Modifier.weight(1f)) {
                OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
                    Text(drivers.getOrNull(selectedIdx)?.device?.productName
                        ?: drivers.getOrNull(selectedIdx)?.device?.deviceName ?: "انتخاب دستگاه",
                        style = MaterialTheme.typography.bodySmall)
                }
                DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    drivers.forEachIndexed { idx, driver ->
                        DropdownMenuItem(
                            text = { Text(driver.device.productName ?: driver.device.deviceName ?: "USB Device $idx") },
                            onClick = { selectedIdx = idx; expanded = false }
                        )
                    }
                }
            }
            Button(onClick = { drivers.getOrNull(selectedIdx)?.let { vm.connect(it) } }) {
                Text("اتصال")
            }
        }
    }
}

@Composable
private fun ConnectedBar(vm: UsbSerialViewModel) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(Color(0xFF1B3A1B))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(Icons.Default.Usb, contentDescription = null, tint = OnlineGreen)
        Text("متصل  |  ${vm.baudRate} bps",
            color = OnlineGreen, style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.weight(1f))
        OutlinedButton(
            onClick = { vm.disconnect() },
            colors = ButtonDefaults.outlinedButtonColors(contentColor = OfflineRed)
        ) { Text("قطع اتصال") }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PortSettingsPanel(vm: UsbSerialViewModel) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E2A1E))
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("تنظیمات پورت", color = TerminalText, style = MaterialTheme.typography.titleSmall)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                // Baud rate
                var baudExpanded by remember { mutableStateOf(false) }
                val bauds = listOf(1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200)
                Box(Modifier.weight(1f)) {
                    ExposedDropdownMenuBox(expanded = baudExpanded, onExpandedChange = { baudExpanded = it }) {
                        OutlinedTextField(value = "${vm.baudRate}", onValueChange = {}, readOnly = true,
                            label = { Text("Baud", color = Color.Gray) },
                            modifier = Modifier.menuAnchor().fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White, unfocusedTextColor = Color.White,
                                focusedBorderColor = TerminalText.copy(0.6f), unfocusedBorderColor = Color.Gray),
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(baudExpanded) })
                        ExposedDropdownMenu(expanded = baudExpanded, onDismissRequest = { baudExpanded = false }) {
                            bauds.forEach { b ->
                                DropdownMenuItem(text = { Text(b.toString()) },
                                    onClick = { vm.baudRate = b; baudExpanded = false })
                            }
                        }
                    }
                }
                // Data bits
                var dbExpanded by remember { mutableStateOf(false) }
                Box(Modifier.weight(1f)) {
                    ExposedDropdownMenuBox(expanded = dbExpanded, onExpandedChange = { dbExpanded = it }) {
                        OutlinedTextField(value = "${vm.dataBits}", onValueChange = {}, readOnly = true,
                            label = { Text("Data", color = Color.Gray) },
                            modifier = Modifier.menuAnchor().fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White, unfocusedTextColor = Color.White,
                                focusedBorderColor = TerminalText.copy(0.6f), unfocusedBorderColor = Color.Gray),
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(dbExpanded) })
                        ExposedDropdownMenu(expanded = dbExpanded, onDismissRequest = { dbExpanded = false }) {
                            listOf(5, 6, 7, 8).forEach { d ->
                                DropdownMenuItem(text = { Text(d.toString()) },
                                    onClick = { vm.dataBits = d; dbExpanded = false })
                            }
                        }
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                // Stop bits
                var sbExpanded by remember { mutableStateOf(false) }
                val stopOptions = listOf(
                    UsbSerialPort.STOPBITS_1 to "1",
                    UsbSerialPort.STOPBITS_1_5 to "1.5",
                    UsbSerialPort.STOPBITS_2 to "2"
                )
                Box(Modifier.weight(1f)) {
                    ExposedDropdownMenuBox(expanded = sbExpanded, onExpandedChange = { sbExpanded = it }) {
                        OutlinedTextField(
                            value = stopOptions.find { it.first == vm.stopBits }?.second ?: "1",
                            onValueChange = {}, readOnly = true,
                            label = { Text("Stop", color = Color.Gray) },
                            modifier = Modifier.menuAnchor().fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White, unfocusedTextColor = Color.White,
                                focusedBorderColor = TerminalText.copy(0.6f), unfocusedBorderColor = Color.Gray),
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(sbExpanded) })
                        ExposedDropdownMenu(expanded = sbExpanded, onDismissRequest = { sbExpanded = false }) {
                            stopOptions.forEach { (v, label) ->
                                DropdownMenuItem(text = { Text(label) },
                                    onClick = { vm.stopBits = v; sbExpanded = false })
                            }
                        }
                    }
                }
                // Parity
                var parExpanded by remember { mutableStateOf(false) }
                val parityOptions = listOf(
                    UsbSerialPort.PARITY_NONE to "None",
                    UsbSerialPort.PARITY_ODD to "Odd",
                    UsbSerialPort.PARITY_EVEN to "Even",
                    UsbSerialPort.PARITY_MARK to "Mark",
                    UsbSerialPort.PARITY_SPACE to "Space"
                )
                Box(Modifier.weight(1f)) {
                    ExposedDropdownMenuBox(expanded = parExpanded, onExpandedChange = { parExpanded = it }) {
                        OutlinedTextField(
                            value = parityOptions.find { it.first == vm.parity }?.second ?: "None",
                            onValueChange = {}, readOnly = true,
                            label = { Text("Parity", color = Color.Gray) },
                            modifier = Modifier.menuAnchor().fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White, unfocusedTextColor = Color.White,
                                focusedBorderColor = TerminalText.copy(0.6f), unfocusedBorderColor = Color.Gray),
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(parExpanded) })
                        ExposedDropdownMenu(expanded = parExpanded, onDismissRequest = { parExpanded = false }) {
                            parityOptions.forEach { (v, label) ->
                                DropdownMenuItem(text = { Text(label) },
                                    onClick = { vm.parity = v; parExpanded = false })
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ParsedDataPanel(
    data: ir.tcmanager.domain.Ratcx1Parser.IntervalData,
    onDismiss: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1A2C2C))
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically) {
                Text("داده فاصله پارس‌شده (8821)",
                    color = Color(0xFF80CBC4), style = MaterialTheme.typography.titleSmall)
                IconButton(onClick = onDismiss, modifier = Modifier.size(24.dp)) {
                    Icon(Icons.Default.Close, contentDescription = "بستن",
                        tint = Color.Gray, modifier = Modifier.size(16.dp))
                }
            }
            Text("کد دستگاه: ${data.sysId}  |  زمان: ${data.intervalTime}",
                color = Color.White, style = MaterialTheme.typography.bodySmall,
                fontFamily = FontFamily.Monospace)
            LanePanel("لاین ۱", data.lane1, data.lane1Occupancy)
            LanePanel("لاین ۲", data.lane2, data.lane2Occupancy)
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("باتری: ${"%.1f".format(data.batteryVoltage)}V", color = Color.White,
                    style = MaterialTheme.typography.bodySmall)
                Text("خورشیدی: ${"%.1f".format(data.solarVoltage)}V", color = Color.White,
                    style = MaterialTheme.typography.bodySmall)
                if (data.hasError) Text("خطا: ${data.errorByte}", color = TerminalTx,
                    style = MaterialTheme.typography.bodySmall)
            }
            Text("کل وسایل: ${data.totalVehicles}",
                color = TerminalText, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun LanePanel(label: String, lane: ir.tcmanager.domain.Ratcx1Parser.LaneData, occupancy: Int) {
    Column {
        Text("$label — کل: ${lane.totalVehicles} | سرعت: ${lane.averageSpeed} km/h | اشغال: $occupancy%",
            color = TerminalRx, style = MaterialTheme.typography.bodySmall)
        val classes = listOf(
            "موتور" to lane.motorcycle,
            "سواری" to lane.car,
            "وانت" to lane.van,
            "اتوبوس" to lane.bus,
            "کامیون" to lane.truck,
            "سایر" to lane.other
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            classes.forEach { (name, vc) ->
                if (vc.count > 0) {
                    Surface(shape = MaterialTheme.shapes.extraSmall,
                        color = Color.White.copy(alpha = 0.08f),
                        modifier = Modifier.padding(vertical = 2.dp)) {
                        Column(Modifier.padding(4.dp),
                            horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(name, color = Color.Gray, style = MaterialTheme.typography.labelSmall, fontSize = 9.sp)
                            Text("${vc.count}", color = Color.White,
                                style = MaterialTheme.typography.labelMedium, fontFamily = FontFamily.Monospace)
                        }
                    }
                }
            }
        }
    }
}
