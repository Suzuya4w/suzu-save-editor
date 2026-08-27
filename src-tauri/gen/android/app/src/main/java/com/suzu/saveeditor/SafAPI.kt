package com.suzu.saveeditor

import android.content.Context
import android.net.Uri

object SafAPI {
    @JvmStatic
    fun writeContentUri(context: Context, uriString: String, data: ByteArray): String {
        return try {
            val uri = Uri.parse(uriString)
            val resolver = context.contentResolver
            resolver.openOutputStream(uri, "wt")?.use { output ->
                output.write(data)
                output.flush()
            }
            "SUCCESS"
        } catch (e: SecurityException) {
            "ERROR: Permission denied. ${e.message}"
        } catch (e: Throwable) {
            "ERROR: ${e.message ?: e.javaClass.name}"
        }
    }

    @JvmStatic
    fun pickFileForWrite(context: Context) {
        if (context is MainActivity) {
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                context.launchFilePicker(arrayOf("*/*"))
            }
        }
    }
}
