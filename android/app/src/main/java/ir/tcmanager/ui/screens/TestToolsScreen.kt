package ir.tcmanager.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import ir.tcmanager.ui.components.ErrorCard
import ir.tcmanager.ui.components.SuccessCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TestToolsScreen(vm: TestToolsViewModel) {
    LaunchedEffect(Unit) { vm.loadScheduleJobs() }

    var activeTab by remember { mutableStateOf(0) }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("ابزار تست") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary))
        }
    ) { padding ->
        Column(Modifier.padding(top = padding.calculateTopPadding())) {
            TabRow(selectedTabIndex = activeTab) {
                Tab(selected = activeTab == 0, onClick = { activeTab = 0 },
                    text = { Text("ارسال تست RMTO") })
                Tab(selected = activeTab == 1, onClick = { activeTab = 1 },
                    text = { Text("زمان‌بندی تست") })
                Tab(selected = activeTab == 2, onClick = { activeTab = 2 },
                    text = { Text("دستور TCP") })
            }
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                vm.errorMessage?.let { ErrorCard(it) }
                vm.successMessage?.let { SuccessCard(it) }

                when (activeTab) {
                    0 -> TestSendTab(vm)
                    1 -> ScheduleTab(vm)
                    2 -> TcpSendTab(vm)
                }
            }
        }
    }
}

@Composable
private fun TestSendTab(vm: TestToolsViewModel) {
    Text("ارسال تست مستقیم به RMTO", style = MaterialTheme.typography.titleSmall)
    OutlinedTextField(value = vm.rid, onValueChange = { vm.rid = it },
        label = { Text("کد محور (RID)") }, singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth())
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(value = vm.vehicles, onValueChange = { vm.vehicles = it },
            label = { Text("وسایل نقلیه") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.weight(1f))
        OutlinedTextField(value = vm.avgSpeed, onValueChange = { vm.avgSpeed = it },
            label = { Text("سرعت میانگین") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.weight(1f))
    }
    Button(onClick = { vm.sendTest() }, enabled = !vm.isLoading,
        modifier = Modifier.fillMaxWidth()) {
        if (vm.isLoading) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
        else Text("اجرای تست ارسال")
    }
    vm.testSendResult?.let { result ->
        Card(colors = CardDefaults.cardColors(
            containerColor = if (result.success) MaterialTheme.colorScheme.primaryContainer
            else MaterialTheme.colorScheme.errorContainer)) {
            Column(Modifier.padding(12.dp)) {
                Text("نتیجه:", style = MaterialTheme.typography.titleSmall)
                Text("موفق: ${result.sent_success} | ناموفق: ${result.sent_failed}")
                if (result.errors.isNotEmpty()) {
                    Text("خطاها:", style = MaterialTheme.typography.labelSmall)
                    result.errors.take(3).forEach { e ->
                        Text(e.values.joinToString(), style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
    }
}

@Composable
private fun ScheduleTab(vm: TestToolsViewModel) {
    Text("زمان‌بندی ارسال خودکار (هر ۵ دقیقه)", style = MaterialTheme.typography.titleSmall)
    OutlinedTextField(value = vm.scheduleRid, onValueChange = { vm.scheduleRid = it },
        label = { Text("کد محور (RID)") }, singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth())
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(value = vm.scheduleDays, onValueChange = { vm.scheduleDays = it },
            label = { Text("مدت (روز)") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.weight(1f))
        OutlinedTextField(value = vm.scheduleVehicles, onValueChange = { vm.scheduleVehicles = it },
            label = { Text("وسایل نقلیه") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.weight(1f))
    }
    Button(onClick = { vm.startSchedule() }, enabled = !vm.isLoading,
        modifier = Modifier.fillMaxWidth()) {
        Text("شروع زمان‌بندی")
    }
    if (vm.scheduleJobs.isNotEmpty()) {
        Text("جاب‌های فعال:", style = MaterialTheme.typography.titleSmall)
        vm.scheduleJobs.forEach { job ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(10.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text("RID: ${job.rid}  |  وضعیت: ${job.status}",
                            style = MaterialTheme.typography.bodySmall)
                        Text("ارسال شده: ${job.sentCount}  |  ${job.durationDays} روز",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.outline)
                    }
                    TextButton(onClick = { vm.stopSchedule(job.jobId) }) {
                        Text("توقف", color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
    }
}

@Composable
private fun TcpSendTab(vm: TestToolsViewModel) {
    Text("ارسال دستور مستقیم TCP به دستگاه", style = MaterialTheme.typography.titleSmall)
    OutlinedTextField(value = vm.tcpDeviceCode, onValueChange = { vm.tcpDeviceCode = it },
        label = { Text("کد دستگاه") }, singleLine = true,
        modifier = Modifier.fillMaxWidth())
    OutlinedTextField(value = vm.tcpCommand, onValueChange = { vm.tcpCommand = it },
        label = { Text("دستور (مثلاً 0012yyMMddHHmmss)") }, singleLine = true,
        modifier = Modifier.fillMaxWidth())
    // Quick command buttons
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        ir.tcmanager.domain.Ratcx1Parser.let { p ->
            OutlinedButton(onClick = { vm.tcpCommand = p.buildTimeSync() }) { Text("0012") }
            OutlinedButton(onClick = { vm.tcpCommand = p.buildPoll() }) { Text("0197") }
        }
    }
    Button(onClick = { vm.sendTcpCommand() }, enabled = !vm.isLoading,
        modifier = Modifier.fillMaxWidth()) {
        if (vm.isLoading) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
        else Text("ارسال دستور")
    }
}
