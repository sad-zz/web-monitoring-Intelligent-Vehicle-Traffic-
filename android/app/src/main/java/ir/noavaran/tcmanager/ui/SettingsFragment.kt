package ir.noavaran.tcmanager.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.google.android.material.textfield.TextInputEditText
import ir.noavaran.tcmanager.Prefs
import ir.noavaran.tcmanager.R

class SettingsFragment : Fragment() {

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_settings, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val prefs = Prefs(requireContext())

        val serverUrl = view.findViewById<TextInputEditText>(R.id.edit_server_url)
        val serverUser = view.findViewById<TextInputEditText>(R.id.edit_server_user)
        val serverPass = view.findViewById<TextInputEditText>(R.id.edit_server_pass)
        val rmtoUrl = view.findViewById<TextInputEditText>(R.id.edit_rmto_url)
        val rmtoUser = view.findViewById<TextInputEditText>(R.id.edit_rmto_user)
        val rmtoPass = view.findViewById<TextInputEditText>(R.id.edit_rmto_pass)
        val baud = view.findViewById<TextInputEditText>(R.id.edit_baud)
        val tcpHost = view.findViewById<TextInputEditText>(R.id.edit_tcp_host)
        val tcpPort = view.findViewById<TextInputEditText>(R.id.edit_tcp_port)

        serverUrl.setText(prefs.serverUrl)
        serverUser.setText(prefs.serverUser)
        serverPass.setText(prefs.serverPass)
        rmtoUrl.setText(prefs.rmtoUrl)
        rmtoUser.setText(prefs.rmtoUser)
        rmtoPass.setText(prefs.rmtoPass)
        baud.setText(prefs.baudRate.toString())
        tcpHost.setText(prefs.tcpHost)
        tcpPort.setText(prefs.tcpPort.toString())

        view.findViewById<View>(R.id.btn_save).setOnClickListener {
            prefs.serverUrl = serverUrl.text.toString()
            prefs.serverUser = serverUser.text.toString()
            prefs.serverPass = serverPass.text.toString()
            prefs.rmtoUrl = rmtoUrl.text.toString()
            prefs.rmtoUser = rmtoUser.text.toString()
            prefs.rmtoPass = rmtoPass.text.toString()
            prefs.baudRate = baud.text.toString().toIntOrNull() ?: 115200
            prefs.tcpHost = tcpHost.text.toString()
            prefs.tcpPort = tcpPort.text.toString().toIntOrNull() ?: 23
            Toast.makeText(requireContext(), R.string.settings_saved, Toast.LENGTH_SHORT).show()
        }
    }
}
