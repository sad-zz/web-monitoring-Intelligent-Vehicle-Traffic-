package ir.tcmanager.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ir.tcmanager.ui.components.ErrorCard
import ir.tcmanager.ui.components.LoadingBox
import ir.tcmanager.ui.theme.OfflineRed
import ir.tcmanager.ui.theme.OnlineGreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(vm: HomeViewModel) {
    LaunchedEffect(Unit) { vm.startAutoRefresh() }
    DisposableEffect(Unit) { onDispose { vm.stopAutoRefresh() } }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("داشبورد") },
                actions = {
                    vm.lastUpdated?.let {
                        Text(it, style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(end = 8.dp))
                    }
                    IconButton(onClick = { vm.refresh() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "بروزرسانی")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { padding ->
        LazyColumn(
            contentPadding = PaddingValues(
                top = padding.calculateTopPadding() + 8.dp,
                bottom = 16.dp,
                start = 12.dp, end = 12.dp
            ),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (vm.isLoading && vm.stats == null) {
                item { LoadingBox() }
            }
            vm.errorMessage?.let { msg ->
                item { ErrorCard(msg, onRetry = { vm.refresh() }) }
            }
            vm.stats?.let { stats ->
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatCard(
                            label = "دستگاه‌ها",
                            value = stats.totalDevices.toString(),
                            modifier = Modifier.weight(1f)
                        )
                        StatCard(
                            label = "آنلاین",
                            value = stats.onlineDevices.toString(),
                            valueColor = if (stats.onlineDevices > 0) OnlineGreen else OfflineRed,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatCard(
                            label = "وسایل نقلیه امروز",
                            value = stats.todayVehicles.toString(),
                            modifier = Modifier.weight(1f)
                        )
                        StatCard(
                            label = "صف RMTO",
                            value = stats.unsentRMTO.toString(),
                            valueColor = if (stats.unsentRMTO > 0) OfflineRed else OnlineGreen,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                item { Spacer(Modifier.height(4.dp)) }
                item { Text("رفرش خودکار هر ۳۰ ثانیه", style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline,
                    modifier = Modifier.padding(horizontal = 4.dp)) }
            }
            if (vm.liveLog.isNotEmpty()) {
                item {
                    Text("لاگ زنده", style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp))
                }
                items(vm.liveLog.take(20)) { entry ->
                    LiveLogRow(entry)
                }
            }
        }
    }
}

@Composable
private fun StatCard(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    valueColor: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onSurface
) {
    Card(modifier = modifier, elevation = CardDefaults.cardElevation(2.dp)) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(value, style = MaterialTheme.typography.headlineMedium, color = valueColor)
            Text(label, style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.outline)
        }
    }
}

@Composable
private fun LiveLogRow(entry: ir.tcmanager.data.models.LiveEntry) {
    val typeColor = when (entry.type) {
        "error" -> OfflineRed
        "warn" -> androidx.compose.ui.graphics.Color(0xFFE65100)
        "info" -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Row(
            Modifier.fillMaxWidth().padding(8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(entry.device_code, style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary, modifier = Modifier.width(64.dp))
            Text(entry.msg, style = MaterialTheme.typography.bodySmall,
                color = typeColor, modifier = Modifier.weight(1f))
        }
    }
}
