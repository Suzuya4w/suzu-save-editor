package com.suzu.saveeditor

import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import android.content.Intent
import android.net.Uri
import androidx.activity.result.contract.ActivityResultContracts
import java.io.File

class MainActivity : TauriActivity() {
  external fun initShizukuJni(context: android.content.Context)
  external fun onFilePicked(uri: String?)

  external fun onFolderPicked(uri: String?)

  private val openDocumentLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
      if (uri != null) {
          try {
              contentResolver.takePersistableUriPermission(
                  uri,
                  Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
              )
          } catch (e: Exception) {
              e.printStackTrace()
          }
          onFilePicked(uri.toString())
      } else {
          onFilePicked(null)
      }
  }

  private val openDocumentTreeLauncher = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri: Uri? ->
      if (uri != null) {
          try {
              contentResolver.takePersistableUriPermission(
                  uri,
                  Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
              )
          } catch (e: Exception) {
              e.printStackTrace()
          }
          onFolderPicked(uri.toString())
      } else {
          onFolderPicked(null)
      }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    initShizukuJni(this)
    
    // Fallback: Save initial intent to cache file for JS to read
    intent?.data?.let { uri ->
        saveIntentToCache(uri.toString())
    }
  }

  override fun onNewIntent(intent: Intent) {
      super.onNewIntent(intent)
      intent.data?.let { uri ->
          saveIntentToCache(uri.toString())
      }
  }

  private fun saveIntentToCache(url: String) {
      try {
          if (url.startsWith("suzu://")) {
              val cacheFile = File(cacheDir, "last_intent.txt")
              cacheFile.writeText(url)
          }
      } catch (e: Exception) {
          e.printStackTrace()
      }
  }

  fun launchFilePicker(mimeTypes: Array<String>) {
      openDocumentLauncher.launch(mimeTypes)
  }

  fun launchFolderPicker() {
      openDocumentTreeLauncher.launch(null)
  }
}
