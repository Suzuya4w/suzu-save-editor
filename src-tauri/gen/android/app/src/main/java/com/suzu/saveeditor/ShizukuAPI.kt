package com.suzu.saveeditor

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.ContextCompat
import androidx.annotation.Keep
import rikka.shizuku.Shizuku
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

@Keep
object ShizukuAPI {
    @JvmStatic
    fun isAvailable(): Boolean {
        return try {
            Shizuku.pingBinder()
        } catch (e: Throwable) {
            false
        }
    }

    @JvmStatic
    fun isInstalled(context: Context): Boolean {
        return try {
            context.packageManager.getPackageInfo("moe.shizuku.privileged.api", 0)
            true
        } catch (e: Exception) {
            false
        }
    }

    @JvmStatic
    fun getStatus(context: Context): String {
        return try {
            val installed = isInstalled(context)
            val hasBinder = Shizuku.pingBinder()
            "BinderAlive=${hasBinder}, Installed=${installed}"
        } catch (e: Throwable) {
            "ERROR: ${e.message ?: e.javaClass.name}"
        }
    }

    @JvmStatic
    fun checkPermission(): Boolean {
        if (!isAvailable()) return false
        return if (Shizuku.isPreV11() || Shizuku.getVersion() < 11) {
            false
        } else {
            Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
        }
    }

    @JvmStatic
    fun requestPermission() {
        if (isAvailable() && !checkPermission()) {
            Shizuku.requestPermission(0)
        }
    }

    @JvmStatic
    fun executeCommand(command: String): String {
        if (!checkPermission()) {
            return "ERROR: Shizuku permission not granted"
        }
        return try {
            val process = Shizuku.newProcess(arrayOf("sh", "-c", command), null, null)
            val output = process.inputStream.bufferedReader().use { it.readText() }
            val error = process.errorStream.bufferedReader().use { it.readText() }
            process.waitFor()
            if (process.exitValue() == 0) output else "ERROR: $error"
        } catch (e: Exception) {
            "ERROR: ${e.message}"
        }
    }

    @JvmStatic
    fun openManager(context: Context): String {
        if (!isInstalled(context)) {
            return try {
                val playStoreIntent = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=moe.shizuku.privileged.api"))
                playStoreIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(playStoreIntent)
                "NOT_INSTALLED_OPENED_STORE"
            } catch (e: Exception) {
                try {
                    val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=moe.shizuku.privileged.api"))
                    webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(webIntent)
                    "NOT_INSTALLED_OPENED_STORE"
                } catch (e2: Exception) {
                    "NOT_INSTALLED"
                }
            }
        }

        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("shizuku://"))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
            context.startActivity(intent)
            "OPENED"
        } catch (e: Exception) {
            val fallbackIntent = context.packageManager.getLaunchIntentForPackage("moe.shizuku.privileged.api")
            if (fallbackIntent != null) {
                fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(fallbackIntent)
                "OPENED"
            } else {
                "FAILED"
            }
        }
    }

    @JvmStatic
    fun pullFile(remotePath: String, localPath: String): String {
        if (!checkPermission()) {
            return "ERROR: Shizuku permission not granted"
        }
        return try {
            val destFile = File(localPath)
            destFile.parentFile?.mkdirs()

            val process = Shizuku.newProcess(arrayOf("cat", remotePath), null, null)
            FileOutputStream(destFile).use { out ->
                process.inputStream.use { input ->
                    input.copyTo(out)
                }
            }
            val error = process.errorStream.bufferedReader().use { it.readText() }
            process.waitFor()
            if (process.exitValue() == 0) {
                "SUCCESS"
            } else {
                destFile.delete()
                "ERROR: $error"
            }
        } catch (e: Exception) {
            "ERROR: ${e.message ?: "Failed to read file via Shizuku"}"
        }
    }

    @JvmStatic
    fun pushFile(localPath: String, remotePath: String): String {
        if (!checkPermission()) {
            return "ERROR: Shizuku permission not granted"
        }
        return try {
            val sourceFile = File(localPath)
            if (!sourceFile.exists()) {
                return "ERROR: Source file does not exist: $localPath"
            }

            val parentDir = File(remotePath).parent ?: ""
            if (parentDir.isNotEmpty()) {
                val mkdirProcess = Shizuku.newProcess(arrayOf("mkdir", "-p", parentDir), null, null)
                mkdirProcess.waitFor()
            }

            val process = Shizuku.newProcess(arrayOf("sh", "-c", "cat > \"$remotePath\""), null, null)
            FileInputStream(sourceFile).use { input ->
                process.outputStream.use { out ->
                    input.copyTo(out)
                }
            }
            val error = process.errorStream.bufferedReader().use { it.readText() }
            process.waitFor()
            if (process.exitValue() == 0) {
                "SUCCESS"
            } else {
                "ERROR: $error"
            }
        } catch (e: Exception) {
            "ERROR: ${e.message ?: "Failed to write file via Shizuku"}"
        }
    }
}
