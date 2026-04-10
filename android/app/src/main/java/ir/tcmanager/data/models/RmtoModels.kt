package ir.tcmanager.data.models

data class RmtoLog(
    val id: Int = 0,
    val device_code: String = "",
    val route_code: String = "",
    val success: Int = 0,
    val error_message: String? = null,
    val rmto_response: String? = null,
    val created_at: String = "",
    val period_start: String? = null,
    val period_end: String? = null,
    val total_vehicles: Int? = null,
    val avg_speed: Int? = null
)

data class HistoryRecord(
    val id: Int = 0,
    val device_code: String = "",
    val route_code: String = "",
    val period_start: String = "",
    val period_end: String = "",
    val total_vehicles: Int = 0,
    val avg_speed: Int = 0,
    val sent: Int = 0,
    val sent_at: String? = null,
    val created_at: String = ""
)

data class HistoryResponse(
    val total: Int = 0,
    val page: Int = 1,
    val limit: Int = 50,
    val rows: List<HistoryRecord> = emptyList()
)

data class RmtoQueueStats(
    val unsent: List<Any> = emptyList(),
    val sent: List<Any> = emptyList(),
    val errorCount: Int = 0,
    val todayErrors: Int = 0
)

data class ConnectivityCheck(
    val host: String = "",
    val port: Int = 80,
    val url: String = "",
    val checks: List<ConnectivityResult> = emptyList(),
    val checkedAt: String = ""
)

data class ConnectivityResult(
    val label: String = "",
    val ip: String = "",
    val host: String = "",
    val port: Int = 80,
    val ok: Boolean = false,
    val latencyMs: Long? = null,
    val error: String? = null
)

data class TestSendRequest(
    val rid: Int,
    val vehicles: Int = 100,
    val avgSpeed: Int = 80,
    val startTime: String? = null,
    val endTime: String? = null
)

data class TestSendResponse(
    val success: Boolean = false,
    val total: Int = 0,
    val sent_success: Int = 0,
    val sent_failed: Int = 0,
    val errors: List<Map<String, String>> = emptyList()
)

data class TestScheduleRequest(
    val rid: Int,
    val durationDays: Int = 1,
    val vehicles: Int = 100,
    val avgSpeed: Int = 80
)

data class TestScheduleJob(
    val jobId: String = "",
    val rid: Int = 0,
    val status: String = "",
    val durationDays: Int = 1,
    val sentCount: Int = 0,
    val startedAt: String = ""
)
