package ir.tcmanager.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val TcBlue = Color(0xFF1565C0)
private val TcBlueDark = Color(0xFF003C8F)
private val TcTeal = Color(0xFF00897B)
private val TcBackground = Color(0xFFF5F5F5)
private val TcSurface = Color(0xFFFFFFFF)
private val TcError = Color(0xFFC62828)

val OnlineGreen = Color(0xFF2E7D32)
val OfflineRed = Color(0xFFC62828)
val WarningOrange = Color(0xFFE65100)
val TerminalBg = Color(0xFF1E1E1E)
val TerminalText = Color(0xFF00FF41)
val TerminalRx = Color(0xFF4FC3F7)
val TerminalTx = Color(0xFFFFD54F)
val TerminalSystem = Color(0xFFCE93D8)

private val AppColorScheme = lightColorScheme(
    primary = TcBlue,
    onPrimary = Color.White,
    primaryContainer = TcBlueDark,
    secondary = TcTeal,
    background = TcBackground,
    surface = TcSurface,
    error = TcError
)

@Composable
fun TCManagerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = AppColorScheme,
        content = content
    )
}
