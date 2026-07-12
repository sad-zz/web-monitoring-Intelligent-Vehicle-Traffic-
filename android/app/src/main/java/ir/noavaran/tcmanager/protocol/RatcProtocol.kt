package ir.noavaran.tcmanager.protocol

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * پروتکل سریال دستگاه تردد شمار RATCX1
 *
 * استخراج‌شده از فریم‌ور: firmware/Main (91-7.c , UART_Int_Lib.h , Variables.h)
 * - UART1: 115200 8N1 — هر فرمان یک کد ۴ رقمی + پارامتر است و با Enter (CR) پایان می‌یابد.
 * - دستگاه کاراکترها را echo می‌کند و پس از هر فرمان «OK» می‌فرستد.
 * - همین پروتکل روی TCP (سرور مرکزی یا پل سریال ESP01) هم استفاده می‌شود.
 */
object RatcProtocol {

    /** یک فرمان مستندشده از فریم‌ور */
    data class Command(
        val code: String,        // کد ۴ رقمی
        val title: String,       // نام فارسی
        val format: String,      // قالب کامل فرمان
        val description: String, // توضیح
        val quick: Boolean = false,      // نمایش به‌صورت دکمه سریع
        val dangerous: Boolean = false   // نیاز به تأیید قبل از ارسال
    )

    val COMMANDS = listOf(
        Command("0000", "شناسایی دستگاه", "0000",
            "شناسه سیستم، تاریخ/ساعت، مدل (RATCX1) و نسخه فریم‌ور را برمی‌گرداند و READY می‌فرستد.", quick = true),
        Command("0088", "نمایش همه تنظیمات", "0088",
            "وضعیت کامل: لوپ‌ها، حدود کلاس‌بندی (X,A,B,C,D,E)، مارجین، APN، طول/عرض لوپ، حد سرعت روز/شب، کد خطا (Err)، نوع تغذیه، نام محل، شماره SMS و آدرس سرور.", quick = true),
        Command("0002", "فعال/غیرفعال کردن لوپ‌ها", "0002abcd",
            "چهار رقم ۰ یا ۱ برای لوپ‌های ۱ تا ۴ (مثلاً 00021100 یعنی فقط لوپ ۱ و ۲ فعال)."),
        Command("0003", "حالت دستگاه H", "0003n",
            "AUTCAL — یک رقم ۰ یا ۱ (دستگاه H است یا نه)."),
        Command("0004", "فاصله دو لوپ", "0004nnn",
            "فاصله لوپ‌ها به سانتی‌متر (۳ رقم)."),
        Command("0005", "طول لوپ", "0005nnn",
            "طول/عرض لوپ به سانتی‌متر (۳ رقم)."),
        Command("0006", "کالیبراسیون لوپ‌ها", "0006",
            "کالیبراسیون هر چهار لوپ را اجرا می‌کند.", quick = true),
        Command("0007", "فرکانس لوپ‌ها", "0007",
            "فرکانس کالیبراسیون چهار لوپ را برمی‌گرداند (235930/caldata).", quick = true),
        Command("0008", "دیباگ عبور خودرو", "0008",
            "روشن/خاموش کردن نمایش لحظه‌ای عبور خودروها (کلاس، سرعت، طول).", quick = true),
        Command("0010", "مارجین تشخیص", "0010ttbb",
            "دو رقم مارجین بالا + دو رقم مارجین پایین."),
        Command("0011", "حداقل فاصله زمانی (HMM)", "0011nn",
            "دو رقم — حداقل ۱۰."),
        Command("0012", "تنظیم ساعت دستگاه", "0012yyMMddHHmmss",
            "تاریخ/ساعت جدید را در RTC می‌نویسد. دکمه سریع، ساعت گوشی را می‌فرستد.", quick = true),
        Command("0013", "ریست دستگاه", "0013",
            "میکروکنترلر را ریست می‌کند.", quick = true, dangerous = true),
        Command("0017", "ری‌استارت مودم GSM", "0017",
            "ماژول SIM900 را خاموش/روشن می‌کند.", quick = true),
        Command("0018", "کیفیت سیگنال GSM", "0018",
            "فرمان AT+CSQ به مودم — پاسخ +CSQ: rssi,ber (rssi از ۰ تا ۳۱؛ بالاتر بهتر).", quick = true),
        Command("0019", "حد سرعت مجاز", "0019dddnnndddnnn",
            "سرعت روز و شب لاین ۱ سپس لاین ۲ — هر کدام ۳ رقم (کیلومتر بر ساعت)."),
        Command("0021", "نوع تغذیه", "0021n",
            "۰=خورشیدی، ۱=برق شبانه، ۲=پشتیبان، ۳=بدون باتری."),
        Command("0022", "شماره SMS", "0022nnnnnnnnnnn",
            "شماره ۱۱ رقمی موبایل برای پیامک هشدار."),
        Command("0023", "نام محل نصب", "0023<32 کاراکتر>",
            "نام محل — حداکثر ۳۲ کاراکتر."),
        Command("0025", "دیباگ مودم GSM", "0025",
            "روشن/خاموش کردن نمایش دیالوگ AT مودم روی ترمینال.", quick = true),
        Command("0032", "انتخاب APN", "0032n",
            "۰=mtnirancell (ایرانسل)، ۱=mcinet (همراه اول)."),
        Command("0034", "آدرس سرور مرکزی", "0034aaa.bbb.ccc.ddd.ppppp",
            "IP چهار بخش ۳ رقمی + پورت ۵ رقمی (مثلاً 0034141.011.022.033.02022)."),
        Command("0040", "حد کلاس X (نامشخص)", "0040nnnn", "۴ رقم — آستانه طول کلاس X."),
        Command("0041", "حد کلاس A (موتور)", "0041nnnn", "۴ رقم — آستانه طول موتورسیکلت."),
        Command("0042", "حد کلاس B (سواری)", "0042nnnn", "۴ رقم — آستانه طول سواری."),
        Command("0043", "حد کلاس C (وانت)", "0043nnnn", "۴ رقم — آستانه طول وانت."),
        Command("0044", "حد کلاس D (اتوبوس)", "0044nnnn", "۴ رقم — آستانه طول اتوبوس."),
        Command("0045", "حد کلاس E (کامیون)", "0045nnnn", "۴ رقم — آستانه طول کامیون."),
        Command("0046", "شمارش تجمعی کلاس‌ها", "0046",
            "شمارش کل هر کلاس (A تا X) در هر دو لاین از ابتدای بازه.", quick = true),
        Command("0197", "درخواست داده بازه", "0197YYMMDDHHmm",
            "داده ۲۶۴ بایتی بازه ۵ دقیقه‌ای مشخص‌شده را برمی‌گرداند (پاسخ 8821). دکمه سریع، آخرین بازه کامل را می‌خواهد.", quick = true),
    )

