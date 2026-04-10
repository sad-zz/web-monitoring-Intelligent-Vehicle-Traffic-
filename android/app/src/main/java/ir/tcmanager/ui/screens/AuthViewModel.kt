package ir.tcmanager.ui.screens

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ir.tcmanager.data.NetworkClient
import ir.tcmanager.data.PreferencesManager
import kotlinx.coroutines.launch

class AuthViewModel(private val prefs: PreferencesManager) : ViewModel() {

    var serverUrl by mutableStateOf(prefs.serverUrl)
    var username by mutableStateOf(prefs.savedUsername)
    var password by mutableStateOf("")
    var isLoading by mutableStateOf(false)
    var errorMessage by mutableStateOf<String?>(null)
    var isLoggedIn by mutableStateOf(false)
    var loggedInUser by mutableStateOf<String?>(null)

    fun checkSession() {
        val base = prefs.baseUrl()
        if (base.isEmpty()) return
        viewModelScope.launch {
            try {
                val api = NetworkClient.createApi(base)
                val resp = api.checkAuth()
                if (resp.isSuccessful && resp.body()?.loggedIn == true) {
                    isLoggedIn = true
                    loggedInUser = resp.body()?.username
                }
            } catch (_: Exception) {}
        }
    }

    fun login(onSuccess: () -> Unit) {
        val trimmedUrl = serverUrl.trim()
        if (trimmedUrl.isEmpty()) { errorMessage = "آدرس سرور را وارد کنید"; return }
        if (username.isEmpty()) { errorMessage = "نام کاربری را وارد کنید"; return }
        if (password.isEmpty()) { errorMessage = "رمز عبور را وارد کنید"; return }

        prefs.serverUrl = trimmedUrl
        prefs.savedUsername = username
        errorMessage = null
        isLoading = true

        viewModelScope.launch {
            try {
                val api = NetworkClient.createApi(prefs.baseUrl())
                val resp = api.login(mapOf("username" to username, "password" to password))
                if (resp.isSuccessful && resp.body()?.success == true) {
                    isLoggedIn = true
                    loggedInUser = resp.body()?.username
                    onSuccess()
                } else {
                    errorMessage = "نام کاربری یا رمز عبور اشتباه است"
                }
            } catch (e: Exception) {
                errorMessage = "خطا در اتصال به سرور: ${e.message}"
            } finally {
                isLoading = false
            }
        }
    }

    fun logout(onDone: () -> Unit) {
        viewModelScope.launch {
            try {
                val api = NetworkClient.createApi(prefs.baseUrl())
                api.logout()
            } catch (_: Exception) {}
            NetworkClient.clearCookies()
            isLoggedIn = false
            loggedInUser = null
            password = ""
            onDone()
        }
    }
}
