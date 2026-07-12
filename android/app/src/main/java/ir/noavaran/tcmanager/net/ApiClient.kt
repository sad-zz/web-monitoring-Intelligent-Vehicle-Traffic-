package ir.noavaran.tcmanager.net

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.CookieHandler
import java.net.CookieManager
import java.net.CookiePolicy
import java.net.HttpURLConnection
import java.net.URL

/**
 * کلاینت REST سرور TC Manager (server/index.js).
 * لاگین سشن-کوکی: POST /api/auth/login و نگهداری کوکی connect.sid
 */
object ApiClient {

    init {
        if (CookieHandler.getDefault() == null) {
            CookieHandler.setDefault(CookieManager(null, CookiePolicy.ACCEPT_ALL))
        }
    }

    class ApiException(message: String) : Exception(message)

    private fun open(base: String, path: String, method: String): HttpURLConnection {
        val conn = URL(base + path).openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = 10000
        conn.readTimeout = 15000
        conn.setRequestProperty("Accept", "application/json")
        return conn
    }

    private fun readBody(conn: HttpURLConnection): String {
        val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
        return stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
    }

    private fun errorMessage(body: String, code: Int): String {
        return try {
            JSONObject(body).optString("error", "HTTP $code")
        } catch (e: Exception) {
            "HTTP $code"
        }
    }

    suspend fun login(base: String, username: String, password: String) =
        withContext(Dispatchers.IO) {
            val conn = open(base, "/api/auth/login", "POST")
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            val payload = JSONObject().put("username", username).put("password", password)
            conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val body = readBody(conn)
            if (conn.responseCode !in 200..299) {
                throw ApiException(errorMessage(body, conn.responseCode))
            }
        }

    suspend fun getArray(base: String, path: String): JSONArray =
        withContext(Dispatchers.IO) {
            val conn = open(base, path, "GET")
            val body = readBody(conn)
            if (conn.responseCode !in 200..299) {
                throw ApiException(errorMessage(body, conn.responseCode))
            }
            JSONArray(body)
        }

    suspend fun getObject(base: String, path: String): JSONObject =
        withContext(Dispatchers.IO) {
            val conn = open(base, path, "GET")
            val body = readBody(conn)
            if (conn.responseCode !in 200..299) {
                throw ApiException(errorMessage(body, conn.responseCode))
            }
            JSONObject(body)
        }

    suspend fun postObject(base: String, path: String, payload: JSONObject): JSONObject =
        withContext(Dispatchers.IO) {
            val conn = open(base, path, "POST")
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val body = readBody(conn)
            if (conn.responseCode !in 200..299) {
                throw ApiException(errorMessage(body, conn.responseCode))
            }
            if (body.isBlank()) JSONObject() else JSONObject(body)
        }
}
