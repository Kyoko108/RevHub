package com.revisionhub.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.RandomAccessFile
import java.util.concurrent.ConcurrentHashMap

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private lateinit var nativeAssetStorage: RevHubNativeAssetStorage
    private val filePickerRequest = 4102

    @Suppress("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) window.setDecorFitsSystemWindows(true)
        window.statusBarColor = android.graphics.Color.rgb(13, 17, 27)
        window.navigationBarColor = android.graphics.Color.rgb(13, 17, 27)

        webView = WebView(this).apply {
            isVerticalScrollBarEnabled = true
            isHorizontalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
        }
        setContentView(webView)
        nativeAssetStorage = RevHubNativeAssetStorage(this)
        webView.addJavascriptInterface(nativeAssetStorage, "RevHubNativeStorage")
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = true
            setSupportMultipleWindows(false)
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                return uri.scheme != "file" && uri.scheme != "https" && uri.scheme != "http"
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                if (url == "file:///android_asset/index.html") injectEnhancements(view)
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                val intent = fileChooserParams.createIntent()
                return try {
                    startActivityForResult(intent, filePickerRequest)
                    true
                } catch (_: Exception) {
                    this@MainActivity.filePathCallback = null
                    filePathCallback.onReceiveValue(null)
                    false
                }
            }
        }
        webView.loadUrl("file:///android_asset/index.html")
    }

    private fun injectEnhancements(view: WebView) {
        val enhancements = assets.open("enhancements.js").bufferedReader().use { it.readText() }
        val screenshotQuiz = assets.open("screenshot-quiz.js").bufferedReader().use { it.readText() }
        val studyFeedback = assets.open("study-feedback.js").bufferedReader().use { it.readText() }
        val questionEditor = assets.open("question-editor.js").bufferedReader().use { it.readText() }
        val screenLayout = assets.open("screen-layout.js").bufferedReader().use { it.readText() }
        val uiPolish = assets.open("ui-polish.js").bufferedReader().use { it.readText() }
        val settingsRecovery = assets.open("settings-recovery.js").bufferedReader().use { it.readText() }
        view.evaluateJavascript(enhancements) {
            view.evaluateJavascript(screenshotQuiz) {
                view.evaluateJavascript(studyFeedback) {
                    view.evaluateJavascript(questionEditor) {
                        view.evaluateJavascript(screenLayout) {
                            view.evaluateJavascript(uiPolish) {
                                view.evaluateJavascript(settingsRecovery, null)
                            }
                        }
                    }
                }
            }
        }
    }

    @Deprecated("Deprecated by Android, retained for WebView file chooser compatibility")
    override fun onBackPressed() {
        if (this::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    @Deprecated("Deprecated by Android, retained for WebView file chooser compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == filePickerRequest) {
            val result = if (resultCode == Activity.RESULT_OK) WebChromeClient.FileChooserParams.parseResult(resultCode, data) else null
            filePathCallback?.onReceiveValue(result)
            filePathCallback = null
        }
    }

    override fun onDestroy() {
        filePathCallback?.onReceiveValue(null)
        if (::nativeAssetStorage.isInitialized) nativeAssetStorage.close()
        webView.destroy()
        super.onDestroy()
    }
}

/**
 * Stores large media in the app-private files directory when WebView IndexedDB
 * reaches its origin quota. Data survives app restarts and requires no broad
 * external-storage permission.
 */
private class RevHubNativeAssetStorage(context: Context) {
    private val assetDirectory = File(context.applicationContext.filesDir, "revhub-assets")
    private val writers = ConcurrentHashMap<String, FileOutputStream>()
    @Volatile private var lastFailure: String = ""

    private fun validId(id: String): Boolean = id.matches(Regex("[A-Za-z0-9_-]{1,100}"))
    private fun assetFile(id: String) = File(assetDirectory, "$id.bin")
    private fun partFile(id: String) = File(assetDirectory, "$id.part")
    private fun mimeFile(id: String) = File(assetDirectory, "$id.mime")

    private fun fail(error: Exception): Boolean {
        lastFailure = error.message ?: error.javaClass.simpleName
        return false
    }

    @JavascriptInterface
    fun getLastError(): String = lastFailure

