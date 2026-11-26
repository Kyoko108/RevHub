package com.revisionhub.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.WindowInsets
import android.view.WindowManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val filePickerRequest = 4102

    @Suppress("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        webView = WebView(this)
        webView.clipToPadding = true
        // Keep the WebView's content inside status/navigation bars and display cutouts
        // (including camera notches) on Android versions that draw edge-to-edge.
        webView.setOnApplyWindowInsetsListener { view, insets ->
            val cutout = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) insets.displayCutout else null
            val left = maxOf(insets.systemWindowInsetLeft, cutout?.safeInsetLeft ?: 0)
            val top = maxOf(insets.systemWindowInsetTop, cutout?.safeInsetTop ?: 0)
            val right = maxOf(insets.systemWindowInsetRight, cutout?.safeInsetRight ?: 0)
            val bottom = maxOf(insets.systemWindowInsetBottom, cutout?.safeInsetBottom ?: 0)
            view.setPadding(left, top, right, bottom)
            insets.consumeSystemWindowInsets()
        }
        setContentView(webView)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = true
            setSupportMultipleWindows(false)
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                return uri.scheme != "file" && uri.scheme != "https" && uri.scheme != "http"
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                if (url == "file:///android_asset/index.html") {
                    injectEnhancements(view)
                }
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
        val screenLayout = assets.open("screen-layout.js").bufferedReader().use { it.readText() }
        view.evaluateJavascript(enhancements) {
            view.evaluateJavascript(screenshotQuiz) {
                view.evaluateJavascript(studyFeedback) {
                    view.evaluateJavascript(screenLayout, null)
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
        webView.destroy()
        super.onDestroy()
    }
}
