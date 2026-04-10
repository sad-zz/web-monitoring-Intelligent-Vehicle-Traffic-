package ir.tcmanager.ui.navigation

import android.content.Context
import android.os.Bundle
import androidx.lifecycle.AbstractSavedStateViewModelFactory
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.savedstate.SavedStateRegistryOwner
import ir.tcmanager.ui.screens.UsbSerialViewModel

class UsbSerialViewModelFactory(
    owner: SavedStateRegistryOwner,
    private val appContext: Context,
    defaultArgs: Bundle? = null
) : AbstractSavedStateViewModelFactory(owner, defaultArgs) {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(
        key: String,
        modelClass: Class<T>,
        handle: SavedStateHandle
    ): T = UsbSerialViewModel(appContext) as T
}

