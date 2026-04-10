package ir.tcmanager.ui.screens

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ir.tcmanager.data.NetworkClient
import ir.tcmanager.data.PreferencesManager
import ir.tcmanager.data.models.TestScheduleJob
import ir.tcmanager.data.models.TestScheduleRequest
import ir.tcmanager.data.models.TestSendRequest
import ir.tcmanager.data.models.TestSendResponse
import kotlinx.coroutines.launch

class TestToolsViewModel(private val prefs: PreferencesManager) : ViewModel() {

    // Test Send fields
    var rid by mutableStateOf("")
    var vehicles by mutableStateOf("100")
    var avgSpeed by mutableStateOf("80")

    // Test Schedule fields
    var scheduleRid by mutableStateOf("")
    var scheduleDays by mutableStateOf("1")
    var scheduleVehicles by mutableStateOf("100")
    var scheduleSpeed by mutableStateOf("80")
    var scheduleJobs by mutableStateOf<List<TestScheduleJob>>(emptyList())

    // TCP Send fields
    var tcpDeviceCode by mutableStateOf("")
    var tcpCommand by mutableStateOf("")

    var isLoading by mutableStateOf(false)
    var errorMessage by mutableStateOf<String?>(null)
    var successMessage by mutableStateOf<String?>(null)
    var testSendResult by mutableStateOf<TestSendResponse?>(null)

    fun sendTest() {
        val ridInt = rid.toIntOrNull() ?: run { errorMessage = "کد محور (RID) معتبر نیست"; return }
        viewModelScope.launch {
            isLoading = true; errorMessage = null; testSendResult = null
            try {
                val resp = NetworkClient.createApi(prefs.baseUrl()).testSend(
                    TestSendRequest(ridInt, vehicles.toIntOrNull() ?: 100, avgSpeed.toIntOrNull() ?: 80)
                )
                if (resp.isSuccessful) testSendResult = resp.body()
                else errorMessage = "خطا در ارسال تست (${resp.code()})"
            } catch (e: Exception) { errorMessage = "خطا: ${e.message}" }
            finally { isLoading = false }
        }
    }

    fun startSchedule() {
        val ridInt = scheduleRid.toIntOrNull() ?: run { errorMessage = "کد محور معتبر نیست"; return }
        viewModelScope.launch {
            isLoading = true; errorMessage = null
            try {
                val resp = NetworkClient.createApi(prefs.baseUrl()).startTestSchedule(
                    TestScheduleRequest(ridInt, scheduleDays.toIntOrNull() ?: 1,
                        scheduleVehicles.toIntOrNull() ?: 100, scheduleSpeed.toIntOrNull() ?: 80)
                )
                if (resp.isSuccessful) { successMessage = resp.body()?.message ?: "زمان‌بندی شروع شد"; loadScheduleJobs() }
                else errorMessage = "خطا در زمان‌بندی"
            } catch (e: Exception) { errorMessage = "خطا: ${e.message}" }
            finally { isLoading = false }
        }
    }

    fun loadScheduleJobs() {
        viewModelScope.launch {
            try {
                val resp = NetworkClient.createApi(prefs.baseUrl()).getTestScheduleJobs()
                if (resp.isSuccessful) scheduleJobs = resp.body() ?: emptyList()
            } catch (_: Exception) {}
        }
    }

    fun stopSchedule(jobId: String) {
        viewModelScope.launch {
            try {
                NetworkClient.createApi(prefs.baseUrl()).stopTestSchedule(jobId)
                successMessage = "زمان‌بندی متوقف شد"
                loadScheduleJobs()
            } catch (e: Exception) { errorMessage = "خطا: ${e.message}" }
        }
    }

    fun sendTcpCommand() {
        val code = tcpDeviceCode.trim()
        val cmd = tcpCommand.trim()
        if (code.isEmpty() || cmd.isEmpty()) { errorMessage = "کد دستگاه و دستور الزامی است"; return }
        viewModelScope.launch {
            isLoading = true; errorMessage = null
            try {
                val resp = NetworkClient.createApi(prefs.baseUrl())
                    .tcpSend(mapOf("device_code" to code, "command" to cmd))
                if (resp.isSuccessful) successMessage = "ارسال شد: ${resp.body()?.message ?: cmd}"
                else errorMessage = "خطا: ${resp.body()?.error ?: resp.code().toString()}"
            } catch (e: Exception) { errorMessage = "خطا: ${e.message}" }
            finally { isLoading = false }
        }
    }
}
