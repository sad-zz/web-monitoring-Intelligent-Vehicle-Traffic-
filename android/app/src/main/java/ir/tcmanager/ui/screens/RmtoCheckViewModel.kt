package ir.tcmanager.ui.screens

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ir.tcmanager.data.NetworkClient
import ir.tcmanager.data.PreferencesManager
import ir.tcmanager.data.models.ConnectivityCheck
import ir.tcmanager.data.models.RmtoQueueStats
import kotlinx.coroutines.launch

class RmtoCheckViewModel(private val prefs: PreferencesManager) : ViewModel() {

    var connectivityResult by mutableStateOf<ConnectivityCheck?>(null)
    var queueStats by mutableStateOf<RmtoQueueStats?>(null)
    var isChecking by mutableStateOf(false)
    var isLoadingQueue by mutableStateOf(false)
    var errorMessage by mutableStateOf<String?>(null)

    fun runConnectivityCheck() {
        viewModelScope.launch {
            isChecking = true; errorMessage = null
            try {
                val resp = NetworkClient.createApi(prefs.baseUrl()).connectivityCheck()
                if (resp.isSuccessful) connectivityResult = resp.body()
                else errorMessage = "خطا در بررسی اتصال (${resp.code()})"
            } catch (e: Exception) { errorMessage = "خطا: ${e.message}" }
            finally { isChecking = false }
        }
    }

    fun loadQueueStats() {
        viewModelScope.launch {
            isLoadingQueue = true
            try {
                val resp = NetworkClient.createApi(prefs.baseUrl()).getRmtoQueue()
                if (resp.isSuccessful) queueStats = resp.body()
            } catch (e: Exception) { errorMessage = "خطا: ${e.message}" }
            finally { isLoadingQueue = false }
        }
    }
}
