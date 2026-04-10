package ir.tcmanager

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import ir.tcmanager.data.PreferencesManager
import ir.tcmanager.ui.navigation.AppNavigation
import ir.tcmanager.ui.screens.AuthViewModel
import ir.tcmanager.ui.theme.TCManagerTheme

class MainActivity : ComponentActivity() {

    private lateinit var prefs: PreferencesManager
    private lateinit var authVm: AuthViewModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        prefs = PreferencesManager(applicationContext)
        authVm = AuthViewModel(prefs)

        // Check if already logged in (valid session cookie)
        authVm.checkSession()

        setContent {
            TCManagerTheme {
                // Force RTL layout direction for the entire app
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = MaterialTheme.colorScheme.background
                    ) {
                        AppNavigation(prefs = prefs, authVm = authVm)
                    }
                }
            }
        }
    }

    /**
     * Handle USB_DEVICE_ATTACHED intents forwarded to this activity.
     * The UsbSerialScreen's ViewModel will pick up the device when it calls refreshDevices().
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }
}
