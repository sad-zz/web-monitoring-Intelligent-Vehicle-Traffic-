package ir.tcmanager.data.models

data class Stats(
    val totalDevices: Int = 0,
    val onlineDevices: Int = 0,
    val todayVehicles: Long = 0,
    val unsentRMTO: Int = 0,
    val unsentRMTO5: Int = 0
)

data class LiveEntry(
    val device_code: String = "",
    val type: String = "",
    val msg: String = "",
    val time: String = ""
)
