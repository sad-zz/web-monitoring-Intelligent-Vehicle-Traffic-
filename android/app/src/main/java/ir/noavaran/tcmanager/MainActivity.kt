package ir.noavaran.tcmanager

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.google.android.material.bottomnavigation.BottomNavigationView
import ir.noavaran.tcmanager.ui.DevicesFragment
import ir.noavaran.tcmanager.ui.SettingsFragment
import ir.noavaran.tcmanager.ui.TerminalFragment
import ir.noavaran.tcmanager.ui.WebFragment

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val nav = findViewById<BottomNavigationView>(R.id.bottom_nav)
        nav.setOnItemSelectedListener { item ->
            val fragment: Fragment = when (item.itemId) {
                R.id.nav_dashboard -> WebFragment.newInstance(WebFragment.MODE_DASHBOARD)
                R.id.nav_devices -> DevicesFragment()
                R.id.nav_rmto -> WebFragment.newInstance(WebFragment.MODE_RMTO)
                R.id.nav_terminal -> TerminalFragment()
                else -> SettingsFragment()
            }
            supportFragmentManager.beginTransaction()
                .replace(R.id.fragment_container, fragment)
                .commit()
            true
        }

        if (savedInstanceState == null) {
            // اگر با اتصال USB باز شده، مستقیم به ترمینال برو
            if (intent?.action == "android.hardware.usb.action.USB_DEVICE_ATTACHED") {
                nav.selectedItemId = R.id.nav_terminal
            } else {
                nav.selectedItemId = R.id.nav_devices
            }
        }
    }
}
