package ir.tcmanager.data.models

import com.google.gson.annotations.SerializedName

data class Device(
    val device_code: String = "",
    val name: String = "",
    val type: String = "sensor",
    val route: String = "",
    val route1: String = "",
    val route2: String = "",
    val rid1: String = "",
    val rid2: String = "",
    val ip: String = "",
    val status: String = "offline",
    val firmware: String = "",
    val active: Int = 1,
    val last_seen: String? = null
)

data class DeviceRequest(
    val device_code: String,
    val name: String,
    val type: String = "sensor",
    val route1: String = "",
    val route2: String = "",
    val rid1: String = "",
    val rid2: String = "",
    val ip: String = "",
    val firmware: String = "",
    val active: Int = 1
)

data class TcpConnectedDevice(
    val device_code: String,
    val ip: String,
    val connected: Boolean
)

data class SimpleResponse(val success: Boolean, val message: String? = null, val error: String? = null)
