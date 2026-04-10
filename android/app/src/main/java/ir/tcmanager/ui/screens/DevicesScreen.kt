package ir.tcmanager.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ir.tcmanager.data.models.Device
import ir.tcmanager.data.models.DeviceRequest
import ir.tcmanager.ui.components.*
import ir.tcmanager.ui.theme.OnlineGreen
import ir.tcmanager.ui.theme.OfflineRed

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DevicesScreen(vm: DevicesViewModel) {
    LaunchedEffect(Unit) { vm.load() }

    var showAdd by remember { mutableStateOf(false) }
    var editTarget by remember { mutableStateOf<Device?>(null) }
    var deleteTarget by remember { mutableStateOf<Device?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("مدیریت دستگاه‌ها") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary))
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAdd = true }) {
                Icon(Icons.Default.Add, contentDescription = "افزودن دستگاه")
            }
        }
    ) { padding ->
        LazyColumn(
            contentPadding = PaddingValues(top = padding.calculateTopPadding() + 8.dp,
                bottom = 80.dp, start = 12.dp, end = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            vm.errorMessage?.let { item { ErrorCard(it, onRetry = { vm.load() }) } }
            vm.successMessage?.let { item { SuccessCard(it) } }
            if (vm.isLoading) { item { LoadingBox() } }
            items(vm.devices) { device ->
                DeviceCard(
                    device = device,
                    isTcpConnected = vm.isTcpConnected(device.device_code),
                    onEdit = { editTarget = it },
                    onDelete = { deleteTarget = it },
                    onSyncTime = { vm.syncTime(it) },
                    onPoll = { vm.pollDevice(it) }
                )
            }
        }
    }

    if (showAdd) {
        DeviceDialog(title = "افزودن دستگاه",
            onConfirm = { req -> vm.create(req) { showAdd = false } },
            onDismiss = { showAdd = false })
    }
    editTarget?.let { dev ->
        DeviceDialog(title = "ویرایش دستگاه", initial = dev,
            onConfirm = { req -> vm.update(dev.device_code, req) { editTarget = null } },
            onDismiss = { editTarget = null })
    }
    deleteTarget?.let { dev ->
        ConfirmDialog(
            title = "حذف دستگاه",
            message = "دستگاه «${dev.name}» حذف شود؟",
            onConfirm = { vm.delete(dev.device_code) { deleteTarget = null } },
            onDismiss = { deleteTarget = null }
        )
    }
}

@Composable
private fun DeviceCard(
    device: Device,
    isTcpConnected: Boolean,
    onEdit: (Device) -> Unit,
    onDelete: (Device) -> Unit,
    onSyncTime: (String) -> Unit,
    onPoll: (String) -> Unit
) {
    Card(elevation = CardDefaults.cardElevation(2.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(device.name, style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.weight(1f))
                StatusBadge(device.status)
                if (isTcpConnected) {
                    Surface(shape = MaterialTheme.shapes.small,
                        color = OnlineGreen.copy(alpha = 0.15f)) {
                        Text("TCP", modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            color = OnlineGreen, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("کد: ${device.device_code}", style = MaterialTheme.typography.bodySmall)
                if (device.ip.isNotEmpty())
                    Text("IP: ${device.ip}", style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline)
            }
            if (device.route1.isNotEmpty() || device.rid1.isNotEmpty())
                Text("محور: ${device.route1}  RID: ${device.rid1}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline)

            // Action buttons
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                if (isTcpConnected) {
                    OutlinedButton(
                        onClick = { onSyncTime(device.device_code) },
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                    ) { Text("تنظیم ساعت", style = MaterialTheme.typography.labelSmall) }
                    OutlinedButton(
                        onClick = { onPoll(device.device_code) },
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                    ) { Text("درخواست داده", style = MaterialTheme.typography.labelSmall) }
                }
                Spacer(Modifier.weight(1f))
                IconButton(onClick = { onEdit(device) }, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Edit, contentDescription = "ویرایش",
                        tint = MaterialTheme.colorScheme.primary)
                }
                IconButton(onClick = { onDelete(device) }, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Delete, contentDescription = "حذف",
                        tint = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

@Composable
private fun DeviceDialog(
    title: String,
    initial: Device? = null,
    onConfirm: (DeviceRequest) -> Unit,
    onDismiss: () -> Unit
) {
    var code by remember { mutableStateOf(initial?.device_code ?: "") }
    var name by remember { mutableStateOf(initial?.name ?: "") }
    var type by remember { mutableStateOf(initial?.type ?: "sensor") }
    var ip by remember { mutableStateOf(initial?.ip ?: "") }
    var route1 by remember { mutableStateOf(initial?.route1 ?: "") }
    var route2 by remember { mutableStateOf(initial?.route2 ?: "") }
    var rid1 by remember { mutableStateOf(initial?.rid1 ?: "") }
    var rid2 by remember { mutableStateOf(initial?.rid2 ?: "") }
    var firmware by remember { mutableStateOf(initial?.firmware ?: "") }
    var active by remember { mutableStateOf(initial?.active != 0) }
    var error by remember { mutableStateOf<String?>(null) }

    val types = listOf("sensor", "camera", "counter", "controller")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth().heightIn(max = 420.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(value = code, onValueChange = { code = it },
                    label = { Text("کد دستگاه (۱-۸ رقم)") }, singleLine = true,
                    enabled = initial == null, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = name, onValueChange = { name = it },
                    label = { Text("نام دستگاه") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = ip, onValueChange = { ip = it },
                    label = { Text("آدرس IP") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth())
                // Type selector
                var typeExpanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(expanded = typeExpanded, onExpandedChange = { typeExpanded = it }) {
                    OutlinedTextField(value = type, onValueChange = {}, readOnly = true,
                        label = { Text("نوع دستگاه") }, modifier = Modifier.menuAnchor().fillMaxWidth(),
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(typeExpanded) })
                    ExposedDropdownMenu(expanded = typeExpanded, onDismissRequest = { typeExpanded = false }) {
                        types.forEach { t ->
                            DropdownMenuItem(text = { Text(t) }, onClick = { type = t; typeExpanded = false })
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = route1, onValueChange = { route1 = it },
                        label = { Text("محور ۱") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = rid1, onValueChange = { rid1 = it },
                        label = { Text("RID 1") }, singleLine = true, modifier = Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = route2, onValueChange = { route2 = it },
                        label = { Text("محور ۲") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = rid2, onValueChange = { rid2 = it },
                        label = { Text("RID 2") }, singleLine = true, modifier = Modifier.weight(1f))
                }
                OutlinedTextField(value = firmware, onValueChange = { firmware = it },
                    label = { Text("فریمور") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Switch(checked = active, onCheckedChange = { active = it })
                    Spacer(Modifier.width(8.dp)); Text("دستگاه فعال")
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall) }
            }
        },
        confirmButton = {
            Button(onClick = {
                if (code.isBlank() || !code.matches(Regex("\\d{1,8}"))) {
                    error = "کد دستگاه ۱ تا ۸ رقم است"; return@Button
                }
                if (name.isBlank()) { error = "نام الزامی است"; return@Button }
                onConfirm(DeviceRequest(code.trim(), name.trim(), type, route1.trim(),
                    route2.trim(), rid1.trim(), rid2.trim(), ip.trim(), firmware.trim(),
                    if (active) 1 else 0))
            }) { Text("ذخیره") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } }
    )
}
