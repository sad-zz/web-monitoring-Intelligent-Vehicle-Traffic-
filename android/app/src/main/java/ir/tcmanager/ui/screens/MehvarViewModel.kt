package ir.tcmanager.ui.screens

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ir.tcmanager.data.NetworkClient
import ir.tcmanager.data.PreferencesManager
import ir.tcmanager.data.models.Mehvar
import ir.tcmanager.data.models.MehvarRequest
import kotlinx.coroutines.launch

class MehvarViewModel(private val prefs: PreferencesManager) : ViewModel() {

    var list by mutableStateOf<List<Mehvar>>(emptyList())
    var isLoading by mutableStateOf(false)
    var errorMessage by mutableStateOf<String?>(null)
    var successMessage by mutableStateOf<String?>(null)

    fun load() {
        viewModelScope.launch {
            isLoading = true
            errorMessage = null
            try {
                val resp = NetworkClient.createApi(prefs.baseUrl()).getMehvarList()
                if (resp.isSuccessful) list = resp.body() ?: emptyList()
                else errorMessage = "خطا در بارگذاری محورها"
            } catch (e: Exception) {
                errorMessage = "خطا: ${e.message}"
            } finally { isLoading = false }
        }
    }

    fun create(code: Int, name: String, sendEnable: Boolean, repair: Boolean, ostan: String,
               onDone: () -> Unit) {
        viewModelScope.launch {
            try {
                val resp = NetworkClient.createApi(prefs.baseUrl()).createMehvar(
                    MehvarRequest(code, name, if (sendEnable) 1 else 0, if (repair) 1 else 0, ostan)
                )
                if (resp.isSuccessful) { successMessage = "محور افزوده شد"; load(); onDone() }
                else errorMessage = resp.body()?.error ?: "خطا در ایجاد محور"
            } catch (e: Exception) { errorMessage = "خطا: ${e.message}" }
        }
    }

    fun update(code: Int, name: String, sendEnable: Boolean, repair: Boolean, ostan: String,
               onDone: () -> Unit) {
        viewModelScope.launch {
            try {
                val resp = NetworkClient.createApi(prefs.baseUrl()).updateMehvar(
                    code, MehvarRequest(code, name, if (sendEnable) 1 else 0, if (repair) 1 else 0, ostan)
                )
                if (resp.isSuccessful) { successMessage = "محور ویرایش شد"; load(); onDone() }
                else errorMessage = "خطا در ویرایش"
            } catch (e: Exception) { errorMessage = "خطا: ${e.message}" }
        }
    }

    fun delete(code: Int, onDone: () -> Unit) {
        viewModelScope.launch {
            try {
                NetworkClient.createApi(prefs.baseUrl()).deleteMehvar(code)
                successMessage = "محور حذف شد"
                load()
                onDone()
            } catch (e: Exception) { errorMessage = "خطا: ${e.message}" }
        }
    }
}
