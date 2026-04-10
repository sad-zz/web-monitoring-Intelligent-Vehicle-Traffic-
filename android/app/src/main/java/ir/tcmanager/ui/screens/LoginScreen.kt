package ir.tcmanager.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

@Composable
fun LoginScreen(vm: AuthViewModel, onLoginSuccess: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("TC Manager", style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.primary)
        Text("مانیتورینگ ترافیک هوشمند", style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center, modifier = Modifier.padding(bottom = 32.dp))

        // Server Address
        OutlinedTextField(
            value = vm.serverUrl,
            onValueChange = { vm.serverUrl = it },
            label = { Text("آدرس سرور") },
            placeholder = { Text("مثال: 192.168.1.100:3000") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = vm.username,
            onValueChange = { vm.username = it },
            label = { Text("نام کاربری") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = vm.password,
            onValueChange = { vm.password = it },
            label = { Text("رمز عبور") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(8.dp))

        vm.errorMessage?.let {
            Text(it, color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(vertical = 4.dp))
        }

        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { vm.login(onLoginSuccess) },
            enabled = !vm.isLoading,
            modifier = Modifier.fillMaxWidth().height(50.dp)
        ) {
            if (vm.isLoading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            else Text("ورود", style = MaterialTheme.typography.titleMedium)
        }
    }
}
