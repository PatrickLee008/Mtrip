package com.mtrip.installreferrer

import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull

class InstallReferrerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MtripInstallReferrer")

    AsyncFunction("read") Coroutine { ->
      val context = appContext.reactContext ?: return@Coroutine null
      val client = InstallReferrerClient.newBuilder(context).build()
      try {
        withTimeoutOrNull(1500) {
          suspendCancellableCoroutine<String?> { continuation ->
            client.startConnection(object : InstallReferrerStateListener {
              override fun onInstallReferrerSetupFinished(responseCode: Int) {
                val referrer = when (responseCode) {
                  InstallReferrerClient.InstallReferrerResponse.OK ->
                    runCatching { client.installReferrer.installReferrer }.getOrNull()
                  InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED -> ""
                  else -> null
                }
                continuation.resume(referrer)
              }

              override fun onInstallReferrerServiceDisconnected() = Unit
            })
          }
        }
      } finally {
        client.endConnection()
      }
    }
  }
}
