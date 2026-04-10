package ir.tcmanager.ui.screens

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ir.tcmanager.data.NetworkClient
import ir.tcmanager.data.PreferencesManager
import ir.tcmanager.data.models.HistoryRecord
import ir.tcmanager.data.models.RmtoLog
import kotlinx.coroutines.launch

class RmtoLogsViewModel(private val prefs: PreferencesManager) : ViewModel() {

    var logs by mutableStateOf<List<RmtoLog>>(emptyList())
    var history by mutableStateOf<List<HistoryRecord>>(emptyList())
    var isLoading by mutableStateOf(false)
    var errorMessage by mutableStateOf<String?>(null)
    var filter by mutableStateOf("all") // all | success | error
    var activeTab by mutableStateOf(0) // 0=logs 1=history

    fun load() {
        viewModelScope.launch {
            isLoading = true; errorMessage = null
            try {
                val api = NetworkClient.createApi(prefs.baseUrl())
                val logResp = api.getRmtoLogs(filter = filter)
                val histResp = api.getHistory()
                if (logResp.isSuccessful) logs = logResp.body() ?: emptyList()
                if (histResp.isSuccessful) history = histResp.body()?.rows ?: emptyList()
            } catch (e: Exception) { errorMessage = "خطا: ${e.message}" }
            finally { isLoading = false }
        }
    }

    fun setFilter(f: String) {
        filter = f; load()
    }
}