    /**
     * بیت‌های error_byte — از Variables.h فریم‌ور.
     * همین کد در پیام 8821 (موقعیت 258-261) و خروجی 0088 (سطر Err) دیده می‌شود.
     */
    val ERROR_BITS = linkedMapOf(
        0x0001 to "MMC_ERR — خطای کارت حافظه (SD/MMC): ذخیره داده روی کارت ناموفق است",
        0x0002 to "LP1_ERR — خطای لوپ ۱: سیم‌پیچ پاسخ نمی‌دهد (قطعی/آسیب سیم یا کانکتور)",
        0x0004 to "LP2_ERR — خطای لوپ ۲: سیم‌پیچ پاسخ نمی‌دهد",
        0x0008 to "LP3_ERR — خطای لوپ ۳: سیم‌پیچ پاسخ نمی‌دهد",
        0x0010 to "LP4_ERR — خطای لوپ ۴: سیم‌پیچ پاسخ نمی‌دهد",
        0x0020 to "VMN_ERR — خطای ولتاژ شبانه: ولتاژ ذخیره‌شده ساعت ۲۲:۳۰ کمتر از حد مجاز",
        0x0040 to "SOL_ERR — خطای پنل خورشیدی: شارژ ناکافی در ساعات اوج آفتاب (۱۱ تا ۱۴)",
        0x0080 to "LBT_ERR — باتری ضعیف: ولتاژ باتری زیر آستانه (ADC < 230 ≈ ۱۱.۵ ولت)",
        0x0100 to "L1D_ERR — خطای جهت لاین ۱",
        0x0200 to "L2D_ERR — خطای جهت لاین ۲",
    )

    /** رمزگشایی کد خطا به فهرست خطاهای فعال فارسی */
    fun decodeErrorByte(code: Int): List<String> =
        ERROR_BITS.filterKeys { (code and it) != 0 }.values.toList()

    /** فرمان تنظیم ساعت با زمان فعلی گوشی: 0012yyMMddHHmmss */
    fun buildTimeSync(now: Date = Date()): String =
        "0012" + SimpleDateFormat("yyMMddHHmmss", Locale.US).format(now)

    /** فرمان درخواست آخرین بازه ۵ دقیقه‌ای کامل‌شده: 0197YYMMDDHHmm */
    fun buildLastIntervalRequest(now: Date = Date()): String {
        val cal = Calendar.getInstance()
        cal.time = now
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        // گرد کردن به مرز ۵ دقیقه قبل و رفتن به بازه کاملِ قبلی
        val minute = cal.get(Calendar.MINUTE)
        cal.set(Calendar.MINUTE, minute - (minute % 5))
        cal.add(Calendar.MINUTE, -5)
        return "0197" + SimpleDateFormat("yyMMddHHmm", Locale.US).format(cal.time)
    }

    /**
     * تبدیل مقدار خام ADC به مقدار نمایشی فریم‌ور (دهم ولت).
     * فرمول فریم‌ور: باتری = raw*0.388509 + 7 ، سولار = raw*0.388509
     */
    fun adcBatteryDisplay(raw: Int): Double = raw * 0.388509 + 7
    fun adcSolarDisplay(raw: Int): Double = raw * 0.388509

    private val ERR_LINE = Regex("""Err:\s*(\d+)""")

    /**
     * اگر در خروجی دستگاه سطر «Err: nnn» (از فرمان 0088) دیده شود،
     * کد را جدا کرده و خطاهای فعال را برمی‌گرداند.
     */
    fun findErrorsInOutput(chunk: String): Pair<Int, List<String>>? {
        val m = ERR_LINE.find(chunk) ?: return null
        val code = m.groupValues[1].toIntOrNull() ?: return null
        return code to decodeErrorByte(code)
    }
}
