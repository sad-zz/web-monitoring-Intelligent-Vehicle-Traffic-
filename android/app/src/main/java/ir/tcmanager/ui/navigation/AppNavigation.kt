package ir.tcmanager.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import ir.tcmanager.data.PreferencesManager
import ir.tcmanager.ui.screens.*

private data class NavItem(val route: String, val icon: ImageVector, val label: String)

private val navItems = listOf(
    NavItem(Routes.HOME, Icons.Default.Dashboard, "خانه"),
    NavItem(Routes.MEHVAR, Icons.Default.Route, "محورها"),
    NavItem(Routes.DEVICES, Icons.Default.DevicesOther, "دستگاه‌ها"),
    NavItem(Routes.RMTO_LOGS, Icons.Default.List, "لاگ RMTO"),
    NavItem(Routes.RMTO_CHECK, Icons.Default.NetworkCheck, "چک RMTO"),
    NavItem(Routes.USB_SERIAL, Icons.Default.Usb, "ترمینال"),
    NavItem(Routes.TEST_TOOLS, Icons.Default.Science, "تست")
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppNavigation(prefs: PreferencesManager, authVm: AuthViewModel) {
    val navController = rememberNavController()
    val currentBackStack by navController.currentBackStackEntryAsState()
    val currentRoute = currentBackStack?.destination?.route

    val isOnMainScreen = currentRoute != null && currentRoute != Routes.LOGIN

    Scaffold(
        bottomBar = {
            if (isOnMainScreen) {
                NavigationBar {
                    navItems.forEach { item ->
                        NavigationBarItem(
                            selected = currentRoute == item.route,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label, maxLines = 1) }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = if (authVm.isLoggedIn) Routes.HOME else Routes.LOGIN,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Routes.LOGIN) {
                LoginScreen(authVm) {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                }
            }
            composable(Routes.HOME) {
                val vm = remember { HomeViewModel(prefs) }
                HomeScreen(vm)
            }
            composable(Routes.MEHVAR) {
                val vm = remember { MehvarViewModel(prefs) }
                MehvarScreen(vm)
            }
            composable(Routes.DEVICES) {
                val vm = remember { DevicesViewModel(prefs) }
                DevicesScreen(vm)
            }
            composable(Routes.RMTO_LOGS) {
                val vm = remember { RmtoLogsViewModel(prefs) }
                RmtoLogsScreen(vm)
            }
            composable(Routes.RMTO_CHECK) {
                val vm = remember { RmtoCheckViewModel(prefs) }
                RmtoCheckScreen(vm)
            }
            composable(Routes.USB_SERIAL) { backStack ->
                // UsbSerialViewModel needs context; pass the application context
                val vm: UsbSerialViewModel = viewModel(
                    viewModelStoreOwner = backStack,
                    factory = UsbSerialViewModelFactory(
                        owner = backStack,
                        appContext = navController.context.applicationContext
                    )
                )
                UsbSerialScreen(vm)
            }
            composable(Routes.TEST_TOOLS) {
                val vm = remember { TestToolsViewModel(prefs) }
                TestToolsScreen(vm)
            }
        }
    }
}
