package com.suzu.saveeditor

import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import android.content.Intent
import android.net.Uri
import androidx.activity.result.contract.ActivityResultContracts

class MainActivity : TauriActivity() {
  external fun initShizukuJni(context: android.content.Context)
  external fun onFilePicked(uri: String?)

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

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    initShizukuJni(this)
  }

  fun launchFilePicker(mimeTypes: Array<String>) {
      openDocumentLauncher.launch(mimeTypes)
  }
}
