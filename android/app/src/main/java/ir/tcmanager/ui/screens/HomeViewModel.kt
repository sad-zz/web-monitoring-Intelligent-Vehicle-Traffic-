package ir.tcmanager.ui.screens

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ir.tcmanager.data.NetworkClient
import ir.tcmanager.data.PreferencesManager
import ir.tcmanager.data.models.LiveEntry
import ir.tcmanager.data.models.Stats
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class HomeViewModel(private val prefs: PreferencesManager) : ViewModel() {

    var stats by mutableStateOf<Stats?>(null)
    var liveLog by mutableStateOf<List<LiveEntry>>(emptyList())
    var isLoading by mutableStateOf(false)
    var errorMessage by mutableStateOf<String?>(null)
    var lastUpdated by mutableStateOf<String?>(null)

    private var refreshJob: Job? = null

    fun startAutoRefresh() {
        refreshJob?.cancel()
        refreshJob = viewModelScope.launch {
            while (isActive) {
                load()
                delay(30_000)
            }
        }
    }

    fun stopAutoRefresh() {
        refreshJob?.cancel()
        refreshJob = null
    }

    fun refresh() {
        viewModelScope.launch { load() }
    }

    private suspend fun load() {
        val base = prefs.baseUrl()
        if (base.isEmpty()) return
        isLoading = true
        errorMessage = null
        try {
            val api = NetworkClient.createApi(base)
            val statsResp = api.getStats()
            val liveResp = api.getLive()
            if (statsResp.isSuccessful) stats = statsResp.body()
            if (liveResp.isSuccessful) liveLog = liveResp.body() ?: emptyList()
            lastUpdated = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault())
                .format(java.util.Date())
        } catch (e: Exception) {
            errorMessage = "خطا: ${e.message}"
        } finally {
            isLoading = false
        }
    }

    override fun onCleared() {
        super.onCleared()
        stopAutoRefresh()
    }
}
