package ir.noavaran.tcmanager.serial

/**
 * اتصال سریال — پیاده‌سازی USB (کابل) و TCP (پل بی‌سیم ESP01).
 * هر دو حالت همان بایت‌های خام پروتکل RATCX1 را رد و بدل می‌کنند.
 */
interface SerialLink {
    /** true اگر اتصال برقرار است */
    val isConnected: Boolean

    /** برقراری اتصال؛ در صورت خطا Exception پرتاب می‌کند */
    fun connect(onData: (ByteArray) -> Unit, onError: (Throwable) -> Unit)

    /** ارسال بایت‌ها */
    fun write(data: ByteArray)

    /** قطع اتصال (بدون خطا حتی اگر متصل نیست) */
    fun disconnect()
}
