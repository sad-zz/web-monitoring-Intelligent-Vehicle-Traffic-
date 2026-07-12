package ir.noavaran.tcmanager.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.button.MaterialButton
import ir.noavaran.tcmanager.Prefs
import ir.noavaran.tcmanager.R
import ir.noavaran.tcmanager.net.ApiClient
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * تب دستگاه‌ها — لیست بومی وضعیت دستگاه‌ها از REST API سرور TC Manager:
 *   GET /api/devices        (پس از POST /api/auth/login)
 *   GET /api/tcp/connected  (اتصال‌های TCP زنده)
 * برای دستگاه‌های دارای اتصال زنده، دکمه «تنظیم ساعت» و «درخواست داده».
 */
class DevicesFragment : Fragment() {

    data class DeviceRow(
        val code: String,
        val name: String,
        val route: String,
        val ip: String,
        val status: String,
        val lastSeen: String,
        val tcpLive: Boolean
    )

    private val devices = mutableListOf<DeviceRow>()
    private lateinit var adapter: DeviceAdapter
    private lateinit var prefs: Prefs

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_devices, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        prefs = Prefs(requireContext())
        val recycler = view.findViewById<RecyclerView>(R.id.recycler)
        val swipe = view.findViewById<SwipeRefreshLayout>(R.id.swipe)
        adapter = DeviceAdapter()
        recycler.layoutManager = LinearLayoutManager(requireContext())
        recycler.adapter = adapter

        swipe.setOnRefreshListener { refresh() }
        refresh()
    }

    private fun refresh() {
        val view = view ?: return
        val swipe = view.findViewById<SwipeRefreshLayout>(R.id.swipe)
        val statsBar = view.findViewById<TextView>(R.id.txt_stats)
        val empty = view.findViewById<TextView>(R.id.txt_empty)
        val base = prefs.serverUrl

        if (base.isBlank()) {
            empty.visibility = View.VISIBLE
            swipe.isRefreshing = false
            return
        }

        swipe.isRefreshing = true
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.login(base, prefs.serverUser, prefs.serverPass)
            } catch (e: Exception) {
                swipe.isRefreshing = false
                toast(getString(R.string.devices_login_error, e.message ?: ""))
                return@launch
            }
            try {
                val list = ApiClient.getArray(base, "/api/devices")
                val tcpLive = mutableSetOf<String>()
                try {
                    val connected = ApiClient.getArray(base, "/api/tcp/connected")
                    for (i in 0 until connected.length()) {
                        tcpLive.add(connected.getJSONObject(i).optString("device_code"))
                    }
                } catch (_: Exception) {
                    // سرورهای قدیمی این endpoint را ندارند — لیست اصلی کافی است
                }

                devices.clear()
                for (i in 0 until list.length()) {
                    val o = list.getJSONObject(i)
                    val code = o.optString("device_code")
                    devices.add(
                        DeviceRow(
                            code = code,
                            name = o.optString("name", code),
                            route = o.optString("route", ""),
                            ip = o.optString("ip", ""),
                            status = o.optString("status", "offline"),
                            lastSeen = o.optString("last_seen", ""),
                            tcpLive = tcpLive.contains(code)
                        )
                    )
                }
                adapter.notifyDataSetChanged()
                empty.visibility = if (devices.isEmpty()) View.VISIBLE else View.GONE

                val online = devices.count { it.status == "online" || it.tcpLive }
                statsBar.text = getString(R.string.stats_summary, devices.size, online, tcpLive.size)
            } catch (e: Exception) {
                toast(getString(R.string.devices_load_error, e.message ?: ""))
            } finally {
                swipe.isRefreshing = false
            }
        }
    }

    private fun sendTcpAction(path: String, code: String) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val res = ApiClient.postObject(
                    prefs.serverUrl, path,
                    JSONObject().put("device_code", code)
                )
                toast(res.optString("message", getString(R.string.ok)))
            } catch (e: Exception) {
                toast(getString(R.string.devices_load_error, e.message ?: ""))
            }
        }
    }

    private fun toast(msg: String) {
        if (isAdded) Toast.makeText(requireContext(), msg, Toast.LENGTH_LONG).show()
    }

    private inner class DeviceAdapter : RecyclerView.Adapter<DeviceAdapter.Holder>() {

        inner class Holder(v: View) : RecyclerView.ViewHolder(v) {
            val dot: View = v.findViewById(R.id.status_dot)
            val name: TextView = v.findViewById(R.id.txt_name)
            val status: TextView = v.findViewById(R.id.txt_status)
            val details: TextView = v.findViewById(R.id.txt_details)
            val actions: View = v.findViewById(R.id.row_actions)
            val btnSync: MaterialButton = v.findViewById(R.id.btn_sync_time)
            val btnPoll: MaterialButton = v.findViewById(R.id.btn_poll)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = Holder(
            LayoutInflater.from(parent.context).inflate(R.layout.item_device, parent, false)
        )

        override fun getItemCount() = devices.size

        override fun onBindViewHolder(holder: Holder, position: Int) {
            val d = devices[position]
            val ctx = holder.itemView.context

            holder.name.text = if (d.name.isBlank()) d.code else "${d.name} (${d.code})"

            val effectiveStatus = if (d.tcpLive) "online" else d.status
            val (label, color) = when (effectiveStatus) {
                "online" -> R.string.status_online to R.color.online
                "warning" -> R.string.status_warning to R.color.warning
                "error" -> R.string.status_error to R.color.error
                else -> R.string.status_offline to R.color.offline
            }
            holder.status.text = buildString {
                append(ctx.getString(label))
                if (d.tcpLive) append(" • ").append(ctx.getString(R.string.device_tcp_connected))
            }
            holder.status.setTextColor(ContextCompat.getColor(ctx, color))
            holder.dot.background.setTint(ContextCompat.getColor(ctx, color))

            val parts = mutableListOf<String>()
            if (d.route.isNotBlank()) parts.add(d.route)
            if (d.ip.isNotBlank()) parts.add(d.ip)
            if (d.lastSeen.isNotBlank()) parts.add(ctx.getString(R.string.device_last_seen, d.lastSeen))
            holder.details.text = parts.joinToString(" | ")
            holder.details.visibility = if (parts.isEmpty()) View.GONE else View.VISIBLE

            holder.actions.visibility = if (d.tcpLive) View.VISIBLE else View.GONE
            holder.btnSync.setOnClickListener { sendTcpAction("/api/tcp/sync-time", d.code) }
            holder.btnPoll.setOnClickListener { sendTcpAction("/api/tcp/poll", d.code) }
        }
    }
}
