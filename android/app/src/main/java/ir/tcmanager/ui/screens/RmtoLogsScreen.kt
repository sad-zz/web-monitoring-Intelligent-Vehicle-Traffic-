package ir.tcmanager.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import ir.tcmanager.data.models.HistoryRecord
import ir.tcmanager.data.models.RmtoLog
import ir.tcmanager.ui.components.ErrorCard
import ir.tcmanager.ui.components.LoadingBox
import ir.tcmanager.ui.theme.OfflineRed
import ir.tcmanager.ui.theme.OnlineGreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RmtoLogsScreen(vm: RmtoLogsViewModel) {
    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("لاگ‌های RMTO") },
                actions = {
                    IconButton(onClick = { vm.load() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "بروزرسانی",
                            tint = MaterialTheme.colorScheme.onPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary)
            )
        }
    ) { padding ->
        Column(Modifier.padding(top = padding.calculateTopPadding())) {
            // Tabs
            TabRow(selectedTabIndex = vm.activeTab) {
                Tab(selected = vm.activeTab == 0, onClick = { vm.activeTab = 0; vm.load() },
                    text = { Text("لاگ ارسال") })
                Tab(selected = vm.activeTab == 1, onClick = { vm.activeTab = 1; vm.load() },
                    text = { Text("تاریخچه") })
            }

            // Filter chips (only on logs tab)
            if (vm.activeTab == 0) {
                Row(Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("all" to "همه", "success" to "موفق", "error" to "خطا").forEach { (key, label) ->
                        FilterChip(selected = vm.filter == key,
                            onClick = { vm.setFilter(key) },
                            label = { Text(label) })
                    }
                }
            }

            vm.errorMessage?.let { ErrorCard(it, onRetry = { vm.load() }) }
            if (vm.isLoading) LoadingBox()

            LazyColumn(
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                if (vm.activeTab == 0) {
                    items(vm.logs) { log -> RmtoLogCard(log) }
                } else {
                    items(vm.history) { record -> HistoryCard(record) }
                }
            }
        }
    }
}

@Composable
private fun RmtoLogCard(log: RmtoLog) {
    val isSuccess = log.success == 1
    val borderColor = if (isSuccess) OnlineGreen else OfflineRed
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = borderColor.copy(alpha = 0.06f))
    ) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(if (isSuccess) "✓ موفق" else "✗ خطا",
                    color = borderColor, style = MaterialTheme.typography.labelMedium)
                Text(log.device_code, style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary)
                Text("محور: ${log.route_code}", style = MaterialTheme.typography.labelSmall)
            }
            log.period_start?.let {
                Text("بازه: $it", style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline)
            }
            log.total_vehicles?.let {
                Text("وسایل: $it  |  سرعت: ${log.avg_speed ?: 0}",
                    style = MaterialTheme.typography.bodySmall)
            }
            if (!isSuccess && !log.error_message.isNullOrEmpty()) {
                Text(log.error_message, style = MaterialTheme.typography.bodySmall,
                    color = OfflineRed)
            }
            Text(log.created_at, style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.outline)
        }
    }
}

@Composable
private fun HistoryCard(record: HistoryRecord) {
    val sent = record.sent == 1
    Card(modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (sent) OnlineGreen.copy(alpha = 0.06f)
            else MaterialTheme.colorScheme.surfaceVariant)) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(record.device_code, style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary)
                Text("محور: ${record.route_code}", style = MaterialTheme.typography.labelSmall)
                Text(if (sent) "ارسال شد" else "در صف",
                    color = if (sent) OnlineGreen else Color(0xFFE65100),
                    style = MaterialTheme.typography.labelSmall)
            }
            Text("بازه: ${record.period_start} ← ${record.period_end}",
                style = MaterialTheme.typography.bodySmall)
            Text("وسایل: ${record.total_vehicles}  |  سرعت: ${record.avg_speed} km/h",
                style = MaterialTheme.typography.bodySmall)
        }
    }
}
