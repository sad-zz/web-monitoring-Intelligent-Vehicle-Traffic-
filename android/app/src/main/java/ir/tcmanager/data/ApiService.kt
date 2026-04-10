package ir.tcmanager.data

import ir.tcmanager.data.models.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // ── Auth ────────────────────────────────────────────────────
    @POST("api/auth/login")
    suspend fun login(@Body body: Map<String, String>): Response<LoginResponse>

    @POST("api/auth/logout")
    suspend fun logout(): Response<SimpleResponse>

    @GET("api/auth/check")
    suspend fun checkAuth(): Response<AuthCheckResponse>

    // ── Dashboard ───────────────────────────────────────────────
    @GET("api/stats")
    suspend fun getStats(): Response<Stats>

    @GET("api/live")
    suspend fun getLive(@Query("limit") limit: Int = 50): Response<List<LiveEntry>>

    // ── Mehvar (Routes) ─────────────────────────────────────────
    @GET("api/mehvar")
    suspend fun getMehvarList(): Response<List<Mehvar>>

    @POST("api/mehvar")
    suspend fun createMehvar(@Body body: MehvarRequest): Response<SimpleResponse>

    @PUT("api/mehvar/{code}")
    suspend fun updateMehvar(@Path("code") code: Int, @Body body: MehvarRequest): Response<SimpleResponse>

    @DELETE("api/mehvar/{code}")
    suspend fun deleteMehvar(@Path("code") code: Int): Response<SimpleResponse>

    // ── Devices ─────────────────────────────────────────────────
    @GET("api/devices")
    suspend fun getDevices(): Response<List<Device>>

    @POST("api/devices")
    suspend fun createDevice(@Body body: DeviceRequest): Response<SimpleResponse>

    @PUT("api/devices/{code}")
    suspend fun updateDevice(@Path("code") code: String, @Body body: DeviceRequest): Response<SimpleResponse>

    @DELETE("api/devices/{code}")
    suspend fun deleteDevice(@Path("code") code: String): Response<SimpleResponse>

    // ── TCP ─────────────────────────────────────────────────────
    @GET("api/tcp/connected")
    suspend fun getTcpConnected(): Response<List<TcpConnectedDevice>>

    @POST("api/tcp/sync-time")
    suspend fun syncTime(@Body body: Map<String, String>): Response<SimpleResponse>

    @POST("api/tcp/poll")
    suspend fun pollDevice(@Body body: Map<String, String>): Response<SimpleResponse>

    @POST("api/tcp/send")
    suspend fun tcpSend(@Body body: Map<String, String>): Response<SimpleResponse>

    // ── RMTO Logs ───────────────────────────────────────────────
    @GET("api/rmto/logs")
    suspend fun getRmtoLogs(
        @Query("limit") limit: Int = 100,
        @Query("filter") filter: String = "all"
    ): Response<List<RmtoLog>>

    @GET("api/history")
    suspend fun getHistory(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Response<HistoryResponse>

    // ── RMTO Connectivity ───────────────────────────────────────
    @GET("api/rmto/connectivity-check")
    suspend fun connectivityCheck(): Response<ConnectivityCheck>

    @GET("api/rmto/queue")
    suspend fun getRmtoQueue(): Response<RmtoQueueStats>

    // ── RMTO Test Send ──────────────────────────────────────────
    @POST("api/rmto/test-send")
    suspend fun testSend(@Body body: TestSendRequest): Response<TestSendResponse>

    @POST("api/rmto/test-schedule")
    suspend fun startTestSchedule(@Body body: TestScheduleRequest): Response<SimpleResponse>

    @GET("api/rmto/test-schedule")
    suspend fun getTestScheduleJobs(): Response<List<TestScheduleJob>>

    @DELETE("api/rmto/test-schedule/{jobId}")
    suspend fun stopTestSchedule(@Path("jobId") jobId: String): Response<SimpleResponse>
}
