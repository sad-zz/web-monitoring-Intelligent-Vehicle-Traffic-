package ir.noavaran.tcmanager

import android.content.Context
import android.content.SharedPreferences

/**
 * تنظیمات برنامه — در حافظه خصوصی اپ (MODE_PRIVATE) ذخیره می‌شود.
 */
class Prefs(context: Context) {
    private val sp: SharedPreferences =
        context.getSharedPreferences("tcmanager", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = sp.getString("server_url", "") ?: ""
        set(v) = sp.edit().putString("server_url", v.trim().trimEnd('/')).apply()

    var serverUser: String
        get() = sp.getString("server_user", "admin") ?: ""
        set(v) = sp.edit().putString("server_user", v.trim()).apply()

    var serverPass: String
        get() = sp.getString("server_pass", "") ?: ""
        set(v) = sp.edit().putString("server_pass", v).apply()

    var rmtoUrl: String
        get() = sp.getString("rmto_url", "http://otf.rmto.ir") ?: ""
        set(v) = sp.edit().putString("rmto_url", v.trim()).apply()

    var rmtoUser: String
        get() = sp.getString("rmto_user", "") ?: ""
        set(v) = sp.edit().putString("rmto_user", v.trim()).apply()

    var rmtoPass: String
        get() = sp.getString("rmto_pass", "") ?: ""
        set(v) = sp.edit().putString("rmto_pass", v).apply()

    var baudRate: Int
        get() = sp.getInt("baud", 115200)
        set(v) = sp.edit().putInt("baud", v).apply()

    var tcpHost: String
        get() = sp.getString("tcp_host", "192.168.4.1") ?: ""
        set(v) = sp.edit().putString("tcp_host", v.trim()).apply()

    var tcpPort: Int
        get() = sp.getInt("tcp_port", 23)
        set(v) = sp.edit().putInt("tcp_port", v).apply()
}
