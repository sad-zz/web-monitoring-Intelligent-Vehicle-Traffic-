# Add project specific ProGuard rules here.

# Retrofit
-keepattributes Signature
-keepattributes *Annotation*
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# Gson
-keep class com.google.gson.** { *; }
-keep class ir.tcmanager.data.models.** { *; }

# USB Serial
-keep class com.hoho.android.usbserial.** { *; }

# Compose
-keep class androidx.compose.** { *; }
