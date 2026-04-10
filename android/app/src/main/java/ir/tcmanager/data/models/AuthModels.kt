package ir.tcmanager.data.models

data class LoginRequest(val username: String, val password: String)
data class LoginResponse(val success: Boolean, val username: String? = null, val role: String? = null)
data class AuthCheckResponse(val loggedIn: Boolean, val username: String? = null, val role: String? = null)
