package io.osintgram.pdftoolkit

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.view.KeyEvent
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream

/**
 * Thin, offline-first shell around the PDF Toolkit web app.
 *
 * The site's own files are bundled in assets/www and served through
 * WebViewAssetLoader over https://appassets.androidplatform.net — a real secure
 * origin, so Web Workers (pdf.js, Tesseract) and WebAssembly behave exactly as
 * they do on the website. Nothing is fetched from the network.
 */
class MainActivity : Activity() {

    private lateinit var web: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingPermission: PermissionRequest? = null

    private val reqFileChooser = 1001
    private val reqCamera = 1002
    private val reqLegacyWrite = 1003

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        goImmersive()

        // On very old devices saving into Downloads still needs the legacy grant.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE), reqLegacyWrite)
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this)
        web.setBackgroundColor(0xFF0D1320.toInt())
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowContentAccess = true
            allowFileAccess = false
            allowFileAccessFromFileURLs = false
            allowUniversalAccessFromFileURLs = false
            mediaPlaybackRequiresUserGesture = false
            useWideViewPort = true
            loadWithOverviewMode = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        web.addJavascriptInterface(Bridge(), "PDFToolkitBridge")

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url
                if (url.host == "appassets.androidplatform.net") return false
                // Anything else (Instagram, GitHub) belongs in the real browser.
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                    true
                } catch (e: Exception) {
                    true
                }
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                return try {
                    val intent = params.createIntent()
                    intent.addCategory(Intent.CATEGORY_OPENABLE)
                    startActivityForResult(intent, reqFileChooser)
                    true
                } catch (e: Exception) {
                    filePathCallback = null
                    false
                }
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                val wantsVideo = request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                if (!wantsVideo) {
                    request.deny()
                    return
                }
                if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                } else {
                    pendingPermission = request
                    requestPermissions(arrayOf(Manifest.permission.CAMERA), reqCamera)
                }
            }
        }

        setContentView(web)
        web.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    }

    private fun goImmersive() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val c = WindowInsetsControllerCompat(window, window.decorView)
        c.hide(WindowInsetsCompat.Type.systemBars())
        c.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == reqFileChooser) {
            val cb = filePathCallback ?: return
            filePathCallback = null
            cb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
            return
        }
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        if (requestCode == reqCamera) {
            val p = pendingPermission
            pendingPermission = null
            if (p != null) {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    p.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                } else {
                    p.deny()
                }
            }
        }
        @Suppress("DEPRECATION")
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && this::web.isInitialized && web.canGoBack()) {
            web.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        if (this::web.isInitialized) {
            web.destroy()
        }
        super.onDestroy()
    }

    /**
     * Exposed to the page as window.PDFToolkitBridge. The web app only uses it
     * when it is present, so the same files still run unchanged in a browser.
     */
    inner class Bridge {

        @JavascriptInterface
        fun platform(): String = "android"

        @JavascriptInterface
        fun appVersion(): String = BuildConfig.VERSION_NAME

        @JavascriptInterface
        fun appVersionCode(): Int = BuildConfig.VERSION_CODE

        @JavascriptInterface
        fun toast(message: String) {
            runOnUiThread {
                Toast.makeText(this@MainActivity, message, Toast.LENGTH_SHORT).show()
            }
        }

        /** Write a produced file into the device's Downloads folder. */
        @JavascriptInterface
        fun saveFile(name: String, mime: String, base64Data: String): Boolean {
            return try {
                val bytes = Base64.decode(base64Data, Base64.DEFAULT)
                val safe = name.replace(Regex("[\\\\/:*?\"<>|]"), "_").trim().ifBlank { "download" }
                val type = mime.ifBlank { "application/octet-stream" }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, safe)
                        put(MediaStore.Downloads.MIME_TYPE, type)
                        put(MediaStore.Downloads.IS_PENDING, 1)
                    }
                    val resolver = contentResolver
                    val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                        ?: throw IllegalStateException("could not create the download entry")
                    val out: OutputStream = resolver.openOutputStream(uri)
                        ?: throw IllegalStateException("could not open the download stream")
                    out.use { it.write(bytes) }
                    values.clear()
                    values.put(MediaStore.Downloads.IS_PENDING, 0)
                    resolver.update(uri, values, null, null)
                } else {
                    val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                    if (!dir.exists()) dir.mkdirs()
                    FileOutputStream(File(dir, safe)).use { it.write(bytes) }
                }

                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Saved to Downloads: $safe", Toast.LENGTH_LONG).show()
                }
                true
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Could not save the file: ${e.message}", Toast.LENGTH_LONG).show()
                }
                false
            }
        }
    }
}
