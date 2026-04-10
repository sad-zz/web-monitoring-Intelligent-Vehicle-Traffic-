package ir.tcmanager.data.models

data class Mehvar(
    val code: Int = 0,
    val name: String = "",
    val send_enable: Int = 1,
    val repair: Int = 0,
    val ostan: String = ""
)

data class MehvarRequest(
    val code: Int,
    val name: String,
    val send_enable: Int = 1,
    val repair: Int = 0,
    val ostan: String = ""
)
