package ir.noavaran.tcmanager.ui

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.google.android.material.button.MaterialButton
import ir.noavaran.tcmanager.Prefs
import ir.noavaran.tcmanager.R
import org.json.JSONObject

/**
 * تب وب — دو حالت:
 *  - MODE_DASHBOARD: پنل مانیتورینگ TC Manager (همان سایت پروژه)
 *  - MODE_RMTO: سایت راهداری (RMTO) با دکمه «ورود خودکار» که
 *    نام کاربری/رمز ذخیره‌شده را در فرم ورود صفحه تزریق می‌کند.
 */
class WebFragment : Fragment() {

    companion object {
        const val MODE_DASHBOARD = "dashboard"
        const val MODE_RMTO = "rmto"
        private const val ARG_MODE = "mode"

        fun newInstance(mode: String) = WebFragment().apply {
            arguments = Bundle().apply { putString(ARG_MODE, mode) }
        }
    }

    private var webView: WebView? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_web, container, false)

    @SuppressLint("SetJavaScriptEnabled")
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val prefs = Prefs(requireContext())
        val mode = arguments?.getString(ARG_MODE) ?: MODE_DASHBOARD
        val url = if (mode == MODE_RMTO) prefs.rmtoUrl else prefs.serverUrl

        val progress = view.findViewById<ProgressBar>(R.id.progress)
        val noUrl = view.findViewById<TextView>(R.id.txt_no_url)
        val autoLogin = view.findViewById<MaterialButton>(R.id.btn_autologin)
        val web = view.findViewById<WebView>(R.id.webview)
        webView = web

        if (url.isBlank()) {
            noUrl.visibility = View.VISIBLE
            web.visibility = View.GONE
            return
        }

        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.loadWithOverviewMode = true
        web.settings.useWideViewPort = true
        web.settings.builtInZoomControls = true
        web.settings.displayZoomControls = false

        web.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                progress.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progress.visibility = View.GONE
            }
        }

        if (mode == MODE_RMTO) {
            autoLogin.visibility = View.VISIBLE
            autoLogin.setOnClickListener {
                val user = prefs.rmtoUser
                val pass = prefs.rmtoPass
                if (user.isBlank() || pass.isBlank()) {
                    Toast.makeText(requireContext(), R.string.rmto_no_credentials, Toast.LENGTH_LONG).show()
                    return@setOnClickListener
                }
                injectLogin(web, user, pass)
            }
        }

        web.loadUrl(url)
    }

    /**
     * پرکردن فرم ورود صفحه: اولین فیلد متنی = نام کاربری،
     * اولین فیلد password = رمز؛ سپس دکمه submit کلیک می‌شود.
     */
    private fun injectLogin(web: WebView, user: String, pass: String) {
        // JSONObject.quote رشته را برای جاسازی امن در JS نقل‌قول می‌کند
        val u = JSONObject.quote(user)
        val p = JSONObject.quote(pass)
        val js = """
            (function() {
                var inputs = document.querySelectorAll('input');
                var userField = null, passField = null;
                for (var i = 0; i < inputs.length; i++) {
                    var t = (inputs[i].type || 'text').toLowerCase();
                    if (!passField && t === 'password') passField = inputs[i];
                    if (!userField && (t === 'text' || t === 'email')) userField = inputs[i];
                }
                if (userField) { userField.value = $u; userField.dispatchEvent(new Event('input', {bubbles:true})); }
                if (passField) { passField.value = $p; passField.dispatchEvent(new Event('input', {bubbles:true})); }
                var btn = document.querySelector('input[type=submit], button[type=submit]');
                if (!btn && passField && passField.form) { passField.form.submit(); return 'form'; }
                if (btn) { btn.click(); return 'click'; }
                return 'notfound';
            })();
        """.trimIndent()
        web.evaluateJavascript(js, null)
    }

    override fun onDestroyView() {
        webView?.destroy()
        webView = null
        super.onDestroyView()
    }
}
