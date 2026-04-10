package ir.tcmanager.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ir.tcmanager.data.models.ConnectivityResult
import ir.tcmanager.ui.components.ErrorCard
import ir.tcmanager.ui.components.LoadingBox
import ir.tcmanager.ui.theme.OfflineRed
import ir.tcmanager.ui.theme.OnlineGreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RmtoCheckScreen(vm: RmtoCheckViewModel) {
    LaunchedEffect(Unit) { vm.loadQueueStats() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("چک وضعیت RMTO") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary)
            )
        }
    ) { padding ->
        LazyColumn(
            contentPadding = PaddingValues(
                top = padding.calculateTopPadding() + 12.dp,
                bottom = 16.dp, start = 12.dp, end = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Connectivity check section
            item {
                Card(elevation = CardDefaults.cardElevation(2.dp)) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("بررسی اتصال به سرور RMTO",
                            style = MaterialTheme.typography.titleMedium)

                        vm.connectivityResult?.let { result ->
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("هاست:", style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.outline)
                                Text("${result.host}:${result.port}",
                                    style = MaterialTheme.typography.bodySmall)
                            }
                            Text(result.url, style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.outline)
                        }

                        Button(
                            onClick = { vm.runConnectivityCheck() },
                            enabled = !vm.isChecking,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            if (vm.isChecking) {
                                CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp,
                                    color = MaterialTheme.colorScheme.onPrimary)
                                Spacer(Modifier.width(8.dp))
                                Text("در حال بررسی…")
                            } else {
                                Icon(Icons.Default.Refresh, contentDescription = null)
                                Spacer(Modifier.width(8.dp))
                                Text("بررسی اتصال")
                            }
                        }
                    }
                }
            }

            vm.errorMessage?.let { item { ErrorCard(it) } }

            // Results
            vm.connectivityResult?.let { result ->
                items(result.checks) { check ->
                    ConnectivityResultCard(check)
                }
                item {
                    Text("بررسی در: ${result.checkedAt}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.outline,
                        modifier = Modifier.padding(horizontal = 4.dp))
                }
            }

            // Queue stats
            item {
                Card(elevation = CardDefaults.cardElevation(2.dp)) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()) {
                            Text("صف ارسال RMTO", style = MaterialTheme.typography.titleMedium)
                            IconButton(onClick = { vm.loadQueueStats() }) {
                                Icon(Icons.Default.Refresh, contentDescription = "بروزرسانی")
                            }
                        }
                        if (vm.isLoadingQueue) {
                            LoadingBox()
                        }
                        vm.queueStats?.let { q ->
                            QueueStatRow("در صف (ارسال‌نشده)", q.unsent.size.toString(),
                                if (q.unsent.isEmpty()) OnlineGreen else OfflineRed)
                            QueueStatRow("ارسال شده (آخرین ۵۰)", q.sent.size.toString(), OnlineGreen)
                            QueueStatRow("خطاهای امروز", q.todayErrors.toString(),
                                if (q.todayErrors == 0) OnlineGreen else OfflineRed)
                            QueueStatRow("کل خطاها", q.errorCount.toString(),
                                if (q.errorCount == 0) OnlineGreen else OfflineRed)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ConnectivityResultCard(result: ConnectivityResult) {
    val color = if (result.ok) OnlineGreen else OfflineRed
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.08f))
    ) {
        Row(
            Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                if (result.ok) Icons.Default.Check else Icons.Default.Close,
                contentDescription = null, tint = color
            )
            Column(Modifier.weight(1f)) {
                Text(result.label, style = MaterialTheme.typography.bodyMedium)
                Text("IP: ${result.ip}", style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline)
                if (result.ok) {
                    Text("تأخیر: ${result.latencyMs} ms", style = MaterialTheme.typography.bodySmall,
                        color = OnlineGreen)
                } else {
                    Text(result.error ?: "خطا", style = MaterialTheme.typography.bodySmall,
                        color = OfflineRed)
                }
            }
        }
    }
}

@Composable
private fun QueueStatRow(label: String, value: String, valueColor: androidx.compose.ui.graphics.Color) {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium)
        Text(value, style = MaterialTheme.typography.titleMedium, color = valueColor)
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 0.5.dp)
}
