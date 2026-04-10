package ir.tcmanager.ui.screens

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ir.tcmanager.data.NetworkClient
import ir.tcmanager.data.PreferencesManager
import ir.tcmanager.data.models.Device
import ir.tcmanager.data.models.DeviceRequest
import ir.tcmanager.data.models.TcpConnectedDevice
import kotlinx.coroutines.launch

class DevicesViewModel(private val prefs: PreferencesManager) : ViewModel() {

    var devices by mutableStateOf<List<Device>>(emptyList())
    var tcpConnected by mutableStateOf<List<TcpConnectedDevice>>(emptyList())
    var isLoading by mutableStateOf(false)
    var errorMessage by mutableStateOf<String?>(null)
    var successMessage by mutableStateOf<String?>(null)

    fun load() {
        viewModelScope.launch {
            isLoading = true; errorMessage = null
            try {
                val api = NetworkClient.createApi(prefs.baseUrl())
                val devResp = api.getDevices()
                val tcpResp = api.getTcpConnected()
                if (devResp.isSuccessful) devices = devResp.body() ?: emptyList()
                if (tcpResp.isSuccessful) tcpConnected = tcpResp.body() ?: emptyList()
            } catch (e: Exception) { errorMessage = "خطا: ${e.message}" }
            finally { isLoading = false }
        }
    }

    fun isTcpConnected(code: String) = tcpConnected.any { it.device_code == code && it.connected }

    fun create(req: DeviceRequest, onDone: () -> Unit) {
        viewModelScope.launch {
            try {
                val resp = NetworkClient.createApi(prefs.baseUrl()).createDevice(req)
                if (resp.isSuccessful) { successMessage = "دستگاه افزوده شد"; load(); onDone() }
                else errorMessage = resp.body()?.error ?: "خطا در ایجاد دستگاه"
            } catch (e: Exception) { errorMessage = "خطا: ${e.message}" }
        }
    }

    fun update(code: String, req: DeviceRequest, onDone: () -> Unit) {
        viewModelScope.launch {
            try {
                val resp = NetworkClient.createApi(prefs.baseUrl()).updateDevice(code, req)
                if (resp.isSuccessful) { successMessage = "دستگاه ویرایش شد"; load(); onDone() }
                else errorMessage = "خطا در ویرایش"
            } catch (e: Exception) { errorMessage = "خطا: ${e.message}" }
        }
    }

    fun delete(code: String, onDone: () -> Unit) {
        viewModelScope.launch {
            try {
                NetworkClient.createApi(prefs.baseUrl()).deleteDevice(code)
                successMessage = "دستگاه حذف شد"; load(); onDone()
            } catch (e: Exception) { errorMessage = "خطا: ${e.message}" }
        }
    }

    fun syncTime(code: String) {
        viewModelScope.launch {
            try {
                val resp = NetworkClient.createApi(prefs.baseUrl())
                    .syncTime(mapOf("device_code" to code))
                successMessage = resp.body()?.message ?: "تنظیم ساعت ارسال شد"
            } catch (e: Exception) { errorMessage = "خطا: ${e.message}" }
        }
    }

    fun pollDevice(code: String) {
        viewModelScope.launch {
            try {
                val resp = NetworkClient.createApi(prefs.baseUrl())
                    .pollDevice(mapOf("device_code" to code))
                successMessage = resp.body()?.message ?: "درخواست داده ارسال شد"
            } catch (e: Exception) { errorMessage = "خطا: ${e.message}" }
        }
    }
}
