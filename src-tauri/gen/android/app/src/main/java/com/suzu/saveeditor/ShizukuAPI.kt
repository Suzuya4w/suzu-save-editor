package com.suzu.saveeditor

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.ContextCompat
import rikka.shizuku.Shizuku

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
    fun getStatus(context: Context): String {
        return try {
            val installed = try {
                context.packageManager.getPackageInfo("moe.shizuku.privileged.api", 0)
                true
            } catch (e: Exception) { false }
            
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
    fun openManager(context: Context) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("shizuku://"))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            context.startActivity(intent)
        } catch (e: Exception) {
            val fallbackIntent = context.packageManager.getLaunchIntentForPackage("moe.shizuku.privileged.api")
            if (fallbackIntent != null) {
                fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(fallbackIntent)
            }
        }
    }
}
