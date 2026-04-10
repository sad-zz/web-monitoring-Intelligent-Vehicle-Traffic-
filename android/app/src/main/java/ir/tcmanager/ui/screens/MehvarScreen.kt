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
import ir.tcmanager.data.models.Mehvar
import ir.tcmanager.ui.components.ConfirmDialog
import ir.tcmanager.ui.components.ErrorCard
import ir.tcmanager.ui.components.LoadingBox
import ir.tcmanager.ui.components.SuccessCard
import ir.tcmanager.ui.theme.OnlineGreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MehvarScreen(vm: MehvarViewModel) {
    LaunchedEffect(Unit) { vm.load() }

    var showAddDialog by remember { mutableStateOf(false) }
    var editTarget by remember { mutableStateOf<Mehvar?>(null) }
    var deleteTarget by remember { mutableStateOf<Mehvar?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("مدیریت محورها") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary))
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "افزودن محور")
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
            items(vm.list) { mehvar ->
                MehvarCard(
                    mehvar = mehvar,
                    onEdit = { editTarget = it },
                    onDelete = { deleteTarget = it }
                )
            }
        }
    }

    if (showAddDialog) {
        MehvarDialog(
            title = "افزودن محور",
            onConfirm = { code, name, sendEnable, repair, ostan ->
                vm.create(code, name, sendEnable, repair, ostan) { showAddDialog = false }
            },
            onDismiss = { showAddDialog = false }
        )
    }
    editTarget?.let { m ->
        MehvarDialog(
            title = "ویرایش محور",
            initial = m,
            onConfirm = { code, name, sendEnable, repair, ostan ->
                vm.update(code, name, sendEnable, repair, ostan) { editTarget = null }
            },
            onDismiss = { editTarget = null }
        )
    }
    deleteTarget?.let { m ->
        ConfirmDialog(
            title = "حذف محور",
            message = "محور «${m.name}» حذف شود؟",
            onConfirm = { vm.delete(m.code) { deleteTarget = null } },
            onDismiss = { deleteTarget = null }
        )
    }
}

@Composable
private fun MehvarCard(mehvar: Mehvar, onEdit: (Mehvar) -> Unit, onDelete: (Mehvar) -> Unit) {
    Card(elevation = CardDefaults.cardElevation(2.dp), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("کد: ${mehvar.code}", style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary)
                    if (mehvar.send_enable == 1)
                        Surface(shape = MaterialTheme.shapes.extraSmall,
                            color = OnlineGreen.copy(alpha = 0.12f)) {
                            Text("فعال", modifier = Modifier.padding(horizontal = 6.dp, vertical = 1.dp),
                                style = MaterialTheme.typography.labelSmall, color = OnlineGreen)
                        }
                    if (mehvar.repair == 1)
                        Surface(shape = MaterialTheme.shapes.extraSmall,
                            color = MaterialTheme.colorScheme.errorContainer) {
                            Text("تعمیر", modifier = Modifier.padding(horizontal = 6.dp, vertical = 1.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.error)
                        }
                }
                Text(mehvar.name, style = MaterialTheme.typography.bodyMedium)
                if (mehvar.ostan.isNotEmpty())
                    Text(mehvar.ostan, style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline)
            }
            IconButton(onClick = { onEdit(mehvar) }) {
                Icon(Icons.Default.Edit, contentDescription = "ویرایش",
                    tint = MaterialTheme.colorScheme.primary)
            }
            IconButton(onClick = { onDelete(mehvar) }) {
                Icon(Icons.Default.Delete, contentDescription = "حذف",
                    tint = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
private fun MehvarDialog(
    title: String,
    initial: Mehvar? = null,
    onConfirm: (Int, String, Boolean, Boolean, String) -> Unit,
    onDismiss: () -> Unit
) {
    var code by remember { mutableStateOf(initial?.code?.toString() ?: "") }
    var name by remember { mutableStateOf(initial?.name ?: "") }
    var sendEnable by remember { mutableStateOf(initial?.send_enable == 1) }
    var repair by remember { mutableStateOf(initial?.repair == 1) }
    var ostan by remember { mutableStateOf(initial?.ostan ?: "") }
    var error by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = code, onValueChange = { code = it },
                    label = { Text("کد محور (RMTO)") }, singleLine = true,
                    enabled = initial == null, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = name, onValueChange = { name = it },
                    label = { Text("نام محور") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = ostan, onValueChange = { ostan = it },
                    label = { Text("استان") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth())
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Switch(checked = sendEnable, onCheckedChange = { sendEnable = it })
                    Spacer(Modifier.width(8.dp))
                    Text("ارسال فعال")
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Switch(checked = repair, onCheckedChange = { repair = it })
                    Spacer(Modifier.width(8.dp))
                    Text("در تعمیر")
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall) }
            }
        },
        confirmButton = {
            Button(onClick = {
                val codeInt = code.toIntOrNull()
                if (codeInt == null || codeInt <= 0) { error = "کد باید عدد مثبت باشد"; return@Button }
                if (name.isBlank()) { error = "نام الزامی است"; return@Button }
                onConfirm(codeInt, name.trim(), sendEnable, repair, ostan.trim())
            }) { Text("ذخیره") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } }
    )
}