    @JavascriptInterface
    fun beginWrite(id: String): Boolean {
        if (!validId(id)) return fail(IllegalArgumentException("Invalid media identifier"))
        return try {
            if (!assetDirectory.exists() && !assetDirectory.mkdirs()) {
                throw IOException("Could not create app media directory")
            }
            writers.remove(id)?.close()
            partFile(id).delete()
            writers[id] = FileOutputStream(partFile(id))
            lastFailure = ""
            true
        } catch (error: Exception) {
            fail(error)
        }
    }

    @JavascriptInterface
    fun appendWriteChunk(id: String, encodedChunk: String): Boolean {
        if (!validId(id)) return fail(IllegalArgumentException("Invalid media identifier"))
        return try {
            val output = writers[id] ?: throw IOException("Media write session is not open")
            val bytes = Base64.decode(encodedChunk, Base64.DEFAULT)
            synchronized(output) { output.write(bytes) }
            true
        } catch (error: Exception) {
            fail(error)
        }
    }

    @JavascriptInterface
    fun finishWrite(id: String, mimeType: String): Boolean {
        if (!validId(id)) return fail(IllegalArgumentException("Invalid media identifier"))
        return try {
            val output = writers.remove(id) ?: throw IOException("Media write session is not open")
            output.flush()
            output.fd.sync()
            output.close()
            val temporary = partFile(id)
            val destination = assetFile(id)
            if (destination.exists() && !destination.delete()) {
                throw IOException("Could not replace the previous media file")
            }
            if (!temporary.renameTo(destination)) {
                temporary.copyTo(destination, overwrite = true)
                temporary.delete()
            }
            mimeFile(id).writeText(mimeType.take(160).ifBlank { "application/octet-stream" })
            lastFailure = ""
            true
        } catch (error: Exception) {
            writers.remove(id)?.let { try { it.close() } catch (_: Exception) {} }
            fail(error)
        }
    }

    @JavascriptInterface
    fun abortWrite(id: String) {
        if (!validId(id)) return
        writers.remove(id)?.let { try { it.close() } catch (_: Exception) {} }
        partFile(id).delete()
    }

    @JavascriptInterface
    fun hasAsset(id: String): Boolean = validId(id) && assetFile(id).isFile

    @JavascriptInterface
    fun getAssetSize(id: String): Double =
        if (validId(id)) assetFile(id).takeIf { it.isFile }?.length()?.toDouble() ?: 0.0 else 0.0

    @JavascriptInterface
    fun getAssetMime(id: String): String =
        if (validId(id)) mimeFile(id).takeIf { it.isFile }?.readText()?.take(160) ?: "application/octet-stream"
        else "application/octet-stream"

    @JavascriptInterface
    fun readAssetChunk(id: String, offset: Double, maxBytes: Int): String {
        if (!validId(id) || offset < 0) return ""
        return try {
            val file = assetFile(id)
            if (!file.isFile || offset >= file.length()) return ""
            val count = minOf(maxBytes.coerceIn(1, 192 * 1024), (file.length() - offset.toLong()).toInt())
            val bytes = ByteArray(count)
            RandomAccessFile(file, "r").use { input ->
                input.seek(offset.toLong())
                val read = input.read(bytes)
                if (read <= 0) "" else Base64.encodeToString(bytes, 0, read, Base64.NO_WRAP)
            }
        } catch (error: Exception) {
            fail(error)
            ""
        }
    }

    @JavascriptInterface
    fun deleteAsset(id: String): Boolean {
        if (!validId(id)) return false
        abortWrite(id)
        mimeFile(id).delete()
        val file = assetFile(id)
        return !file.exists() || file.delete()
    }

    @JavascriptInterface
    fun clearAssets(): Boolean {
        close()
        return try {
            if (!assetDirectory.exists()) true
            else assetDirectory.listFiles()?.all { it.deleteRecursively() } ?: false
        } catch (error: Exception) {
            fail(error)
        }
    }

    fun close() {
        writers.entries.toList().forEach { (id, output) ->
            writers.remove(id)
            try { output.close() } catch (_: Exception) {}
            partFile(id).delete()
        }
    }
}
