package ir.tcmanager.data

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit

class PreferencesManager(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, "") ?: ""
        set(value) = prefs.edit { putString(KEY_SERVER_URL, value) }

    var savedUsername: String
        get() = prefs.getString(KEY_USERNAME, "") ?: ""
        set(value) = prefs.edit { putString(KEY_USERNAME, value) }

    /** Build the base URL ensuring it ends with "/" */
    fun baseUrl(): String {
        val raw = serverUrl.trim()
        if (raw.isEmpty()) return ""
        val withScheme = if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
            "http://$raw"
        } else raw
        return if (withScheme.endsWith("/")) withScheme else "$withScheme/"
    }

    companion object {
        private const val PREF_FILE = "tc_manager_prefs"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_USERNAME = "username"
    }
}
