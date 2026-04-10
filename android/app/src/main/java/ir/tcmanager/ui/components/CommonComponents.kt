package ir.tcmanager.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ir.tcmanager.ui.theme.OfflineRed
import ir.tcmanager.ui.theme.OnlineGreen
import ir.tcmanager.ui.theme.WarningOrange

@Composable
fun LoadingBox(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}

@Composable
fun ErrorCard(message: String, onRetry: (() -> Unit)? = null) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(8.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(message, color = MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodyMedium)
            onRetry?.let {
                Spacer(Modifier.height(8.dp))
                TextButton(onClick = it) { Text("تلاش مجدد") }
            }
        }
    }
}

@Composable
fun SuccessCard(message: String) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(8.dp),
        colors = CardDefaults.cardColors(containerColor = OnlineGreen.copy(alpha = 0.12f))
    ) {
        Text(message, modifier = Modifier.padding(12.dp), color = OnlineGreen)
    }
}

@Composable
fun StatusBadge(status: String) {
    val (label, color) = when (status.lowercase()) {
        "online" -> "آنلاین" to OnlineGreen
        "offline" -> "آفلاین" to OfflineRed
        "warning" -> "هشدار" to WarningOrange
        "error" -> "خطا" to OfflineRed
        else -> status to MaterialTheme.colorScheme.outline
    }
    Surface(shape = MaterialTheme.shapes.small, color = color.copy(alpha = 0.15f)) {
        Text(label, modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
            color = color, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
fun SectionHeader(title: String) {
    Text(title, style = MaterialTheme.typography.titleMedium,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
}

@Composable
fun ConfirmDialog(
    title: String,
    message: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(message) },
        confirmButton = { TextButton(onClick = { onConfirm(); onDismiss() }) { Text("بله") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } }
    )
}
