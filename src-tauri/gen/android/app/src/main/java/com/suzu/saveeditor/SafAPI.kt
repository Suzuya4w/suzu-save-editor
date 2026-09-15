package com.suzu.saveeditor

import android.content.Context
import android.net.Uri
import androidx.annotation.Keep
import androidx.documentfile.provider.DocumentFile
import java.io.File
import java.io.FileInputStream

@Keep
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

    @JvmStatic
    fun pickFolderForExport(context: Context) {
        if (context is MainActivity) {
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                context.launchFolderPicker()
            }
        }
    }

    @JvmStatic
    fun copyFolderToTree(context: Context, sourcePath: String, destTreeUriString: String): String {
        return try {
            val sourceFile = File(sourcePath)
            if (!sourceFile.exists() || !sourceFile.isDirectory) {
                return "ERROR: Source path is not a valid directory."
            }

            val treeUri = Uri.parse(destTreeUriString)
            val pickedDir = DocumentFile.fromTreeUri(context, treeUri)
            if (pickedDir == null || !pickedDir.canWrite()) {
                return "ERROR: Cannot write to the selected destination."
            }

            copyRecursive(context, sourceFile, pickedDir)
            "SUCCESS"
        } catch (e: Exception) {
            "ERROR: ${e.message}"
        }
    }

    private fun copyRecursive(context: Context, source: File, destDir: DocumentFile) {
        source.listFiles()?.forEach { file ->
            if (file.isDirectory) {
                var newDir = destDir.findFile(file.name)
                if (newDir == null || !newDir.isDirectory) {
                    newDir = destDir.createDirectory(file.name)
                }
                if (newDir != null) {
                    copyRecursive(context, file, newDir)
                }
            } else {
                var newFile = destDir.findFile(file.name)
                if (newFile != null) {
                    newFile.delete()
                }
                newFile = destDir.createFile("application/octet-stream", file.name)
                if (newFile != null) {
                    context.contentResolver.openOutputStream(newFile.uri)?.use { output ->
                        FileInputStream(file).use { input ->
                            input.copyTo(output)
                        }
                    }
                }
            }
        }
    }
}
